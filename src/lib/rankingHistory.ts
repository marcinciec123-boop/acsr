// ===== Ranking history snapshots =====
// Records team ranking points over time (fictional world-clock date).
// Also provides a way to reconstruct historical rosters by reversing
// transfers chronologically from the current club roster.

import { loadFromStorage, saveToStorageAsync } from "@/lib/storage";
import { installDailyRankingDbSync, loadRemoteSnapshotCache, fetchRemoteSnapshots } from "@/lib/rankingSnapshotsDb";
import { getWorldDate, WORLD_CLOCK_EVENT } from "@/lib/worldClock";

import { splitRoster } from "@/lib/benchedPlayers";
import type { MatchResult, RankingAdjustment, TournamentData } from "@/lib/types";

interface StoredTransfer {
  player: string;
  oldTeam: string;
  newTeam: string;
  date?: string;
}
import { teamDatabase, type TeamData } from "@/data/tournaments";
import { canonicalTeamName, teamNameAt } from "@/lib/teamRenames";

/**
 * Scala aliasy do jednej tożsamości. Przy starym, uszkodzonym snapshotcie nie
 * sumujemy wartości: wygrywa nazwa, która faktycznie obowiązywała w jego dniu.
 */
export function canonicalizeSnapshotMap<T>(map: Record<string, T> | undefined, date: string): Record<string, T> {
  if (!map) return {};
  const out: Record<string, T> = {};
  const priority: Record<string, number> = {};
  Object.entries(map).forEach(([team, value]) => {
    const key = canonicalTeamName(team);
    const historicalName = teamNameAt(key, date);
    const score = team === historicalName ? 3 : team === key ? 2 : 1;
    if (out[key] === undefined || score > (priority[key] ?? -1)) {
      out[key] = value;
      priority[key] = score;
    }
  });
  return out;
}

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
  const addDelta = (date: string, rawTeam: string, delta: number) => {
    const team = canonicalTeamName(rawTeam);
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
    // The application awards ranking points from final placements. Match
    // points are predictions/UI metadata and were never added to ranking_data;
    // replaying them here used to corrupt every old ranking.
    // Preserve a point on the timeline even for old tournaments without saved deltas.
    if (!deltasByDate.has(date)) deltasByDate.set(date, new Map());
  });

  // Manual edits are genuine dated ranking events as well. Omitting them made
  // today's correction leak backwards into the baseline of every older day.
  loadFromStorage<RankingAdjustment[]>("ranking_adjustments", []).forEach(adjustment => {
    const date = (adjustment.date || "").slice(0, 10);
    if (date) addDelta(date, adjustment.team, adjustment.points || 0);
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
  // Legacy saves baked reconstructions into storage; those entries never carry
  // rosters, so they can be identified and dropped safely.
  const real = loadRankingHistory().filter(s => !s.synthetic);
  const merged = new Map<string, RankingSnapshot>();
  real.forEach(s => {
    const prev = merged.get(s.date);
    const points = canonicalizeSnapshotMap(s.points, s.date);
    const rosters = canonicalizeSnapshotMap(s.rosters, s.date);
    merged.set(s.date, {
      date: s.date,
      points: { ...(prev?.points || {}), ...points },
      ranks: buildRanks({ ...(prev?.points || {}), ...points }),
      rosters: { ...(prev?.rosters || {}), ...rosters },
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
    const identity = canonicalTeamName(t.name);
    points[identity] = t.points || 0;
    ranks[identity] = index + 1;
    rosters[identity] = splitRoster(t).active.slice(0, 5);
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
  const today = getWorldDate().slice(0, 10);
  const remote: RankingSnapshot[] = loadRemoteSnapshotCache()
    .map(s => ({ date: s.date, points: s.points || {}, ranks: s.ranks, rosters: s.rosters }))
    .filter(s => s.date <= today && Object.keys(s.points).length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const localFallback = loadRankingHistory()
    .filter(s => !s.synthetic && s.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  // Once database history is available, never mix it with legacy device-only
  // snapshots. Old month-end/backfill code saved today's values under past and
  // future dates, which caused the repeating sawtooth visible on the chart.
  const real = remote.length > 0 ? remote : localFallback;
  const firstRealDate = real[0]?.date;
  // A real snapshot is a complete checkpoint. Synthetic replay is only useful
  // before the first checkpoint; mixing it between real snapshots overwrote
  // exact saved states with an approximation derived from today's ranking.
  buildHistoricalRankingSnapshots()
    .filter(s => !firstRealDate || s.date < firstRealDate)
    .forEach(s => merged.set(s.date, s));
  real.forEach(s => {
    const points = canonicalizeSnapshotMap(s.points, s.date);
    merged.set(s.date, { date: s.date, points, ranks: buildRanks(points), rosters: canonicalizeSnapshotMap(s.rosters, s.date) });
  });


  const carry: Record<string, number> = {};
  return [...merged.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => {
      Object.entries(canonicalizeSnapshotMap(s.points, s.date)).forEach(([team, pts]) => { carry[team] = pts; });
      const points = { ...carry };
      return { date: s.date, points, ranks: buildRanks(points), rosters: canonicalizeSnapshotMap(s.rosters, s.date) };
    });
}


/** Pełny ranking (posortowany) obowiązujący danego dnia historii. */
export function getRankingAt(dateIso: string): { team: string; currentTeam: string; points: number; rank: number }[] {
  const day = dateIso.slice(0, 10);
  const history = getMergedRankingHistory().filter(s => s.date <= day);
  const snapshot = history[history.length - 1];
  if (!snapshot) {
    const ranking = loadFromStorage<TeamData[] | null>("ranking_data", null) || (teamDatabase as TeamData[]);
    return ranking.filter(isClub)
      .sort((a, b) => (b.points || 0) - (a.points || 0) || a.name.localeCompare(b.name))
      .map((t, i) => ({ team: t.name, currentTeam: t.name, points: t.points || 0, rank: i + 1 }));
  }
  return Object.entries(snapshot.points)
    .map(([team, points]) => ({ team: teamNameAt(team, day), currentTeam: team, points: Number(points) || 0 }))
    .sort((a, b) => (b.points - a.points) || a.team.localeCompare(b.team))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}


/** Series of {date, points, rank} for one team, sorted ascending. */
export function getTeamRankingSeries(rawTeamName: string): TeamRankingPoint[] {
  const teamName = canonicalTeamName(rawTeamName);
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
export function getTeamRosterAt(rawTeamName: string, dateIso: string): string[] {
  const teamName = canonicalTeamName(rawTeamName);
  const snapshot = loadRankingHistory()
    .map(s => ({ ...s, rosters: canonicalizeSnapshotMap(s.rosters, s.date) }))
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

// ===== Automatyczne migawki na koniec miesiąca =====
// Gdy fikcyjny kalendarz przekroczy koniec miesiąca, zapisujemy migawkę
// datowaną na jego ostatni dzień (o ile nie ma jeszcze realnego zapisu).

const MONTH_MARK_KEY = "ranking_history_month_mark";

const lastDayOfMonth = (year: number, month: number): string => {
  const d = new Date(Date.UTC(year, month + 1, 0));
  return d.toISOString().slice(0, 10);
};

/** Zapisuje brakujące migawki końca miesiąca aż do bieżącej daty świata. */
export async function ensureMonthEndSnapshots(): Promise<void> {
  const today = getWorldDate().slice(0, 10);
  let mark = "";
  try { mark = localStorage.getItem(MONTH_MARK_KEY) || ""; } catch { /* ignore */ }
  if (mark >= today) return;

  const existing = new Set(loadRankingHistory().filter(s => !s.synthetic).map(s => s.date));
  const [y, m] = today.split("-").map(Number);
  const targets: string[] = [];
  // Sprawdź ostatnie 24 miesiące wstecz — wystarczająco na całą oś czasu sezonu.
  for (let back = 1; back <= 24; back++) {
    const date = new Date(Date.UTC(y, m - 1 - back, 1));
    const iso = lastDayOfMonth(date.getUTCFullYear(), date.getUTCMonth());
    if (iso >= today) continue;
    if (!existing.has(iso)) targets.push(iso);
  }
  targets.sort();

  if (targets.length === 0) return;

  const history = loadRankingHistory().filter(s => !s.synthetic);
  targets.forEach(iso => {
    // Stan rankingu obowiązujący tego dnia (rekonstrukcja + realne migawki).
    const standings = getRankingAt(iso);
    if (standings.length === 0) return;
    const points: Record<string, number> = {};
    const ranks: Record<string, number> = {};
    const rosters: Record<string, string[]> = {};
    standings.forEach(entry => {
      points[entry.currentTeam] = entry.points;
      ranks[entry.currentTeam] = entry.rank;
      const roster = getTeamRosterAt(entry.currentTeam, iso);
      if (roster.length) rosters[entry.currentTeam] = roster.slice(0, 5);
    });
    history.push({ date: iso, points, ranks, rosters });
  });
  history.sort((a, b) => a.date.localeCompare(b.date));
  await saveToStorageAsync(KEY, history);

  try { localStorage.setItem(MONTH_MARK_KEY, today); } catch { /* ignore */ }
}

let monthEndInstalled = false;
/** Nasłuchuje zmian zegara świata i dopisuje migawki końca miesiąca. */
export function installMonthEndSnapshots(): void {
  if (monthEndInstalled || typeof window === "undefined") return;
  monthEndInstalled = true;
  const run = () => { void ensureMonthEndSnapshots(); };
  window.addEventListener(WORLD_CLOCK_EVENT, run);
  run();
}

// ===== Dzienne migawki w bazie danych =====
// Przy przejściu do kolejnego dnia zapisujemy pełny ranking dnia w bazie
// (i lokalnie), dzięki czemu historia nigdy się nie rozjeżdża.

/** Migawka rankingu obowiązującego danego dnia — gotowa do zapisu w bazie. */
function buildDailySnapshot(date: string): { date: string; points: Record<string, number>; ranks: Record<string, number>; rosters: Record<string, string[]> } | null {
  const ranking = loadFromStorage<TeamData[] | null>("ranking_data", null) || (teamDatabase as TeamData[]);
  const clubs = ranking.filter(isClub).sort((a, b) => (b.points || 0) - (a.points || 0) || a.name.localeCompare(b.name));
  if (clubs.length === 0) return null;
  const points: Record<string, number> = {};
  const ranks: Record<string, number> = {};
  const rosters: Record<string, string[]> = {};
  clubs.forEach((team, index) => {
    const identity = canonicalTeamName(team.name);
    points[identity] = team.points || 0;
    ranks[identity] = index + 1;
    const active = splitRoster(team).active.slice(0, 5);
    if (active.length) rosters[identity] = active;
  });
  return { date, points, ranks, rosters };
}

let dailySyncInstalled = false;

/**
 * Uruchamia dzienny zapis rankingu do bazy oraz jednorazowe pobranie
 * historycznych rankingów z bazy (uwzględnianych w wykresach).
 */
export function installDailyRankingSnapshots(): void {
  if (dailySyncInstalled || typeof window === "undefined") return;
  dailySyncInstalled = true;
  void fetchRemoteSnapshots().catch(error => console.error("Pobranie historii rankingu z bazy nie powiodło się:", error));
  installDailyRankingDbSync(date => {
    const snapshot = buildDailySnapshot(date);
    return snapshot ? { ...snapshot, source: "daily" } : null;
  });
}
