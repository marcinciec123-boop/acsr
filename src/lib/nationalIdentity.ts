// Jedno źródło prawdy: czy drużyna jest reprezentacją narodową.
// Rejestr nazw jest zapisywany, więc po zmianie nazwy lub usunięciu
// reprezentacji jej stare mecze dalej nie trafiają do systemów klubowych.
import { teamDatabase } from "@/data/tournaments";
import { loadFromStorage, saveToStorage } from "./storage";
import { canonicalTeamName, nameKey } from "./teamRenames";
import type { TeamData, TournamentData } from "./types";

const KEY = "national_team_registry";
let cache: Set<string> | null = null;

if (typeof window !== "undefined") {
  ["teams:update", "ranking:update", "tournaments:update", "season:reset"].forEach(evt =>
    window.addEventListener(evt, () => { cache = null; }));
}

function registry(): Set<string> {
  if (cache) return cache;
  const stored = loadFromStorage<string[]>(KEY, []);
  const names = new Set(stored.map(nameKey).filter(Boolean));
  const add = (name: string) => { const k = nameKey(name); if (k) names.add(k); };
  for (const team of [...teamDatabase, ...(loadFromStorage<TeamData[] | null>("ranking_data", null) || [])]) {
    if (team?.isNational) add(team.name);
  }
  for (const t of loadFromStorage<TournamentData[] | null>("tournaments_data", null) || []) {
    if (t?.kind === "worlds") (t.participants || []).forEach(add);
  }
  if (names.size !== stored.length) saveToStorage(KEY, [...names]);
  cache = names;
  return names;
}

export function registerNationalTeamNames(names: string[]): void {
  const reg = registry();
  names.forEach(n => { const k = nameKey(n); if (k) reg.add(k); });
  saveToStorage(KEY, [...reg]);
}

export function isNationalTeam(name: string | undefined | null): boolean {
  if (!name || name === "-") return false;
  const reg = registry();
  return reg.has(nameKey(name)) || reg.has(nameKey(canonicalTeamName(name)));
}

export function isInternationalTournament(t: Pick<TournamentData, "kind" | "participants"> | null | undefined): boolean {
  if (!t) return false;
  return t.kind === "worlds" || (t.participants || []).some(isNationalTeam);
}

export function clubOnly<T extends { name: string; isNational?: boolean }>(list: T[]): T[] {
  return list.filter(team => !team.isNational && !isNationalTeam(team.name));
}

/** Transfery dotyczą wyłącznie klubów. */
export const isTransferAllowed = (from: string, to: string): boolean =>
  !isNationalTeam(from) && !isNationalTeam(to);

/** Tylko do testów. */
export const resetNationalIdentityCache = () => { cache = null; };
