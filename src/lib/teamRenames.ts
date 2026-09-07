// ===== Team rename timeline =====
// Zmiany nazw drużyn są zdarzeniem historycznym: ranking z dnia przed zmianą
// musi pokazywać STARĄ nazwę, a bieżący — nową. Dzięki temu w historii nie ma
// duplikatów (ta sama drużyna pod dwiema nazwami).
//
// Zmiana nazwy NIE tworzy nowej organizacji — to ciągle ten sam podmiot,
// dlatego wszystkie dopasowania nazw są niewrażliwe na wielkość liter
// i różnice w białych znakach.

import { loadFromStorage, saveToStorage } from "./storage";
import { nameChanges } from "@/data/history";

export interface RenameEvent {
  oldName: string;
  newName: string;
  date: string; // YYYY-MM-DD
}

const KEY = "team_rename_log";

let logCache: RenameEvent[] | null = null;
let nameCache = new Map<string, string>();

/** Klucz porównawczy nazw/nicków — wielkość liter i spacje nie mają znaczenia. */
export function nameKey(value: string | undefined | null): string {
  return (value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

/** Czy dwie nazwy (drużyny lub gracza) oznaczają to samo? */
export function sameName(a: string | undefined | null, b: string | undefined | null): boolean {
  const ka = nameKey(a);
  return !!ka && ka === nameKey(b);
}

function invalidate(): void {
  logCache = null;
  nameCache = new Map();
}

if (typeof window !== "undefined") {
  window.addEventListener("teams:update", invalidate);
}

export function loadRenameLog(): RenameEvent[] {
  if (logCache) return logCache;
  const stored = loadFromStorage<RenameEvent[]>(KEY, []);
  const all = [...nameChanges, ...stored].filter(
    r => r?.oldName && r?.newName && !sameName(r.oldName, r.newName),
  );
  const byPair = new Map<string, RenameEvent>();
  all.forEach(event => {
    const normalized = { ...event, date: (event.date || "").slice(0, 10) };
    const key = `${nameKey(normalized.oldName)}>${nameKey(normalized.newName)}`;
    const previous = byPair.get(key);
    // A saved user rename is authoritative over a bundled legacy alias. If both
    // exist, retain the latest dated occurrence rather than an arbitrary import order.
    if (!previous || normalized.date >= previous.date) byPair.set(key, normalized);
  });
  logCache = [...byPair.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.oldName.localeCompare(b.oldName),
  );
  return logCache;
}

export function recordRename(oldName: string, newName: string, date: string): void {
  if (!oldName || !newName || sameName(oldName, newName)) return;
  const stored = loadFromStorage<RenameEvent[]>(KEY, []);
  if (stored.some(r => sameName(r.oldName, oldName) && sameName(r.newName, newName))) return;
  saveToStorage(KEY, [...stored, { oldName, newName, date: (date || "").slice(0, 10) }]);
  invalidate();
}

/** Aktualna (najnowsza) nazwa drużyny — podąża łańcuchem zmian. */
export function canonicalTeamName(name: string): string {
  const key = nameKey(name);
  const cached = nameCache.get(key);
  if (cached) return cached;
  const log = loadRenameLog();
  let current = name;
  const visited = new Set<string>();
  for (let i = 0; i < 20; i++) {
    if (visited.has(nameKey(current))) break;
    visited.add(nameKey(current));
    const next = log.filter(r => sameName(r.oldName, current)).at(-1);
    if (!next) break;
    current = next.newName;
  }
  nameCache.set(key, current);
  return current;
}

/** Nazwa, którą drużyna nosiła danego dnia (dla obecnej nazwy `name`). */
export function teamNameAt(name: string, dateIso: string): string {
  const day = (dateIso || "").slice(0, 10);
  const log = loadRenameLog();
  const canonical = canonicalTeamName(name);

  // Walk backwards from the canonical identity. Picking the latest predecessor
  // makes chained renames deterministic even when old saves contain duplicates.
  let result = canonical;
  const visited = new Set<string>();
  for (let i = 0; i < 20; i++) {
    if (visited.has(nameKey(result))) break;
    visited.add(nameKey(result));
    const predecessors = log
      .filter(event => sameName(event.newName, result))
      .sort((a, b) => b.date.localeCompare(a.date) || b.oldName.localeCompare(a.oldName));
    const previous = predecessors[0];
    if (!previous) break;
    if (!day || !previous.date || previous.date <= day) break;
    result = previous.oldName;
  }
  return result;
}

/** Wszystkie nazwy, jakie ta organizacja nosiła (od najstarszej do obecnej). */
export function teamNameChain(name: string): string[] {
  const log = loadRenameLog();
  const canonical = canonicalTeamName(name);
  const chain: string[] = [canonical];
  let cursor = canonical;
  for (let i = 0; i < 20; i++) {
    const previous = log
      .filter(event => sameName(event.newName, cursor))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!previous || chain.some(n => sameName(n, previous.oldName))) break;
    chain.unshift(previous.oldName);
    cursor = previous.oldName;
  }
  return chain;
}
