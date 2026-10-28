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
import { canonicalTeamName, nameKey, sameName } from "./teamRenames";

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

function benchKeys(map: BenchMap, team: string): string[] {
  const canonical = canonicalTeamName(team);
  return Object.keys(map).filter(key => sameName(canonicalTeamName(key), canonical));
}

function benchMembers(map: BenchMap, team: string): string[] {
  const members = new Map<string, string>();
  for (const key of benchKeys(map, team)) {
    for (const player of map[key] || []) members.set(nameKey(player), player);
  }
  return [...members.values()];
}

function replaceTeamBench(map: BenchMap, team: string, players: string[]): void {
  for (const key of benchKeys(map, team)) delete map[key];
  if (players.length) map[canonicalTeamName(team)] = players;
}

export function getBenchedFor(team: string): string[] {
  return benchMembers(loadBenched(), team);
}

export function isBenched(team: string, player: string): boolean {
  return getBenchedFor(team).some(p => sameName(p, player));
}

export function benchPlayer(team: string, player: string, date?: string): void {
  const map = loadBenched();
  const cur = benchMembers(map, team);
  if (cur.some(p => sameName(p, player))) return;
  replaceTeamBench(map, team, [...cur, player]);
  recordBenchEvent(team, player, "bench", date);
  saveBenched(map);
}

export function activatePlayer(team: string, player: string): void {
  const map = loadBenched();
  const members = benchMembers(map, team);
  if (!members.some(p => sameName(p, player))) return;
  const cur = members.filter(p => !sameName(p, player));
  replaceTeamBench(map, team, cur);
  recordBenchEvent(team, player, "activate");
  saveBenched(map);
}

export function clearBenchFor(team: string): void {
  const map = loadBenched();
  replaceTeamBench(map, team, []);
  saveBenched(map);
}

/** Consolidate current membership after a rename without rewriting history. */
export function consolidateBenchFor(team: string): void {
  const map = loadBenched();
  if (!benchKeys(map, team).length) return;
  replaceTeamBench(map, team, benchMembers(map, team));
  saveBenched(map);
}

/** When a player leaves a team via transfer, remove them from bench. */
export function removeFromAllBenches(player: string): void {
  const map = loadBenched();
  let changed = false;
  for (const team of Object.keys(map)) {
    const next = map[team].filter(p => !sameName(p, player));
    if (next.length !== map[team].length) {
      map[team] = next;
      changed = true;
    }
  }
  if (changed) saveBenched(map);
}

/** Roster split: active (first 5 not on bench) + benched. */
export function splitRoster(team: TeamData): { active: string[]; bench: string[] } {
  const benched = new Set(getBenchedFor(team.name).map(nameKey));
  const active = team.roster.filter(p => !benched.has(nameKey(p)));
  const bench = team.roster.filter(p => benched.has(nameKey(p)));
  return { active, bench };
}

/** Active roster used by the match simulator (max 5, benched excluded). */
export function getActiveRoster(team: TeamData): string[] {
  return splitRoster(team).active;
}

/** Incoming non-coach joins the bench when the active five is already full. */
export function shouldAutoBenchIncoming(team: TeamData, player: string): boolean {
  return !team.roster.includes(player) && getActiveRoster(team).length >= 5;
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
