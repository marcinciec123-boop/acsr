// ===== Retired players =====
// Persistent list of players moved to "emerytura sportowa".
// - Excluded from free-agent listings.
// - Excluded from PlayersPanel rows (even if still referenced in old data).
// - If a retired player was a team's coach, retirement also clears that field.

import { loadFromStorage, saveToStorage } from "./storage";
import { teamDatabase } from "@/data/tournaments";
import type { TeamData } from "./types";

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

/** Send a player to retirement. Also clears them from any team's coach slot in the live ranking. */
export function retirePlayer(player: string): void {
  const list = loadRetiredPlayers();
  if (!list.includes(player)) list.push(player);
  saveRetired(list);

  // Pull from any coach slot in ranking_data
  const stored = loadFromStorage<TeamData[] | null>("ranking_data", null);
  const teams = stored && stored.length > 0 ? stored : teamDatabase.map(t => ({ ...t }));
  let mutated = false;
  const next = teams.map(t => {
    if (t.coach === player) {
      mutated = true;
      return { ...t, coach: undefined };
    }
    return t;
  });
  if (mutated) {
    saveToStorage("ranking_data", next);
    window.dispatchEvent(new CustomEvent("teams:update"));
  }
}

export function unretirePlayer(player: string): void {
  saveRetired(loadRetiredPlayers().filter(p => p !== player));
}
