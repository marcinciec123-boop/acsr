// ===== Database change log =====
// Tracks every mutation made to the persistent database (transfers, FAs,
// role/nationality/realname edits) so the user can review history and
// revert the database to a previous point in time.
//
// Persisted as a single localStorage entry (key: "change_log") via the
// shared storage helper. Each entry carries a "before" snapshot of the
// affected slice of state so a revert can undo it.

import { loadFromStorage, saveToStorage } from "./storage";
import { customTransfersGlobal, type Transfer } from "@/data/history";
import { teamDatabase } from "@/data/tournaments";
import { playerNationalities } from "@/data/playerNationalities";
import { playerRealNames } from "@/data/playerRealNames";
import { playerRoles, type PlayerRole } from "@/data/playerRoles";
import {
  loadManualFreeAgents,
  loadFreeAgentNationalityOverrides,
  loadFreeAgentRoleOverrides,
  loadFreeAgentRealNameOverrides,
} from "./freeAgents";

const CHANGE_LOG_KEY = "change_log";
const ROSTER_OVERRIDE_KEY = "roster_overrides";
const COACH_OVERRIDE_KEY = "coach_overrides";
const PLAYER_ROLE_OVERRIDE_KEY = "player_role_overrides";
const PLAYER_NAT_OVERRIDE_KEY = "player_nat_overrides";
const PLAYER_REALNAME_OVERRIDE_KEY = "player_realname_overrides";

export type ChangeKind =
  | "transfer"
  | "fa-add"
  | "fa-remove"
  | "fa-edit"
  | "role"
  | "nationality"
  | "realname";

export interface DatabaseSnapshot {
  rosters: Record<string, string[]>;
  coaches: Record<string, string | undefined>;
  customTransfers: Transfer[];
  manualFAs: ReturnType<typeof loadManualFreeAgents>;
  faNatOverrides: Record<string, string>;
  faRoleOverrides: Record<string, PlayerRole>;
  faRealnameOverrides: Record<string, { firstName: string; lastName: string }>;
  playerRoleOverrides: Record<string, PlayerRole>;
  playerNatOverrides: Record<string, string>;
  playerRealnameOverrides: Record<string, { firstName: string; lastName: string }>;
}

export interface ChangeLogEntry {
  id: string;
  ts: number;
  kind: ChangeKind;
  description: string;
  /** Snapshot of the database state taken BEFORE this change was applied. */
  before: DatabaseSnapshot;
}

// ----------------- snapshot helpers -----------------

export function captureSnapshot(): DatabaseSnapshot {
  return {
    rosters: Object.fromEntries(
      teamDatabase.map(t => [t.name, [...t.roster]]),
    ),
    coaches: Object.fromEntries(
      teamDatabase.map(t => [t.name, t.coach]),
    ),
    customTransfers: customTransfersGlobal.map(t => ({ ...t })),
    manualFAs: loadManualFreeAgents().map(f => ({ ...f })),
    faNatOverrides: { ...loadFreeAgentNationalityOverrides() },
    faRoleOverrides: { ...loadFreeAgentRoleOverrides() },
    faRealnameOverrides: { ...loadFreeAgentRealNameOverrides() },
    playerRoleOverrides: { ...loadPlayerRoleOverrides() },
    playerNatOverrides: { ...loadPlayerNatOverrides() },
    playerRealnameOverrides: { ...loadPlayerRealnameOverrides() },
  };
}

/** Restore the database in-memory + localStorage from a snapshot. */
export function restoreSnapshot(snap: DatabaseSnapshot): void {
  // Rosters + coaches
  for (const t of teamDatabase) {
    const r = snap.rosters[t.name];
    if (r) t.roster = [...r];
    if (snap.coaches && t.name in snap.coaches) t.coach = snap.coaches[t.name];
  }
  saveRosterOverrides(snap.rosters);
  saveCoachOverrides(snap.coaches || {});

  // Custom transfers
  customTransfersGlobal.length = 0;
  snap.customTransfers.forEach(t => customTransfersGlobal.push({ ...t }));
  saveToStorage("custom_transfers", customTransfersGlobal);

  // FA-related stores
  saveToStorage("manual_free_agents", snap.manualFAs);
  saveToStorage("fa_nationality_overrides", snap.faNatOverrides);
  saveToStorage("fa_role_overrides", snap.faRoleOverrides);
  saveToStorage("fa_realname_overrides", snap.faRealnameOverrides);

  // Player-wide overrides
  savePlayerRoleOverrides(snap.playerRoleOverrides);
  savePlayerNatOverrides(snap.playerNatOverrides);
  savePlayerRealnameOverrides(snap.playerRealnameOverrides);

  // Re-hydrate in-memory dictionaries so UI sees the change without reload
  Object.entries(snap.faNatOverrides).forEach(([p, c]) => { playerNationalities[p] = c; });
  Object.entries(snap.faRoleOverrides).forEach(([p, r]) => { playerRoles[p] = r; });
  Object.entries(snap.faRealnameOverrides).forEach(([p, n]) => { playerRealNames[p] = n; });
  Object.entries(snap.playerRoleOverrides).forEach(([p, r]) => { playerRoles[p] = r; });
  Object.entries(snap.playerNatOverrides).forEach(([p, c]) => { playerNationalities[p] = c; });
  Object.entries(snap.playerRealnameOverrides).forEach(([p, n]) => { playerRealNames[p] = n; });
}

