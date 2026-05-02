/**
 * Seeder for ESL Pro League I (full tournament: Stage 1 GSL DE groups, Stage 2 Swiss, Playoffs).
 * Idempotent: only adds the tournament if it isn't already in state.
 * Note: placements have points=0 — does NOT affect the dynamic ranking.
 */
import type { TournamentData } from "./types";
import { ESL_PRO_LEAGUE_I_SEED } from "./eslProLeagueISeed";

const SEED_VERSION_KEY = "csgo_hub_seed_esl_pro_league_i_v1";

export function seedEslProLeagueI(current: TournamentData[]): TournamentData[] {
  const applied = localStorage.getItem(SEED_VERSION_KEY);
  if (applied === "1") return current;

  const existingIds = new Set(current.map((t) => t.id));
  const toAdd = ESL_PRO_LEAGUE_I_SEED.filter((t) => !existingIds.has(t.id));

  localStorage.setItem(SEED_VERSION_KEY, "1");
  if (toAdd.length === 0) return current;
  return [...current, ...toAdd];
}
