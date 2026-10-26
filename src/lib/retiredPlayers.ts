// ===== Retired players =====
// Persistent list of players moved to "emerytura sportowa".
// - Excluded from free-agent listings.
// - Excluded from PlayersPanel rows (even if still referenced in old data).
// - If a retired player was a team's coach, retirement also clears that field.

import { loadFromStorage, saveToStorage } from "./storage";
import { teamDatabase } from "@/data/tournaments";
import type { TeamData } from "./types";
import { persistCurrentRosters } from "./changeLog";
import { removeFromAllBenches } from "./benchedPlayers";
import { terminateContract } from "./contracts";

const RETIRED_KEY = "retired_players";

export function loadRetiredPlayers(): string[] {
  return loadFromStorage<string[]>(RETIRED_KEY, []);
}

export function isRetired(player: string): boolean {
  return loadRetiredPlayers().includes(player);
}

function saveRetired(list: string[]): void {
  saveToStorage(RETIRED_KEY, Array.from(new Set(list)));
  window.dispatchEvent(new CustomEvent("teams:update"));
}

const DELETED_KEY = "deleted_players";

export function loadDeletedPlayers(): string[] {
  return loadFromStorage<string[]>(DELETED_KEY, []);
}

/** Retired + permanently deleted — everyone hidden from player/FA lists. */
export function loadHiddenPlayers(): string[] {
  return [...loadRetiredPlayers(), ...loadDeletedPlayers()];
}

/**
 * Send a player to retirement: removes them from every roster, coach slot and
 * bench, and closes their active contract so no salary keeps being paid.
 */
export function retirePlayer(player: string): void {
  const list = loadRetiredPlayers();
  if (!list.includes(player)) list.push(player);
  saveToStorage(RETIRED_KEY, Array.from(new Set(list)));
  detachPlayer(player);
}

/** Permanently delete a player/coach from the database — NOT added to the Hall of Fame. */
export function deletePlayer(player: string): void {
  const list = loadDeletedPlayers();
  if (!list.includes(player)) list.push(player);
  saveToStorage(DELETED_KEY, Array.from(new Set(list)));
  // Make sure they don't appear in the Hall of Fame either.
  const retired = loadRetiredPlayers();
  if (retired.includes(player)) saveToStorage(RETIRED_KEY, retired.filter(p => p !== player));
  detachPlayer(player);
}

function detachPlayer(player: string): void {


  // Runtime master roster
  let runtimeMutated = false;
  for (const t of teamDatabase) {
    if (t.roster?.includes(player)) {
      t.roster = t.roster.filter(p => p !== player);
      runtimeMutated = true;
    }
    if (t.coach === player) {
      t.coach = undefined;
      runtimeMutated = true;
    }
  }
  if (runtimeMutated) persistCurrentRosters();

  // Live ranking
  const stored = loadFromStorage<TeamData[] | null>("ranking_data", null);
  if (stored && stored.length > 0) {
    let mutated = false;
    const next = stored.map(t => {
      const inRoster = (t.roster || []).includes(player);
      const isCoach = t.coach === player;
      if (!inRoster && !isCoach) return t;
      mutated = true;
      return {
        ...t,
        roster: (t.roster || []).filter(p => p !== player),
        coach: isCoach ? undefined : t.coach,
      };
    });
    if (mutated) saveToStorage("ranking_data", next);
  }

  removeFromAllBenches(player);
  terminateContract(player, "release");

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("teams:update"));
    window.dispatchEvent(new CustomEvent("players:update"));
    window.dispatchEvent(new CustomEvent("bench:update"));
  }
}

export function unretirePlayer(player: string): void {
  saveRetired(loadRetiredPlayers().filter(p => p !== player));
}
