import { playerNationalities } from "@/data/playerNationalities";
import { playerRealNames } from "@/data/playerRealNames";
import { playerRoles, type PlayerRole } from "@/data/playerRoles";
import { normalizeCountry } from "./flags";
import { loadFromStorage, saveToStorage } from "./storage";

const PLAYER_ROLE_OVERRIDE_KEY = "player_role_overrides";
const PLAYER_NAT_OVERRIDE_KEY = "player_nat_overrides";
const PLAYER_REALNAME_OVERRIDE_KEY = "player_realname_overrides";

const defaultPlayerNationalities = { ...playerNationalities };
const defaultPlayerRoles = { ...playerRoles };
const defaultPlayerRealNames = { ...playerRealNames };

export function loadPlayerRoleOverrides(): Record<string, PlayerRole> {
  return loadFromStorage<Record<string, PlayerRole>>(PLAYER_ROLE_OVERRIDE_KEY, {});
}

export function savePlayerRoleOverrides(map: Record<string, PlayerRole>): void {
  saveToStorage(PLAYER_ROLE_OVERRIDE_KEY, map);
}

export function loadPlayerNatOverrides(): Record<string, string> {
  return loadFromStorage<Record<string, string>>(PLAYER_NAT_OVERRIDE_KEY, {});
}

export function savePlayerNatOverrides(map: Record<string, string>): void {
  saveToStorage(PLAYER_NAT_OVERRIDE_KEY, map);
}

export function loadPlayerRealnameOverrides(): Record<string, { firstName: string; lastName: string }> {
  return loadFromStorage<Record<string, { firstName: string; lastName: string }>>(PLAYER_REALNAME_OVERRIDE_KEY, {});
}

export function savePlayerRealnameOverrides(
  map: Record<string, { firstName: string; lastName: string }>,
): void {
  saveToStorage(PLAYER_REALNAME_OVERRIDE_KEY, map);
}

export function coercePlayerCountry(code: string | undefined | null): string {
  if (!code) return "";
  const raw = code.trim().toUpperCase();
  return normalizeCountry(raw) || raw.slice(0, 2);
}

export interface PersistPlayerMetadataInput {
  country?: string | null;
  role?: PlayerRole | "" | null;
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Permanent person metadata store used by rosters, coaches and free agents.
 * This is intentionally player-wide, so a manually created FA keeps country,
 * real name and role after signing, reloads, or later coach transfers.
 */
export function persistPlayerMetadata(player: string, input: PersistPlayerMetadataInput): void {
  const nick = player.trim();
  if (!nick) return;

  if (input.country !== undefined) {
    const country = coercePlayerCountry(input.country);
    const cur = loadPlayerNatOverrides();
    if (country) {
      cur[nick] = country;
      playerNationalities[nick] = country;
    } else {
      delete cur[nick];
      if (defaultPlayerNationalities[nick]) playerNationalities[nick] = defaultPlayerNationalities[nick];
      else delete playerNationalities[nick];
    }
    savePlayerNatOverrides(cur);
  }

  if (input.role !== undefined) {
    const cur = loadPlayerRoleOverrides();
    if (input.role) {
      cur[nick] = input.role;
      playerRoles[nick] = input.role;
    } else {
      delete cur[nick];
      if (defaultPlayerRoles[nick]) playerRoles[nick] = defaultPlayerRoles[nick];
      else delete playerRoles[nick];
    }
    savePlayerRoleOverrides(cur);

    // Synchronizuj magazyny wolnych agentów, żeby rola była spójna
    // w panelu FA, profilu gracza i liście graczy (klucze z freeAgents.ts).
    const faRoleOv = loadFromStorage<Record<string, PlayerRole>>("fa_role_overrides", {});
    if (input.role) faRoleOv[nick] = input.role;
    else delete faRoleOv[nick];
    saveToStorage("fa_role_overrides", faRoleOv);

    const manualFAs = loadFromStorage<Array<{ player: string; role?: PlayerRole }>>("manual_free_agents", []);
    const faIdx = manualFAs.findIndex(f => f.player.toLowerCase() === nick.toLowerCase());
    if (faIdx !== -1) {
      if (input.role) manualFAs[faIdx] = { ...manualFAs[faIdx], role: input.role };
      else delete manualFAs[faIdx].role;
      saveToStorage("manual_free_agents", manualFAs);
    }
    window.dispatchEvent(new CustomEvent("players:update"));
  }

  if (input.firstName !== undefined || input.lastName !== undefined) {
    const firstName = (input.firstName ?? "").trim();
    const lastName = (input.lastName ?? "").trim();
    const cur = loadPlayerRealnameOverrides();
    if (firstName || lastName) {
      cur[nick] = { firstName, lastName };
      playerRealNames[nick] = { firstName, lastName };
    } else {
      delete cur[nick];
      if (defaultPlayerRealNames[nick]) playerRealNames[nick] = defaultPlayerRealNames[nick];
      else delete playerRealNames[nick];
    }
    savePlayerRealnameOverrides(cur);
  }
}

export function applyPlayerMetadataOverrides(): void {
  Object.entries(loadPlayerRoleOverrides()).forEach(([p, r]) => { playerRoles[p] = r; });
  Object.entries(loadPlayerNatOverrides()).forEach(([p, c]) => { playerNationalities[p] = c; });
  Object.entries(loadPlayerRealnameOverrides()).forEach(([p, n]) => { playerRealNames[p] = n; });
}