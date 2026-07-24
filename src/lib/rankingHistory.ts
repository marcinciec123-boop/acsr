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

const buildRanks = (points: Record<string, number>): Record<string, number> => Object.fromEntries(
  Object.entries(points)
    .sort(([, a], [, b]) => b - a)
    .map(([team], index) => [team, index + 1]),
);

/**
 * Rebuild snapshots for tournaments played before ranking history existed.
 * The present ranking remains the source of truth: known historical deltas are
 * reversed to derive the baseline, then replayed chronologically. This keeps
 * the final point totals exact while restoring every historical event date.
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
  const running: Record<string, number> = Object.fromEntries(clubs.map(team => [
    team.name,
    Math.max(0, (team.points || 0) - (knownTotals.get(team.name) || 0)),
  ]));

  const snapshots: RankingSnapshot[] = [];
  [...deltasByDate.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([date, daily]) => {
    daily.forEach((delta, team) => { running[team] = Math.max(0, (running[team] || 0) + delta); });
    const points = { ...running };
    snapshots.push({ date, points, ranks: buildRanks(points) });
  });
  return snapshots;
}

/** Persist a merged history, including tournaments played before this feature existed. */
export async function synchronizeRankingHistory(): Promise<boolean> {
  const merged = new Map<string, RankingSnapshot>();
  buildHistoricalRankingSnapshots().forEach(snapshot => merged.set(snapshot.date, snapshot));
  loadRankingHistory().forEach(snapshot => {
    const historical = merged.get(snapshot.date);
    merged.set(snapshot.date, {
      date: snapshot.date,
      points: { ...(historical?.points || {}), ...snapshot.points },
      ranks: { ...(historical?.ranks || {}), ...(snapshot.ranks || {}) },
      rosters: { ...(historical?.rosters || {}), ...(snapshot.rosters || {}) },
    });
  });
  const history = [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
  return saveToStorageAsync(KEY, history);
}

/** Save a complete snapshot for a tournament date; merges with same-day entry. */
export async function recordRankingSnapshot(reason?: string, dateOverride?: string): Promise<boolean> {
  const ranking = loadFromStorage<TeamData[] | null>("ranking_data", null)
    || (teamDatabase as TeamData[]);
  const date = (dateOverride || getWorldDate()).slice(0, 10);
  const points: Record<string, number> = {};
  const ranks: Record<string, number> = {};
  const rosters: Record<string, string[]> = {};
  const clubs = ranking.filter(isClub).sort((a, b) => (b.points || 0) - (a.points || 0));
  clubs.forEach((t, index) => {
    points[t.name] = t.points || 0;
    ranks[t.name] = index + 1;
    rosters[t.name] = splitRoster(t).active.slice(0, 5);
  });

  const history = loadRankingHistory();
  const existing = history.findIndex(h => h.date === date);
  if (existing >= 0) {
    history[existing] = { date, points, ranks, rosters };
  } else {
    history.push({ date, points, ranks, rosters });
  }
  history.sort((a, b) => a.date.localeCompare(b.date));
  void reason;
  const saved = await saveToStorageAsync(KEY, history);
  if (!saved) return false;
  return synchronizeRankingHistory();
}

export interface TeamRankingPoint { date: string; points: number; rank?: number }

const buildPlacementFallback = (): Map<string, TeamRankingPoint[]> => {
  const tournaments = loadFromStorage<TournamentData[]>("tournaments_data", [])
    .filter(t => t.status === "completed" && !!t.endDate && t.kind !== "worlds")
    .sort((a, b) => a.endDate.localeCompare(b.endDate));
  const totals = new Map<string, number>();
  const series = new Map<string, TeamRankingPoint[]>();
  const byDate = new Map<string, TournamentData[]>();
  tournaments.forEach(t => byDate.set(t.endDate, [...(byDate.get(t.endDate) || []), t]));

  for (const [date, events] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    events.forEach(t => t.placements?.forEach(p => totals.set(p.team, (totals.get(p.team) || 0) + (p.points || 0))));
    const ordered = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    ordered.forEach(([team, points], index) => {
      const list = series.get(team) || [];
      list.push({ date, points, rank: index + 1 });
      series.set(team, list);
    });
  }
  return series;
};

/** Series of {date, points, rank} for one team, sorted ascending.
 *  If we don't have enough snapshots, synthesize a cumulative series from
 *  the team's tournament placements so the chart isn't empty. */
export function getTeamRankingSeries(teamName: string): TeamRankingPoint[] {
  const snapshots = loadRankingHistory()
    .map(s => ({ date: s.date, points: s.points[teamName] ?? 0, rank: s.ranks?.[teamName] }))
    .filter(p => p.points > 0);

  const events = buildPlacementFallback().get(teamName) || [];

  if (events.length === 0) {
    // Last resort: pin current points at today (single dot).
    const ranking = loadFromStorage<TeamData[] | null>("ranking_data", null) || (teamDatabase as TeamData[]);
    const cur = ranking.find(t => t.name === teamName)?.points ?? 0;
    const clubs = ranking.filter(t => !t.isNational).sort((a, b) => (b.points || 0) - (a.points || 0));
    const idx = clubs.findIndex(t => t.name === teamName);
    return [{ date: getWorldDate(), points: cur, rank: idx >= 0 ? idx + 1 : undefined }];
  }

  const series: TeamRankingPoint[] = [...events];
  // Always merge real snapshots with historical reconstruction. Previously two
  // snapshots disabled the fallback entirely, hiding all older tournaments.
  for (const s of snapshots) {
    const idx = series.findIndex(p => p.date === s.date);
    if (idx >= 0) series[idx] = s;
    else series.push(s);
  }
  series.sort((a, b) => a.date.localeCompare(b.date));
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
