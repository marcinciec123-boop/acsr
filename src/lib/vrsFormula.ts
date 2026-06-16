// ===== VRS-style per-match ranking points formula =====
// Better team beats worse team = small reward.
// Worse team upsets better team = big reward.
// Min always > 0 so even huge favorites gain something for a win.
// Loser losing as huge underdog = tiny penalty (min 1).

import type { TeamData } from "./types";
import { loadFromStorage } from "./storage";
import { teamDatabase } from "@/data/tournaments";

const K_BY_TIER: Record<string, number> = {
  S: 42,
  A: 32,
  B: 22,
  C: 14,
};

const MIN_WIN = 1;
const MIN_LOSS = 1;
const HARD_MAX = 60;
// Spread of expected-score curve (lower = steeper).
const SCALE = 40;
// Loser penalty is slightly softer than winner reward (VRS-style asymmetry).
const LOSS_MULTIPLIER = 0.8;

export interface VrsPrediction {
  winPoints: number;   // points the winner gains
  lossPoints: number;  // points the loser loses (positive number)
  expectedWinner: number; // 0..1 probability the team listed as "winner" wins
  upset: boolean;
}

const kFor = (tier: string) => K_BY_TIER[tier?.toUpperCase()] ?? 22;

/** Read the current ranking snapshot (saved by TournamentPanel). */
export const getRankingSnapshot = (): TeamData[] => {
  const stored = loadFromStorage<TeamData[] | null>("ranking_data", null);
  if (stored && stored.length > 0) return stored;
  return (teamDatabase as TeamData[]).map(t => ({ ...t }));
};

/** Resolve 1-based rank position. Unranked teams get the bottom rank. */
export const getTeamRank = (teamName: string, ranking: TeamData[]): number => {
  if (!teamName || teamName === "BYE" || teamName === "TBD") return ranking.length + 1;
  const sorted = [...ranking].sort((a, b) => (b.points || 0) - (a.points || 0));
  const idx = sorted.findIndex(t => t.name === teamName);
  return idx === -1 ? sorted.length + 1 : idx + 1;
};

/** Predict points exchanged between two teams given the assumed winner. */
export const predictMatch = (
  winnerTeam: string,
  loserTeam: string,
  tier: string,
  ranking: TeamData[] = getRankingSnapshot(),
): VrsPrediction => {
  const K = kFor(tier);
  const rW = getTeamRank(winnerTeam, ranking);
  const rL = getTeamRank(loserTeam, ranking);
  // Expected score (winner's probability of winning) using ELO logistic on rank diff.
  // Lower rank number = better → if rW < rL, winner is favored.
  const expectedWinner = 1 / (1 + Math.pow(10, (rW - rL) / SCALE));

  // Winner's gain ∝ surprise (1 - expectedWinner). Loser's penalty ∝ how
  // expected the win was for them (= expectedLoser = 1 - expectedWinner of
  // the winner from the loser's perspective = expectedWinner here).
  const rawWin = K * (1 - expectedWinner);
  const rawLoss = K * expectedWinner;

  const winPoints = Math.max(MIN_WIN, Math.min(HARD_MAX, Math.round(rawWin)));
  const lossPoints = Math.max(MIN_LOSS, Math.min(HARD_MAX, Math.round(rawLoss)));

  return {
    winPoints,
    lossPoints,
    expectedWinner,
    upset: expectedWinner < 0.35,
  };
};

/** Predict both outcomes for a not-yet-played match. */
export const predictBothOutcomes = (
  team1: string,
  team2: string,
  tier: string,
  ranking: TeamData[] = getRankingSnapshot(),
) => {
  return {
    team1Wins: predictMatch(team1, team2, tier, ranking),
    team2Wins: predictMatch(team2, team1, tier, ranking),
  };
};

/** Compute how a team's position shifts if its points change by delta. */
export const predictRankDelta = (
  teamName: string,
  pointsDelta: number,
  ranking: TeamData[] = getRankingSnapshot(),
): { from: number; to: number; delta: number } => {
  const currentSorted = [...ranking].sort((a, b) => (b.points || 0) - (a.points || 0));
  const from = currentSorted.findIndex(t => t.name === teamName) + 1;
  if (from === 0) return { from: ranking.length + 1, to: ranking.length + 1, delta: 0 };
  const projected = ranking.map(t =>
    t.name === teamName ? { ...t, points: Math.max(0, (t.points || 0) + pointsDelta) } : t,
  );
  const projectedSorted = [...projected].sort((a, b) => (b.points || 0) - (a.points || 0));
  const to = projectedSorted.findIndex(t => t.name === teamName) + 1;
  return { from, to, delta: from - to }; // positive = moved up
};