// ----------------- change log persistence -----------------

export function loadChangeLog(): ChangeLogEntry[] {
  return loadFromStorage<ChangeLogEntry[]>(CHANGE_LOG_KEY, []);
}

export function saveChangeLog(log: ChangeLogEntry[]): void {
  // Cap length so localStorage doesn't blow up — keep the last 500.
  const capped = log.slice(-500);
  saveToStorage(CHANGE_LOG_KEY, capped);
}

/**
 * Record a change. Pass the snapshot taken BEFORE you applied the mutation,
 * plus a kind + human description.
 */
export function recordChange(
  kind: ChangeKind,
  description: string,
  before: DatabaseSnapshot,
): ChangeLogEntry {
  const entry: ChangeLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    kind,
    description,
    before,
  };
  const log = loadChangeLog();
  log.push(entry);
  saveChangeLog(log);
  return entry;
}

/**
 * Convenience: take a snapshot, run the mutation, then record a log entry.
 */
export function withChangeLog<T>(
  kind: ChangeKind,
  description: string,
  mutate: () => T,
): T {
  const before = captureSnapshot();
  const result = mutate();
  recordChange(kind, description, before);
  return result;
}

/**
 * Revert the database to the state BEFORE the given log entry.
 * All entries from that point forward are removed.
 */
export function revertTo(entryId: string): boolean {
  const log = loadChangeLog();
  const idx = log.findIndex(e => e.id === entryId);
  if (idx === -1) return false;
  restoreSnapshot(log[idx].before);
  // Drop this entry and everything after it.
  saveChangeLog(log.slice(0, idx));
  return true;
}

/** Wipe the change log without reverting anything. */
export function clearChangeLog(): void {
  saveChangeLog([]);
}

// ----------------- roster persistence -----------------

export function loadRosterOverrides(): Record<string, string[]> {
  return loadFromStorage<Record<string, string[]>>(ROSTER_OVERRIDE_KEY, {});
}

export function saveRosterOverrides(map: Record<string, string[]>): void {
  saveToStorage(ROSTER_OVERRIDE_KEY, map);
}

export function loadCoachOverrides(): Record<string, string | undefined> {
  return loadFromStorage<Record<string, string | undefined>>(COACH_OVERRIDE_KEY, {});
}

export function saveCoachOverrides(map: Record<string, string | undefined>): void {
  saveToStorage(COACH_OVERRIDE_KEY, map);
}

/** Persist the current state of teamDatabase rosters + coaches. */
export function persistCurrentRosters(): void {
  const rosters: Record<string, string[]> = {};
  const coaches: Record<string, string | undefined> = {};
  for (const t of teamDatabase) {
    rosters[t.name] = [...t.roster];
    coaches[t.name] = t.coach;
  }
  saveRosterOverrides(rosters);
  saveCoachOverrides(coaches);

  // Mirror into ranking_data so all reads (PlayersPanel, TeamLogo, TeamProfile)
  // see the same coach — this is the authoritative source in most panels.
  try {
    const ranking = loadFromStorage<Array<{ name: string; coach?: string; roster?: string[] }> | null>("ranking_data", null);
    if (ranking && ranking.length > 0) {
      const patched = ranking.map(team => ({
        ...team,
        coach: team.name in coaches ? coaches[team.name] : team.coach,
        roster: rosters[team.name] ? [...rosters[team.name]] : team.roster,
      }));
      saveToStorage("ranking_data", patched);
    }
  } catch (e) {
    console.warn("Failed to mirror rosters into ranking_data:", e);
  }
}

// ----------------- player-wide overrides -----------------

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

// ----------------- public mutators (with logging) -----------------

/** Set role for any player (rostered or FA). Persists + logs. */
export function setPlayerRole(player: string, role: PlayerRole | ""): void {
  const before = captureSnapshot();
  const cur = loadPlayerRoleOverrides();
  const oldRole = playerRoles[player] || "—";
  if (role) {
    cur[player] = role;
    playerRoles[player] = role;
  } else {
    delete cur[player];
    // Best-effort: clear in-memory only if it was an override; static defaults
    // get re-read after revert anyway via snapshot restore.
  }
  savePlayerRoleOverrides(cur);
  recordChange(
    "role",
    `Rola: ${player} ${oldRole} → ${role || "—"}`,
    before,
  );
}

