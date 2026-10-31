export type RankingTier = "S" | "A" | "B" | "C";

/** Ranked clubs have no lower position limit; unranked entries use null. */
export const getRankingTier = (rank: number): RankingTier | null => {
  if (!Number.isInteger(rank) || rank < 1) return null;
  if (rank <= 10) return "S";
  if (rank <= 25) return "A";
  if (rank <= 50) return "B";
  return "C";
};