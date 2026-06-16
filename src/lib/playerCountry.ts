// Resolve a player's country across all known sources.
// Handles current rostered players, FAs (manual or transfer-derived), and ex-FAs
// who got re-signed onto a roster but whose nationality only lives in overrides.

import { playerNationalities } from "@/data/playerNationalities";
import { teamDatabase } from "@/data/tournaments";
import {
  loadFreeAgentNationalityOverrides,
  loadManualFreeAgents,
} from "./freeAgents";
import { getAllTransfers } from "@/data/history";
import { loadFromStorage } from "./storage";
import type { TeamData } from "./types";

let faOverrideCache: Record<string, string> | null = null;
let manualFaCache: Record<string, string> | null = null;

const ensureCaches = () => {
  if (!faOverrideCache) faOverrideCache = loadFreeAgentNationalityOverrides();
  if (!manualFaCache) {
    manualFaCache = {};
    for (const m of loadManualFreeAgents()) {
      if (m.country) manualFaCache[m.player] = m.country;
    }
  }
};

/** Invalidate caches — call after editing FA nationalities. */
export const invalidatePlayerCountryCache = () => {
  faOverrideCache = null;
  manualFaCache = null;
};

if (typeof window !== "undefined") {
  window.addEventListener("freeagents:update", invalidatePlayerCountryCache);
  window.addEventListener("transfers:update", invalidatePlayerCountryCache);
}

/**
 * Resolve a player's country code. Looks at, in order:
 * 1. static / hydrated playerNationalities map
 * 2. saved FA nationality overrides (covers ex-FAs re-signed to a roster)
 * 3. manual-FA stored country
 * 4. current team's country (from ranking_data or teamDatabase)
 * 5. previous team's country from transfer log
 */
export const resolvePlayerCountry = (player: string): string => {
  if (!player) return "";
  const direct = playerNationalities[player];
  if (direct) return direct;

  ensureCaches();
  const fa = faOverrideCache![player];
  if (fa) return fa;
  const manual = manualFaCache![player];
  if (manual) return manual;

  // current team's country
  const stored = loadFromStorage<TeamData[] | null>("ranking_data", null);
  const teams = stored && stored.length > 0 ? stored : (teamDatabase as TeamData[]);
  const onTeam = teams.find(t => t.roster?.includes(player));
  if (onTeam?.country) return onTeam.country;

  // previous team via transfer log
  const transfers = getAllTransfers().filter(t => t.player === player);
  if (transfers.length > 0) {
    const last = transfers[transfers.length - 1];
    const prev = teamDatabase.find(t => t.name === last.oldTeam);
    if (prev?.country) return prev.country;
  }

  return "";
};
