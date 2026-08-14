// ===== Benched players =====
// Per-team list of players who are still part of the organization but
// not in the active starting 5. They stay on the team's roster array
// (so transfers/history aren't disturbed), but are filtered out of the
// active lineup used by the match simulator and shown separately in the
// Team profile.
//
// Persisted via the standard storage helper, so device backups capture
// it automatically.

import { loadFromStorage, saveToStorage } from "./storage";
import type { TeamData } from "./types";
import { getWorldNowIso } from "./worldClock";

const BENCH_KEY = "benched_players";

type BenchMap = Record<string, string[]>;

export function loadBenched(): BenchMap {
  return loadFromStorage<BenchMap>(BENCH_KEY, {});
}

function saveBenched(map: BenchMap): void {
  // Drop empty arrays to keep storage tidy
  const cleaned: BenchMap = {};
  for (const [k, v] of Object.entries(map)) {
    if (v && v.length > 0) cleaned[k] = [...new Set(v)];
  }
  saveToStorage(BENCH_KEY, cleaned);
  window.dispatchEvent(new CustomEvent("bench:update"));
}

export function getBenchedFor(team: string): string[] {
  return loadBenched()[team] || [];
}

export function isBenched(team: string, player: string): boolean {
  return getBenchedFor(team).includes(player);
}

export function benchPlayer(team: string, player: string, date?: string): void {
  const map = loadBenched();
  const cur = new Set(map[team] || []);
  if (cur.has(player)) return;
  cur.add(player);
  map[team] = [...cur];
  recordBenchEvent(team, player, "bench", date);
  saveBenched(map);
}

export function activatePlayer(team: string, player: string): void {
  const map = loadBenched();
  if (!(map[team] || []).includes(player)) return;
  const cur = (map[team] || []).filter(p => p !== player);
  map[team] = cur;
  recordBenchEvent(team, player, "activate");
  saveBenched(map);
}

export function clearBenchFor(team: string): void {
  const map = loadBenched();
  delete map[team];
  saveBenched(map);
}

/** When a player leaves a team via transfer, remove them from bench. */
export function removeFromAllBenches(player: string): void {
  const map = loadBenched();
  let changed = false;
  for (const team of Object.keys(map)) {
    const next = map[team].filter(p => p !== player);
    if (next.length !== map[team].length) {
      map[team] = next;
      changed = true;
    }
  }
  if (changed) saveBenched(map);
}

/** Roster split: active (first 5 not on bench) + benched. */
export function splitRoster(team: TeamData): { active: string[]; bench: string[] } {
  const benched = new Set(getBenchedFor(team.name));
  const active = team.roster.filter(p => !benched.has(p));
  const bench = team.roster.filter(p => benched.has(p));
  return { active, bench };
}

/** Active roster used by the match simulator (max 5, benched excluded). */
export function getActiveRoster(team: TeamData): string[] {
  return splitRoster(team).active;
}

// ===== Bench history log =====
// Every bench/activate action is timestamped with the fictional world date
// so player profiles can render "Inactive" periods inside a team stint.

export interface BenchLogEntry {
  team: string;
  player: string;
  action: "bench" | "activate";
  date: string; // ISO
}

const BENCH_LOG_KEY = "bench_log";

export function loadBenchLog(): BenchLogEntry[] {
  return loadFromStorage<BenchLogEntry[]>(BENCH_LOG_KEY, []);
}

export function recordBenchEvent(team: string, player: string, action: "bench" | "activate", date?: string): void {
  const log = loadBenchLog();
  log.push({ team, player, action, date: date || getWorldNowIso() });
  saveToStorage(BENCH_LOG_KEY, log);
}
