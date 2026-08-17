// ===== Team rename timeline =====
// Zmiany nazw drużyn są zdarzeniem historycznym: ranking z dnia przed zmianą
// musi pokazywać STARĄ nazwę, a bieżący — nową. Dzięki temu w historii nie ma
// duplikatów (ta sama drużyna pod dwiema nazwami).

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
  const all = [...nameChanges, ...stored].filter(r => r?.oldName && r?.newName && r.oldName !== r.newName);
  const byPair = new Map<string, RenameEvent>();
  all.forEach(event => {
    const normalized = { ...event, date: (event.date || "").slice(0, 10) };
    const key = `${normalized.oldName}>${normalized.newName}`;
    const previous = byPair.get(key);
    // A saved user rename is authoritative over a bundled legacy alias. If both
    // exist, retain the latest dated occurrence rather than an arbitrary import order.
    if (!previous || normalized.date >= previous.date) byPair.set(key, normalized);
  });
  logCache = all
    .map(event => byPair.get(`${event.oldName}>${event.newName}`))
    .filter((event, index, entries): event is RenameEvent => !!event && entries.indexOf(event) === index)
    .sort((a, b) => a.date.localeCompare(b.date) || a.oldName.localeCompare(b.oldName));
  return logCache;
}

export function recordRename(oldName: string, newName: string, date: string): void {
  if (!oldName || !newName || oldName === newName) return;
  const stored = loadFromStorage<RenameEvent[]>(KEY, []);
  if (stored.some(r => r.oldName === oldName && r.newName === newName)) return;
  saveToStorage(KEY, [...stored, { oldName, newName, date: (date || "").slice(0, 10) }]);
  invalidate();
}

/** Aktualna (najnowsza) nazwa drużyny — podąża łańcuchem zmian. */
export function canonicalTeamName(name: string): string {
  const cached = nameCache.get(name);
  if (cached) return cached;
  const log = loadRenameLog();
  let current = name;
  const visited = new Set<string>();
  for (let i = 0; i < 20; i++) {
    if (visited.has(current)) break;
    visited.add(current);
    const next = log.filter(r => r.oldName === current).at(-1);
    if (!next) break;
    current = next.newName;
  }
  nameCache.set(name, current);
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
    if (visited.has(result)) break;
    visited.add(result);
    const predecessors = log
      .filter(event => event.newName === result)
      .sort((a, b) => b.date.localeCompare(a.date) || b.oldName.localeCompare(a.oldName));
    const previous = predecessors[0];
    if (!previous) break;
    if (!day || !previous.date || previous.date <= day) break;
    result = previous.oldName;
  }
  return result;
}
