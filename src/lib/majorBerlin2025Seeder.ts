/**
 * Seeder for MAJOR Berlin 2025 + qualifiers.
 * Idempotent: only adds tournaments missing from current state.
 * Run once on app load via useEffect in TournamentPanel.
 */
import type { TournamentData } from "./types";
import { MAJOR_BERLIN_2025_SEED } from "./majorBerlin2025Seed";

const SEED_VERSION_KEY = "csgo_hub_seed_major_berlin_2025_v1";

/**
 * Merge seeded tournaments into the current list. Returns the merged list.
 * - Skips tournaments already present (by id).
 * - Marks the seed as applied in localStorage so it won't run on every reload.
 *   (User can reset by removing the marker.)
 */
export function seedMajorBerlin2025(current: TournamentData[]): TournamentData[] {
  const applied = localStorage.getItem(SEED_VERSION_KEY);
  if (applied === "1") return current;

  const existingIds = new Set(current.map((t) => t.id));
  const toAdd = MAJOR_BERLIN_2025_SEED.filter((t) => !existingIds.has(t.id));

  if (toAdd.length === 0) {
    localStorage.setItem(SEED_VERSION_KEY, "1");
    return current;
  }

  localStorage.setItem(SEED_VERSION_KEY, "1");
  return [...current, ...toAdd];
}
