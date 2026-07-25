// ===== Frozen ranking places for finished tournaments =====
// The "Rank po" column in the final results is a historical record: once a
// tournament is completed it must never change, even if the live ranking does.

import { loadFromStorage, saveToStorage } from "./storage";

const KEY = "tournament_final_ranks";

type FrozenRanks = Record<string, Record<string, number>>;

const readAll = (): FrozenRanks => loadFromStorage<FrozenRanks | null>(KEY, null) || {};

export function getFrozenRanks(tournamentId: string): Record<string, number> | null {
  return readAll()[tournamentId] || null;
}

/** Store the ranking places for a tournament once — later calls are ignored. */
export function freezeRanks(tournamentId: string, ranks: Record<string, number>): Record<string, number> {
  const all = readAll();
  if (all[tournamentId]) return all[tournamentId];
  all[tournamentId] = ranks;
  saveToStorage(KEY, all);
  return ranks;
}
