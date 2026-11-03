/**
 * Seeder for ESL Pro League I (full tournament: Stage 1 GSL DE groups, Stage 2 Swiss, Playoffs).
 * Idempotent: only adds the tournament if it isn't already in state.
 * Note: placements have points=0 — does NOT affect the dynamic ranking.
 */
import type { TournamentData } from "./types";
import { mergeGroupPhases } from "./mergeGroupPhases";
import { ESL_PRO_LEAGUE_I_SEED } from "./eslProLeagueISeed";

const SEED_VERSION_KEY = "csgo_hub_seed_esl_pro_league_i_v4_restore_groups";
const ESL_PRO_LEAGUE_I_ID = "esl-pro-league-i-2026";

export function seedEslProLeagueI(current: TournamentData[]): TournamentData[] {
  const applied = localStorage.getItem(SEED_VERSION_KEY);
  if (applied === "1") return current;

  localStorage.setItem(SEED_VERSION_KEY, "1");
  // Never replace an existing copy: it may hold the player's own edits.
  if (current.some((t) => t.id === ESL_PRO_LEAGUE_I_ID)) return current;
  return [...current, ...ESL_PRO_LEAGUE_I_SEED.map(mergeGroupPhases)];
}
