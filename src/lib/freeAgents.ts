// ===== Free agents helper =====
// Free agents = players whose most recent transfer ended at "-" (no team).
// Pulled from the global transfer log so this matches what HistoryTab shows.
//
// Additionally we support MANUALLY added FAs (no transfer history needed).
// They are persisted under "manual_free_agents" (raw localStorage key handled
// by storage.ts prefix). Each manual FA may also override its role / real
// name / nationality which are otherwise read-only static data.

import { getAllTransfers, type Transfer } from "@/data/history";
import { playerNationalities } from "@/data/playerNationalities";
import { playerRealNames } from "@/data/playerRealNames";
import { playerRoles, type PlayerRole } from "@/data/playerRoles";
import { teamDatabase } from "@/data/tournaments";
import type { TeamData } from "./types";
import { loadFromStorage, saveToStorage } from "./storage";
import { normalizeCountry } from "./flags";
import { coercePlayerCountry, persistPlayerMetadata } from "./playerMetadata";

export interface FreeAgent {
  player: string;
  /** Last team the player was on (may be "-" if never had one or "" for manual FAs). */
  previousTeam: string;
  /** Inferred country: explicit nationality entry > previous team's country > "". */
  country: string;
  realName?: { firstName: string; lastName: string };
  role?: PlayerRole;
  /** True when this FA was created manually via the "+ wolny agent" button. */
  manual?: boolean;
}

const FA_NATIONALITY_OVERRIDE_KEY = "fa_nationality_overrides";
const MANUAL_FA_KEY = "manual_free_agents";
const FA_ROLE_OVERRIDE_KEY = "fa_role_overrides";
const FA_REALNAME_OVERRIDE_KEY = "fa_realname_overrides";

interface ManualFA {
  player: string;
  country: string;
  role?: PlayerRole;
  firstName?: string;
  lastName?: string;
}

// ---------- nationality overrides ----------

/** Read user-set nationality overrides for free agents (persisted). */
export function loadFreeAgentNationalityOverrides(): Record<string, string> {
  return loadFromStorage<Record<string, string>>(FA_NATIONALITY_OVERRIDE_KEY, {});
}

/** Save a single nationality override for a free agent. */
export function setFreeAgentNationality(player: string, code: string): void {
  const cur = loadFreeAgentNationalityOverrides();
  const country = coercePlayerCountry(code);
  if (country) cur[player] = country;
  else delete cur[player];
  saveToStorage(FA_NATIONALITY_OVERRIDE_KEY, cur);
  persistPlayerMetadata(player, { country });
}

// ---------- role / realname overrides ----------

export function loadFreeAgentRoleOverrides(): Record<string, PlayerRole> {
  return loadFromStorage<Record<string, PlayerRole>>(FA_ROLE_OVERRIDE_KEY, {});
}

export function setFreeAgentRole(player: string, role: PlayerRole | ""): void {
  const cur = loadFreeAgentRoleOverrides();
  if (role) cur[player] = role;
  else delete cur[player];
  saveToStorage(FA_ROLE_OVERRIDE_KEY, cur);
  persistPlayerMetadata(player, { role });
}

export function loadFreeAgentRealNameOverrides(): Record<string, { firstName: string; lastName: string }> {
  return loadFromStorage<Record<string, { firstName: string; lastName: string }>>(FA_REALNAME_OVERRIDE_KEY, {});
}

export function setFreeAgentRealName(player: string, firstName: string, lastName: string): void {
  const cur = loadFreeAgentRealNameOverrides();
  if (firstName || lastName) cur[player] = { firstName, lastName };
  else delete cur[player];
  saveToStorage(FA_REALNAME_OVERRIDE_KEY, cur);
  persistPlayerMetadata(player, { firstName, lastName });
}

// ---------- manual FAs ----------

export function loadManualFreeAgents(): ManualFA[] {
  return loadFromStorage<ManualFA[]>(MANUAL_FA_KEY, []);
}

function saveManualFreeAgents(list: ManualFA[]): void {
  saveToStorage(MANUAL_FA_KEY, list);
}

export interface AddFreeAgentInput {
  player: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  role?: PlayerRole;
}

/** Add a brand new manual FA. Returns false if nickname already exists. */
export function addManualFreeAgent(input: AddFreeAgentInput): boolean {
  const nick = input.player.trim();
  if (!nick) return false;
  const list = loadManualFreeAgents();
  if (list.some(f => f.player.toLowerCase() === nick.toLowerCase())) return false;
  // Also avoid clashes with rostered / transferred players
  const storedTeams = loadFromStorage<TeamData[] | null>("ranking_data", null);
  const teams = storedTeams && storedTeams.length > 0 ? storedTeams : teamDatabase;
  for (const t of teams) {
    if (t.roster.includes(nick) || t.coach === nick) return false;
  }

  const country = coercePlayerCountry(input.country || "");
  const role = input.role;

  list.push({
    player: nick,
    country,
    role,
    firstName: input.firstName?.trim(),
    lastName: input.lastName?.trim(),
  });
  saveManualFreeAgents(list);

  if (country && !playerNationalities[nick]) setFreeAgentNationality(nick, country);
  if (role) setFreeAgentRole(nick, role);
  if (input.firstName || input.lastName) {
    setFreeAgentRealName(nick, input.firstName?.trim() || "", input.lastName?.trim() || "");
  }
  return true;
}

