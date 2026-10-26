// ===== VRS-style per-match ranking points formula =====
// Better team beats worse team = small reward.
// Worse team upsets better team = big reward.
// Min always > 0 so even huge favorites gain something for a win.
// Loser losing as huge underdog = tiny penalty (min 1).

import type { TeamData } from "./types";
import { loadFromStorage } from "./storage";
import { teamDatabase } from "@/data/tournaments";
import { canonicalTeamName, sameName } from "./teamRenames";

// Tier multiplier applied to the base rank-diff curve.
const TIER_MULT: Record<string, number> = {
  S: 1.25,
  A: 1.0,
  B: 0.85,
  C: 0.7,
};

// Linear rank-diff curve (matches user spec):
// adjacent (~1) → ~10, 10 apart → ~15, 20 apart → ~20, 30 apart → ~25 ...

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
/** Match a ranking entry against a (possibly historical) team name. */
const isTeam = (rankName: string, teamName: string): boolean => {
  if (!rankName || !teamName) return false;
  if (rankName === teamName) return true;
  return sameName(canonicalTeamName(rankName), canonicalTeamName(teamName.trim()));
};

export const getTeamRank = (teamName: string, ranking: TeamData[]): number => {
  if (!teamName || teamName === "BYE" || teamName === "TBD") return ranking.length + 1;
  const sorted = [...ranking].sort((a, b) => (b.points || 0) - (a.points || 0));
  const idx = sorted.findIndex(t => isTeam(t.name, teamName));
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

  // Realistic CS win probability: 20 ranks apart ≈ 65/35, 50 apart ≈ 82/18.
  const expectedWinner = 1 / (1 + Math.pow(10, diff / 75));
  // Points depend ONLY on who won and opponent rank (score is irrelevant).
  // Even match: +15 / −13. Expected favourite win: small. Upset: big but capped.
  const surprise = Math.pow(1 - expectedWinner, 1.5);
  const winPoints = clamp(Math.round(45.5 * surprise * mult), 5, 50);
  const lossPoints = clamp(Math.round(33.2 * surprise * mult), 5, 45);

  return {
    winPoints,
    lossPoints,
    expectedWinner,
    upset: expectedWinner < 0.4,
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
  const from = currentSorted.findIndex(t => isTeam(t.name, teamName)) + 1;
  if (from === 0) return { from: ranking.length + 1, to: ranking.length + 1, delta: 0 };
  const projected = ranking.map(t =>
    isTeam(t.name, teamName) ? { ...t, points: Math.max(0, (t.points || 0) + pointsDelta) } : t,
  );
  const projectedSorted = [...projected].sort((a, b) => (b.points || 0) - (a.points || 0));
  const to = projectedSorted.findIndex(t => isTeam(t.name, teamName)) + 1;
  return { from, to, delta: from - to }; // positive = moved up
};

/**
 * Compute rank shifts for BOTH teams of a match at once, applying both point
 * deltas simultaneously. Needed because a loser can drop a position purely by
 * being overtaken by the team it lost to (even with a tiny point swing).
 */
export const predictRankDeltaPair = (
  teamA: string,
  deltaA: number,
  teamB: string,
  deltaB: number,
  ranking: TeamData[] = getRankingSnapshot(),
): { a: { from: number; to: number; delta: number }; b: { from: number; to: number; delta: number } } => {
  const currentSorted = [...ranking].sort((x, y) => (y.points || 0) - (x.points || 0));
  const fromA = currentSorted.findIndex(t => isTeam(t.name, teamA)) + 1;
  const fromB = currentSorted.findIndex(t => isTeam(t.name, teamB)) + 1;
  const projected = ranking.map(t => {
    if (isTeam(t.name, teamA)) return { ...t, points: Math.max(0, (t.points || 0) + deltaA) };
    if (isTeam(t.name, teamB)) return { ...t, points: Math.max(0, (t.points || 0) + deltaB) };
    return t;
  });
  const projectedSorted = [...projected].sort((x, y) => (y.points || 0) - (x.points || 0));
  const toA = projectedSorted.findIndex(t => isTeam(t.name, teamA)) + 1;
  const toB = projectedSorted.findIndex(t => isTeam(t.name, teamB)) + 1;
  const fb = (from: number, to: number) =>
    from === 0
      ? { from: ranking.length + 1, to: ranking.length + 1, delta: 0 }
      : { from, to, delta: from - to };
  return { a: fb(fromA, toA), b: fb(fromB, toB) };
};
