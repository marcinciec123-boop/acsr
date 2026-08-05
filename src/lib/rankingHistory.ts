// ===== Ranking history snapshots =====
// Records team ranking points over time (fictional world-clock date).
// Also provides a way to reconstruct historical rosters by reversing
// transfers chronologically from the current club roster.

import { loadFromStorage, saveToStorageAsync } from "@/lib/storage";
import { getWorldDate } from "@/lib/worldClock";
import { splitRoster } from "@/lib/benchedPlayers";
import type { MatchResult, TournamentData } from "@/lib/types";

interface StoredTransfer {
  player: string;
  oldTeam: string;
  newTeam: string;
  date?: string;
}
import { teamDatabase, type TeamData } from "@/data/tournaments";

const KEY = "ranking_history_v1";

export interface RankingSnapshot {
  date: string;                          // YYYY-MM-DD (world clock)
  points: Record<string, number>;        // teamName -> points
  ranks?: Record<string, number>;        // teamName -> world rank at this date
  rosters?: Record<string, string[]>;    // active five at this date
  /** Reconstructed on the fly (never persisted). */
  synthetic?: boolean;
}

export function loadRankingHistory(): RankingSnapshot[] {
  return loadFromStorage<RankingSnapshot[]>(KEY, []);
}

const isClub = (team: TeamData) => !team.isNational;

const getMatchWinner = (match: MatchResult): string => {
  if (!match.team1 || !match.team2 || match.team1 === "BYE" || match.team2 === "BYE") return "";
  if ((match.score1 || 0) + (match.score2 || 0) === 0 || match.score1 === match.score2) return "";
  return match.score1 > match.score2 ? match.team1 : match.team2;
};

const getTournamentMatches = (tournament: TournamentData): MatchResult[] => {
  const matches: MatchResult[] = [];
  tournament.phases?.forEach(phase => {
    if (phase.bracket) matches.push(...phase.bracket);
    phase.groups?.forEach(group => matches.push(...group.matches));
  });
  if (tournament.matches) matches.push(...tournament.matches);
  return matches;
};

/** Ranks over the complete club set; stable tie-break by name to avoid churn. */
const buildRanks = (points: Record<string, number>): Record<string, number> => Object.fromEntries(
  Object.entries(points)
    .sort(([teamA, a], [teamB, b]) => (b - a) || teamA.localeCompare(teamB))
    .map(([team], index) => [team, index + 1]),
);

/**
 * Rebuild snapshots for tournaments played before ranking history existed.
 * The present ranking remains the source of truth: known historical deltas are
 * reversed to derive the baseline, then replayed chronologically. This keeps
 * the final point totals exact while restoring every historical event date.
 *
 * These snapshots are SYNTHETIC — they are recomputed on demand and never
 * written to storage, so a later manual point edit can't freeze a wrong value.
 */