/** Set nationality for any player. */
export function setPlayerNationality(player: string, code: string): void {
  const before = captureSnapshot();
  const cur = loadPlayerNatOverrides();
  const oldCode = playerNationalities[player] || "—";
  const c = code.trim().toUpperCase().slice(0, 2);
  if (c) {
    cur[player] = c;
    playerNationalities[player] = c;
  } else {
    delete cur[player];
  }
  savePlayerNatOverrides(cur);
  recordChange(
    "nationality",
    `Narodowość: ${player} ${oldCode} → ${c || "—"}`,
    before,
  );
}

/** Set real name for any player. */
export function setPlayerRealName(player: string, firstName: string, lastName: string): void {
  const before = captureSnapshot();
  const cur = loadPlayerRealnameOverrides();
  const fn = firstName.trim();
  const ln = lastName.trim();
  if (fn || ln) {
    cur[player] = { firstName: fn, lastName: ln };
    playerRealNames[player] = { firstName: fn, lastName: ln };
  } else {
    delete cur[player];
  }
  savePlayerRealnameOverrides(cur);
  recordChange(
    "realname",
    `Imię i nazwisko: ${player} → ${fn} ${ln}`.trim(),
    before,
  );
}

// ----------------- bootstrap -----------------

/**
 * Hydrate in-memory state from localStorage. Call once at app start.
 * - Replays persisted custom transfers into customTransfersGlobal.
 * - Restores per-team roster overrides into teamDatabase.
 * - Re-applies player overrides into the static maps.
 */
export function bootstrapPersistedState(): void {
  // Team name overrides — apply FIRST so subsequent lookups use current names.
  const nameOv = loadFromStorage<Record<string, string>>("team_name_overrides", {});
  if (Object.keys(nameOv).length > 0) {
    for (const t of teamDatabase) {
      if (nameOv[t.name]) t.name = nameOv[t.name];
    }
  }

  // Custom transfers
  const persistedTransfers = loadFromStorage<Transfer[]>("custom_transfers", []);
  if (persistedTransfers.length > 0 && customTransfersGlobal.length === 0) {
    persistedTransfers.forEach(t => customTransfersGlobal.push({ ...t }));
  }

  // Roster + coach overrides
  const rosters = loadRosterOverrides();
  const coaches = loadCoachOverrides();
  const hasRosters = Object.keys(rosters).length > 0;
  const hasCoaches = Object.keys(coaches).length > 0;
  if (hasRosters || hasCoaches) {
    for (const t of teamDatabase) {
      if (hasRosters && rosters[t.name]) t.roster = [...rosters[t.name]];
      if (hasCoaches && t.name in coaches) t.coach = coaches[t.name];
    }
  }

  // Also propagate coach + roster overrides into `ranking_data` snapshot
  // so components that read from it (PlayersPanel, TeamLogo, RankingPanel)
  // see the same coach as teamDatabase across sessions.
  try {
    const ranking = loadFromStorage<Array<{ name: string; roster?: string[]; coach?: string }> | null>("ranking_data", null);
    if (ranking && ranking.length > 0 && (hasRosters || hasCoaches)) {
      let touched = false;
      const patched = ranking.map(team => {
        let next = team;
        if (hasRosters && rosters[team.name]) {
          next = { ...next, roster: [...rosters[team.name]] };
          touched = true;
        }
        if (hasCoaches && team.name in coaches) {
          next = { ...next, coach: coaches[team.name] };
          touched = true;
        }
        return next;
      });
      if (touched) saveToStorage("ranking_data", patched);
    }
  } catch (e) {
    console.warn("Failed to sync coach overrides into ranking_data:", e);
  }

  // Player-wide overrides
  Object.entries(loadPlayerRoleOverrides()).forEach(([p, r]) => { playerRoles[p] = r; });
  Object.entries(loadPlayerNatOverrides()).forEach(([p, c]) => { playerNationalities[p] = c; });
  Object.entries(loadPlayerRealnameOverrides()).forEach(([p, n]) => { playerRealNames[p] = n; });

  // FA overrides (also hydrate static maps)
  Object.entries(loadFreeAgentNationalityOverrides()).forEach(([p, c]) => {
    if (!playerNationalities[p]) playerNationalities[p] = c;
  });
  Object.entries(loadFreeAgentRoleOverrides()).forEach(([p, r]) => {
    if (!playerRoles[p]) playerRoles[p] = r;
  });
  Object.entries(loadFreeAgentRealNameOverrides()).forEach(([p, n]) => {
    if (!playerRealNames[p]) playerRealNames[p] = n;
  });
}
