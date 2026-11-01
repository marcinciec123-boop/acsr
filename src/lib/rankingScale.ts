export const getRankingAxis = (ranks: readonly number[]) => {
  const maxRank = ranks.reduce((max, rank) => Number.isFinite(rank) ? Math.max(max, rank) : max, 100);
  const upper = Math.ceil(maxRank / 25) * 25;
  const ticks = [1, ...Array.from({ length: upper / 25 }, (_, index) => (index + 1) * 25)];
  return { upper, ticks };
};