/** Remove a manual FA entry. By default this is a delete action and clears FA-only overrides.
 *  Transfer signing uses clearOverrides=false so nationality/real name/role survive after joining a team. */
export function removeManualFreeAgent(player: string, options: { clearOverrides?: boolean } = {}): void {
  const { clearOverrides = true } = options;
  const list = loadManualFreeAgents().filter(f => f.player !== player);
  saveManualFreeAgents(list);
  if (clearOverrides) {
    setFreeAgentNationality(player, "");
    setFreeAgentRole(player, "");
    setFreeAgentRealName(player, "", "");
  }
}

/** Patch an existing FA. Works for both manual entries and transfer-derived FAs
 *  (in the latter case only the override stores are updated). */
export function updateManualFreeAgent(
  player: string,
  patch: Partial<Omit<ManualFA, "player">>,
): void {
  const list = loadManualFreeAgents();
  const idx = list.findIndex(f => f.player === player);

  if (idx !== -1) {
    list[idx] = { ...list[idx], ...patch };
    saveManualFreeAgents(list);
  }

  if (patch.country !== undefined) setFreeAgentNationality(player, patch.country || "");
  if (patch.role !== undefined) setFreeAgentRole(player, patch.role || "");
  if (patch.firstName !== undefined || patch.lastName !== undefined) {
    const base = idx !== -1 ? list[idx] : { firstName: "", lastName: "" };
    setFreeAgentRealName(
      player,
      (patch.firstName ?? base.firstName ?? ""),
      (patch.lastName ?? base.lastName ?? ""),
    );
  }
}

// ---------- main FA list ----------

/**
 * Compute the current free-agent list from the transfer log + manual entries.
 *
 * The current ranking source ("ranking_data" in localStorage) wins over the
 * static teamDatabase, so a player promoted onto a roster via the ranking
 * editor is no longer counted as FA.
 */
export function getFreeAgents(): FreeAgent[] {
  // Hydrate in-memory maps from overrides so other components see them.
  const natOv = loadFreeAgentNationalityOverrides();
  Object.entries(natOv).forEach(([p, c]) => { playerNationalities[p] = c; });
  const roleOv = loadFreeAgentRoleOverrides();
  Object.entries(roleOv).forEach(([p, r]) => { playerRoles[p] = r; });
  const nameOv = loadFreeAgentRealNameOverrides();
  Object.entries(nameOv).forEach(([p, n]) => { playerRealNames[p] = n; });

  const stored = loadFromStorage<TeamData[] | null>("ranking_data", null);
  const teams = stored && stored.length > 0 ? stored : teamDatabase;
  const onAnyRoster = new Set<string>();
  teams.forEach(t => {
    t.roster.forEach(p => onAnyRoster.add(p));
    if (t.coach) onAnyRoster.add(t.coach);
  });


  const out: FreeAgent[] = [];
  const seen = new Set<string>();

  // Manual FAs first (they take precedence so edits stick).
  for (const m of loadManualFreeAgents()) {
    if (onAnyRoster.has(m.player)) continue;
    seen.add(m.player);
    const country = normalizeCountry(m.country || playerNationalities[m.player] || "");
    const realName = (m.firstName || m.lastName)
      ? { firstName: m.firstName || "", lastName: m.lastName || "" }
      : playerRealNames[m.player];
    out.push({
      player: m.player,
      previousTeam: "-",
      country,
      realName,
      role: m.role || playerRoles[m.player],
      manual: true,
    });
  }

  // Transfer-derived FAs (last transfer to "-").
  const allTransfers: Transfer[] = getAllTransfers();
  const lastTransfer: Record<string, Transfer> = {};
  for (const t of allTransfers) lastTransfer[t.player] = t;

  for (const t of Object.values(lastTransfer)) {
    if (t.newTeam !== "-") continue;
    if (onAnyRoster.has(t.player)) continue;
    if (seen.has(t.player)) continue;
    const prevTeam = teamDatabase.find(x => x.name === t.oldTeam);
    const country = normalizeCountry(
      playerNationalities[t.player] ||
      natOv[t.player] ||
      prevTeam?.country ||
      "",
    );
    out.push({
      player: t.player,
      previousTeam: t.oldTeam,
      country,
      realName: playerRealNames[t.player],
      role: playerRoles[t.player],
    });
  }
  return out.sort((a, b) => a.player.localeCompare(b.player));
}
