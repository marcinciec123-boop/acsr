// ===== Ranking history snapshots =====
// Records team ranking points over time (fictional world-clock date).
// Also provides a way to reconstruct historical rosters by reversing
// transfers chronologically from the current club roster.

import { loadFromStorage, saveToStorage } from "@/lib/storage";
import { getWorldDate } from "@/lib/worldClock";

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
}

export function loadRankingHistory(): RankingSnapshot[] {
  return loadFromStorage<RankingSnapshot[]>(KEY, []);
}

/** Save a snapshot for the current world date; merges with same-day entry. */
export function recordRankingSnapshot(reason?: string): void {
  const ranking = loadFromStorage<TeamData[] | null>("ranking_data", null)
    || (teamDatabase as TeamData[]);
  const date = getWorldDate();
  const points: Record<string, number> = {};
  ranking.forEach(t => { if (!t.isNational) points[t.name] = t.points || 0; });

  const history = loadRankingHistory();
  const existing = history.findIndex(h => h.date === date);
  if (existing >= 0) {
    history[existing] = { date, points };
  } else {
    history.push({ date, points });
  }
  history.sort((a, b) => a.date.localeCompare(b.date));
  saveToStorage(KEY, history);
  void reason;
}

/** Series of {date, points} for one team, sorted ascending. */
export function getTeamRankingSeries(teamName: string): { date: string; points: number }[] {
  return loadRankingHistory()
    .map(s => ({ date: s.date, points: s.points[teamName] ?? 0 }))
    .filter(p => p.points > 0 || true); // keep 0s too
}

/**
 * Roster at a given historical date, reconstructed by reversing all transfers
 * that happened AFTER `date` from the team's current roster.
 */
export function getTeamRosterAt(teamName: string, dateIso: string): string[] {
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
