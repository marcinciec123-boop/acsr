// ===== Free agents helper =====
// Free agents = players whose most recent transfer ended at "-" (no team).
// Pulled from the global transfer log so this matches what HistoryTab shows.

import { getAllTransfers, type Transfer } from "@/data/history";
import { playerNationalities } from "@/data/playerNationalities";
import { playerRealNames } from "@/data/playerRealNames";
import { teamDatabase } from "@/data/tournaments";
import type { TeamData } from "./types";
import { loadFromStorage } from "./storage";

export interface FreeAgent {
  player: string;
  /** Last team the player was on (may be "-" if never had one). */
  previousTeam: string;
  /** Inferred country: explicit nationality entry > previous team's country > "". */
  country: string;
  realName?: { firstName: string; lastName: string };
}

const FA_NATIONALITY_OVERRIDE_KEY = "fa_nationality_overrides";

/** Read user-set nationality overrides for free agents (persisted). */
export function loadFreeAgentNationalityOverrides(): Record<string, string> {
  return loadFromStorage<Record<string, string>>(FA_NATIONALITY_OVERRIDE_KEY, {});
}

/** Save a single nationality override for a free agent. */
export function setFreeAgentNationality(player: string, code: string): void {
  const cur = loadFreeAgentNationalityOverrides();
  if (code) cur[player] = code.toUpperCase();
  else delete cur[player];
  // Write directly via storage (mirrors saveToStorage in lib/storage.ts).
  try {
    localStorage.setItem(FA_NATIONALITY_OVERRIDE_KEY, JSON.stringify(cur));
  } catch {/* ignore */}
  // Also patch the in-memory map so other components pick it up immediately.
  if (code) playerNationalities[player] = code.toUpperCase();
}

/**
 * Compute the current free-agent list from the transfer log.
 *
 * The current ranking source ("ranking_data" in localStorage) wins over the
 * static teamDatabase, so a player promoted onto a roster via the ranking
 * editor is no longer counted as FA.
 */
export function getFreeAgents(): FreeAgent[] {
  const overrides = loadFreeAgentNationalityOverrides();
  // Apply overrides into the in-memory nationalities map so other consumers
  // (PlayerProfile, RankingPanel search) also see them.
  Object.entries(overrides).forEach(([p, c]) => {
    if (!playerNationalities[p]) playerNationalities[p] = c;
  });

  const stored = loadFromStorage<TeamData[] | null>("ranking_data", null);
  const teams = stored && stored.length > 0 ? stored : teamDatabase;
  const onAnyRoster = new Set<string>();
  teams.forEach(t => t.roster.forEach(p => onAnyRoster.add(p)));

  const allTransfers: Transfer[] = getAllTransfers();
  const lastTransfer: Record<string, Transfer> = {};
  for (const t of allTransfers) lastTransfer[t.player] = t;

  const out: FreeAgent[] = [];
  for (const t of Object.values(lastTransfer)) {
    if (t.newTeam !== "-") continue;
    // If the player has been re-rostered later via another source, skip.
    if (onAnyRoster.has(t.player)) continue;
    // Country fallback: explicit > override > previous team's country
    const prevTeam = teamDatabase.find(x => x.name === t.oldTeam);
    const country =
      playerNationalities[t.player] ||
      overrides[t.player] ||
      prevTeam?.country ||
      "";
    out.push({
      player: t.player,
      previousTeam: t.oldTeam,
      country,
      realName: playerRealNames[t.player],
    });
  }
  return out.sort((a, b) => a.player.localeCompare(b.player));
}
