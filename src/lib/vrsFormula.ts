// ===== VRS-style per-match ranking points formula =====
// Better team beats worse team = small reward.
// Worse team upsets better team = big reward.
// Min always > 0 so even huge favorites gain something for a win.
// Loser losing as huge underdog = tiny penalty (min 1).

import type { TeamData } from "./types";
import { loadFromStorage } from "./storage";
import { teamDatabase } from "@/data/tournaments";

// Tier multiplier applied to the base rank-diff curve.
const TIER_MULT: Record<string, number> = {
  S: 1.25,
  A: 1.0,
  B: 0.85,
  C: 0.7,
};

// Linear rank-diff curve (matches user spec):
// adjacent (~1) → ~10, 10 apart → ~15, 20 apart → ~20, 30 apart → ~25 ...
const WIN_BASE = 10;
const WIN_PER_RANK = 0.42;  // upset slope (worse beats better) — łagodniejszy spread
const WIN_FAV_SLOPE = 0.2;  // favorite-win decay — mniej stromy: bicie słabszych daje więcej
const LOSS_BASE = 6;
const LOSS_UPSET_SLOPE = 0.24;  // łagodniejsza kara dla faworyta który przegrał
const LOSS_EXPECTED_SLOPE = 0.28; // wolniejszy zanik kary dla underdoga

const WIN_MIN = 6;
const WIN_MAX = 70;
const LOSS_MIN = 4;
const LOSS_MAX = 40;

export interface VrsPrediction {
  winPoints: number;
  lossPoints: number;
  expectedWinner: number; // 0..1 probability the listed "winner" wins
  upset: boolean;
}

const tierMult = (tier: string) => TIER_MULT[tier?.toUpperCase()] ?? 0.85;

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

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Predict points exchanged between two teams given the assumed winner. */
export const predictMatch = (
  winnerTeam: string,
  loserTeam: string,
  tier: string,
  ranking: TeamData[] = getRankingSnapshot(),
): VrsPrediction => {
  const mult = tierMult(tier);
  const rW = getTeamRank(winnerTeam, ranking);
  const rL = getTeamRank(loserTeam, ranking);
  // Signed rank difference: positive = upset (winner is worse-ranked).
  const diff = rW - rL;

  let rawWin: number;
  let rawLoss: number;
  if (diff >= 0) {
    // Upset: worse beats better. Both winner reward & loser penalty grow with diff.
    rawWin = WIN_BASE + WIN_PER_RANK * diff;
    rawLoss = LOSS_BASE + LOSS_UPSET_SLOPE * diff;
  } else {
    // Favorite win: rewards decay with how expected it was.
    const gap = -diff;
    rawWin = WIN_BASE - WIN_FAV_SLOPE * gap;
    rawLoss = LOSS_BASE - LOSS_EXPECTED_SLOPE * gap;
  }

  const winPoints = clamp(Math.round(rawWin * mult), WIN_MIN, WIN_MAX);
  const lossPoints = clamp(Math.round(rawLoss * mult), LOSS_MIN, LOSS_MAX);

  // Rough win-probability proxy for "upset" flag (logistic over rank diff).
  const expectedWinner = 1 / (1 + Math.pow(10, diff / 30));

  return {
    winPoints,
    lossPoints,
    expectedWinner,
    upset: diff > 8,
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