export function buildHistoricalRankingSnapshots(): RankingSnapshot[] {
  const ranking = loadFromStorage<TeamData[] | null>("ranking_data", null)
    || (teamDatabase as TeamData[]);
  const clubs = ranking.filter(isClub);
  const clubNames = new Set(clubs.map(team => team.name));
  const tournaments = loadFromStorage<TournamentData[]>("tournaments_data", [])
    .filter(tournament => tournament.status === "completed" && tournament.kind !== "worlds" && !!tournament.endDate)
    .sort((a, b) => a.endDate.localeCompare(b.endDate));

  const deltasByDate = new Map<string, Map<string, number>>();
  const addDelta = (date: string, team: string, delta: number) => {
    if (!clubNames.has(team) || !delta) return;
    const daily = deltasByDate.get(date) || new Map<string, number>();
    daily.set(team, (daily.get(team) || 0) + delta);
    deltasByDate.set(date, daily);
  };

  tournaments.forEach(tournament => {
    const date = tournament.endDate.slice(0, 10);
    // Older completed tournaments predate `resultsConfirmed`, but their saved
    // placements are still authoritative historical ranking events.
    tournament.placements?.forEach(placement => addDelta(date, placement.team, placement.points || 0));
    getTournamentMatches(tournament).forEach(match => {
      if (!match.resultConfirmed) return;
      const winner = getMatchWinner(match);
      if (!winner) return;
      const loser = winner === match.team1 ? match.team2 : match.team1;
      addDelta(date, winner, match.pointsWinner || 0);
      addDelta(date, loser, -(match.pointsLoser || 0));
    });
    // Preserve a point on the timeline even for old tournaments without saved deltas.
    if (!deltasByDate.has(date)) deltasByDate.set(date, new Map());
  });

  const knownTotals = new Map<string, number>();
  deltasByDate.forEach(daily => daily.forEach((delta, team) => {
    knownTotals.set(team, (knownTotals.get(team) || 0) + delta);
  }));
  // No clamping here: clamping the baseline breaks the invariant
  // baseline + all deltas === current points, which is what produced the
  // wildly wrong historical charts.
  const running: Record<string, number> = Object.fromEntries(clubs.map(team => [
    team.name,
    (team.points || 0) - (knownTotals.get(team.name) || 0),
  ]));

  const dates = [...deltasByDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  const snapshots: RankingSnapshot[] = [];

  // Opening snapshot (day before the first event) so charts start at the baseline.
  if (dates.length > 0) {
    const first = new Date(dates[0][0] + "T12:00:00");
    first.setDate(first.getDate() - 1);
    const openIso = first.toISOString().slice(0, 10);
    const openPoints = Object.fromEntries(Object.entries(running).map(([t, p]) => [t, Math.round(Math.max(0, p))]));
    snapshots.push({ date: openIso, points: openPoints, ranks: buildRanks(openPoints), synthetic: true });
  }

  dates.forEach(([date, daily]) => {
    daily.forEach((delta, team) => { running[team] = (running[team] || 0) + delta; });
    const points = Object.fromEntries(Object.entries(running).map(([t, p]) => [t, Math.round(Math.max(0, p))]));
    snapshots.push({ date, points, ranks: buildRanks(points), synthetic: true });
  });
  return snapshots;
}

/**
 * Persist history. Only REAL recorded snapshots are stored — synthetic
 * reconstructions are recomputed on read, so they never get frozen into the
 * save file (which previously caused stale, contradictory historical points).
 */
export async function synchronizeRankingHistory(): Promise<boolean> {
  const real = loadRankingHistory().filter(s => !s.synthetic);
  const merged = new Map<string, RankingSnapshot>();
  real.forEach(s => {
    const prev = merged.get(s.date);
    merged.set(s.date, {
      date: s.date,
      points: { ...(prev?.points || {}), ...s.points },
      ranks: { ...(prev?.ranks || {}), ...(s.ranks || {}) },
      rosters: { ...(prev?.rosters || {}), ...(s.rosters || {}) },
    });
  });
  const history = [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
  return saveToStorageAsync(KEY, history);
}

/** Save a complete snapshot for a date; merges with same-day entry. */
export async function recordRankingSnapshot(reason?: string, dateOverride?: string): Promise<boolean> {
  const ranking = loadFromStorage<TeamData[] | null>("ranking_data", null)
    || (teamDatabase as TeamData[]);
  const date = (dateOverride || getWorldDate()).slice(0, 10);
  const points: Record<string, number> = {};
  const ranks: Record<string, number> = {};
  const rosters: Record<string, string[]> = {};
  const clubs = ranking.filter(isClub).sort((a, b) => (b.points || 0) - (a.points || 0) || a.name.localeCompare(b.name));
  clubs.forEach((t, index) => {
    points[t.name] = t.points || 0;
    ranks[t.name] = index + 1;
    rosters[t.name] = splitRoster(t).active.slice(0, 5);
  });

  const history = loadRankingHistory().filter(s => !s.synthetic);
  const existing = history.findIndex(h => h.date === date);
  if (existing >= 0) history[existing] = { date, points, ranks, rosters };
  else history.push({ date, points, ranks, rosters });
  history.sort((a, b) => a.date.localeCompare(b.date));
  void reason;
  const saved = await saveToStorageAsync(KEY, history);
  if (!saved) return false;
  return synchronizeRankingHistory();
}

/**
 * Zapisuje snapshot przy KAŻDEJ zmianie punktów drużyn (mecz, ręczna edycja,
 * zakończenie turnieju, transfer itd.). Debounce chroni przed lawiną zapisów.
 */
let autoSyncInstalled = false;
export function installRankingHistoryAutoSync(): void {
  if (autoSyncInstalled || typeof window === "undefined") return;
  autoSyncInstalled = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const handler = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      void recordRankingSnapshot("points-change").catch(error =>
        console.error("Ranking history auto-save failed:", error));
    }, 600);
  };
  window.addEventListener("ranking:update", handler);
  window.addEventListener("teams:update", handler);
}

export interface TeamRankingPoint { date: string; points: number; rank?: number }

/**
 * Pełna historia: rekonstrukcja z turniejów (syntetyczna) + zapisane migawki.
 * Zapisana migawka ZAWSZE wygrywa dla swojej daty — rekonstrukcja tylko
 * wypełnia dni, dla których nie ma realnego zapisu. Braki są przenoszone
 * z ostatniego znanego stanu, więc ranking każdego dnia jest kompletny
 * i pozycje są dokładne co do miejsca.
 */
