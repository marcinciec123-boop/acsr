/**
 * Seeder for ESEA Masters 2026 (19.01.2026 – 03.02.2026, Tier A, completed).
 * Imported 1:1 from the official spreadsheets (all 30 matches + player stats).
 * Placements carry points = 0 — ranking points are NOT adjusted.
 */
import type { TournamentData } from "./types";
import { ESEA_MASTERS_2026_SEED } from "./eseaMasters2026Seed";

const SEED_VERSION_KEY = "csgo_hub_seed_esea_masters_2026_v1";
const ESEA_MASTERS_2026_ID = "esea-masters-2026";

export function seedEseaMasters2026(current: TournamentData[]): TournamentData[] {
  if (localStorage.getItem(SEED_VERSION_KEY) === "1") return current;

  const without = current.filter((t) => t.id !== ESEA_MASTERS_2026_ID);
  localStorage.setItem(SEED_VERSION_KEY, "1");
  return [...without, ...ESEA_MASTERS_2026_SEED];
}
