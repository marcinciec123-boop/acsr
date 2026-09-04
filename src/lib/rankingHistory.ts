// ===== Ranking history snapshots =====
// Records team ranking points over time (fictional world-clock date).
// Also provides a way to reconstruct historical rosters by reversing
// transfers chronologically from the current club roster.

import { loadFromStorage, saveToStorageAsync } from "@/lib/storage";
import { loadRemoteSnapshotCache, fetchRemoteSnapshots } from "@/lib/rankingSnapshotsDb";
import { getWorldDate, WORLD_CLOCK_EVENT } from "@/lib/worldClock";

import { splitRoster } from "@/lib/benchedPlayers";
import type { MatchResult, TournamentData } from "@/lib/types";

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

// Syntetyczna rekonstrukcja historii rankingu została usunięta —
// wykres pokazuje wyłącznie realne migawki z zapisu użytkownika i jego bazy.


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
  const today = getWorldDate().slice(0, 10);
  // A tournament may be scheduled far ahead. Never let changing its status
  // inject that future end date into the historical ranking timeline.
  if (!date || date > today) return false;
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
  // Tylko realne migawki: zapis użytkownika + jego historyczne rankingi z bazy.
  // Żadnych syntetycznych rekonstrukcji — one fałszowały wykres.
  const historical: RankingSnapshot[] = loadRemoteSnapshotCache()
    .filter(s => s.source === "historical")
    .map(s => ({ date: s.date, points: s.points || {}, ranks: s.ranks, rosters: s.rosters }))
    .filter(s => s.date <= today && Object.keys(s.points).length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  const local = loadRankingHistory()
    .filter(s => !s.synthetic && s.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const real = [...historical, ...local];
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
// datowaną na jego ostatni dzień — WYŁĄCZONE.
// Te migawki były wyliczane z rekonstrukcji, więc nie pochodziły z zapisu
// użytkownika. Zostają usunięte jednorazowo i nie są już generowane.

const MONTH_MARK_KEY = "ranking_history_month_mark";
const PURGE_KEY = "ranking_history_purge_v2";

const isMonthEnd = (iso: string): boolean => {
  const d = new Date(iso + "T12:00:00Z");
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.getUTCDate() === 1;
};

/**
 * Jednorazowo usuwa migawki, których użytkownik nigdy nie zapisał:
 * - rekonstrukcje (`synthetic`),
 * - stare automatyczne migawki końca miesiąca bez składów,
 * - wszystkie wpisy bez zapisanych składów (tak wyglądały wyłącznie
 *   wpisy fabrykowane — realny zapis dnia zawsze zawiera skład drużyn).
 */
export async function purgeFabricatedRankingHistory(): Promise<void> {
  if (typeof window === "undefined") return;
  try { if (localStorage.getItem(PURGE_KEY)) return; } catch { /* ignore */ }
  const history = loadRankingHistory().filter(s =>
    !s.synthetic
    && Object.keys(s.rosters || {}).length > 0
    && !(isMonthEnd(s.date) && Object.keys(s.rosters || {}).length === 0));
  await saveToStorageAsync(KEY, history);
  try {
    localStorage.removeItem(MONTH_MARK_KEY);
    localStorage.removeItem("ranking_history_purge_v1");
    localStorage.setItem(PURGE_KEY, "1");
  } catch { /* ignore */ }
  window.dispatchEvent(new Event("ranking-history:update"));
}


/** @deprecated Automatyczne migawki końca miesiąca zostały wyłączone. */
export async function ensureMonthEndSnapshots(): Promise<void> {
  await purgeFabricatedRankingHistory();
}

let monthEndInstalled = false;
/** Utrzymane dla zgodności — wykonuje tylko jednorazowe czyszczenie. */
export function installMonthEndSnapshots(): void {
  if (monthEndInstalled || typeof window === "undefined") return;
  monthEndInstalled = true;
  void purgeFabricatedRankingHistory();
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
 * Historia rankingu jest LOKALNA (zapis użytkownika). Przy przejściu na kolejny
 * dzień zapisujemy ranking dnia, który się właśnie skończył, wyłącznie w zapisie
 * użytkownika. Z bazy pobieramy tylko rankingi historyczne (import z arkuszy),
 * które są wspólnym punktem odniesienia sprzed początku zapisu.
 */
export function installDailyRankingSnapshots(): void {
  if (dailySyncInstalled || typeof window === "undefined") return;
  dailySyncInstalled = true;
  void fetchRemoteSnapshots().catch(error => console.error("Pobranie historycznych rankingów nie powiodło się:", error));
  window.addEventListener(WORLD_CLOCK_EVENT, (event: Event) => {
    const detail = (event as CustomEvent<{ previousDate?: string }>).detail;
    const day = (detail?.previousDate || "").slice(0, 10);
    if (!day) return;
    void recordRankingSnapshot("day-change", day)
      .then(ok => { if (ok) window.dispatchEvent(new Event("ranking-history:update")); })
      .catch(error => console.error("Zapis rankingu dnia nie powiódł się:", error));
  });
}