export function getMergedRankingHistory(): RankingSnapshot[] {
  const merged = new Map<string, RankingSnapshot>();
  buildHistoricalRankingSnapshots().forEach(s => merged.set(s.date, s));
  loadRankingHistory().filter(s => !s.synthetic).forEach(s => {
    merged.set(s.date, { date: s.date, points: { ...s.points }, ranks: s.ranks, rosters: s.rosters });
  });

  const carry: Record<string, number> = {};
  return [...merged.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => {
      Object.entries(s.points).forEach(([team, pts]) => { carry[team] = pts; });
      const points = { ...carry };
      return { date: s.date, points, ranks: buildRanks(points), rosters: s.rosters };
    });
}


/** Pełny ranking (posortowany) obowiązujący danego dnia historii. */
export function getRankingAt(dateIso: string): { team: string; points: number; rank: number }[] {
  const day = dateIso.slice(0, 10);
  const history = getMergedRankingHistory().filter(s => s.date <= day);
  const snapshot = history[history.length - 1];
  if (!snapshot) {
    const ranking = loadFromStorage<TeamData[] | null>("ranking_data", null) || (teamDatabase as TeamData[]);
    return ranking.filter(isClub)
      .sort((a, b) => (b.points || 0) - (a.points || 0) || a.name.localeCompare(b.name))
      .map((t, i) => ({ team: t.name, points: t.points || 0, rank: i + 1 }));
  }
  return Object.entries(snapshot.points)
    .map(([team, points]) => ({ team, points: Number(points) || 0 }))
    .sort((a, b) => (b.points - a.points) || a.team.localeCompare(b.team))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}


/** Series of {date, points, rank} for one team, sorted ascending. */
export function getTeamRankingSeries(teamName: string): TeamRankingPoint[] {
  const series: TeamRankingPoint[] = getMergedRankingHistory()
    .filter(s => s.points[teamName] !== undefined)
    .map(s => ({ date: s.date, points: s.points[teamName], rank: s.ranks?.[teamName] }));

  if (series.length === 0) {
    const ranking = loadFromStorage<TeamData[] | null>("ranking_data", null) || (teamDatabase as TeamData[]);
    const cur = ranking.find(t => t.name === teamName)?.points ?? 0;
    const clubs = ranking.filter(isClub).sort((a, b) => (b.points || 0) - (a.points || 0));
    const idx = clubs.findIndex(t => t.name === teamName);
    return [{ date: getWorldDate(), points: cur, rank: idx >= 0 ? idx + 1 : undefined }];
  }
  return series;
}


/**
 * Roster at a given historical date, reconstructed by reversing all transfers
 * that happened AFTER `date` from the team's current roster.
 */
export function getTeamRosterAt(teamName: string, dateIso: string): string[] {
  const snapshot = loadRankingHistory()
    .filter(s => s.date <= dateIso && (s.rosters?.[teamName]?.length || 0) > 0)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (snapshot?.rosters?.[teamName]?.length) return snapshot.rosters[teamName].slice(0, 5);

  // Older data did not store lineups in ranking snapshots. Recover the actual
  // active five from the latest played map rather than taking bench order.
  const tournaments = loadFromStorage<TournamentData[]>("tournaments_data", []);
  let latest: { when: string; roster: string[] } | null = null;
  const inspect = (match: MatchResult, fallbackDate: string) => {
    const when = (match.playedAt || fallbackDate || "").slice(0, 10);
    if (!when || when > dateIso || !match.maps?.length) return;
    const isT1 = match.team1 === teamName;
    const isT2 = match.team2 === teamName;
    if (!isT1 && !isT2) return;
    const players = new Set<string>();
    match.maps.forEach(map => (isT1 ? map.team1Players : map.team2Players)?.forEach(p => players.add(p.playerName)));
    if (players.size > 0 && (!latest || when >= latest.when)) latest = { when, roster: [...players].slice(0, 5) };
  };
  tournaments.forEach(t => {
    t.phases?.forEach(phase => {
      phase.bracket?.forEach(m => inspect(m, t.endDate));
      phase.groups?.forEach(g => g.matches.forEach(m => inspect(m, t.endDate)));
    });
    t.matches?.forEach(m => inspect(m, t.endDate));
  });
  if (latest) return latest.roster;

  const ranking = loadFromStorage<TeamData[] | null>("ranking_data", null)
    || (teamDatabase as TeamData[]);
  const team = ranking.find(t => t.name === teamName);
  const current = new Set<string>(team?.roster || []);

  const transfers: StoredTransfer[] = loadFromStorage<StoredTransfer[]>("transfers_data", [])
    .slice()
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  // Walk from newest to the target date, undoing each transfer.
  for (let i = transfers.length - 1; i >= 0; i--) {
    const tr = transfers[i];
    if (!tr.date || tr.date <= dateIso) break;
    // Undo: player moved from oldTeam -> newTeam. Reverse it.
    if (tr.newTeam === teamName) current.delete(tr.player);
    if (tr.oldTeam === teamName) current.add(tr.player);
  }
  return Array.from(current).slice(0, 5);
}
