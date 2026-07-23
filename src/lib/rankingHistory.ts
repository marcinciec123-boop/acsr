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

/** Save a complete snapshot for the current world date; merges with same-day entry. */
export async function recordRankingSnapshot(reason?: string): Promise<boolean> {
  const ranking = loadFromStorage<TeamData[] | null>("ranking_data", null)
    || (teamDatabase as TeamData[]);
  const date = getWorldDate();
  const points: Record<string, number> = {};
  const ranks: Record<string, number> = {};
  const rosters: Record<string, string[]> = {};
  const clubs = ranking.filter(t => !t.isNational).sort((a, b) => (b.points || 0) - (a.points || 0));
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
  return saveToStorageAsync(KEY, history);
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

  if (snapshots.length >= 2) return snapshots;

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
  // Merge in real snapshots if any (they win on their date).
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
