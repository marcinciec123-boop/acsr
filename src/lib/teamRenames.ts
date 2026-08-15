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
  const seen = new Set<string>();
  logCache = all
    .filter(r => {
      const k = `${r.oldName}>${r.newName}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
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
  for (let i = 0; i < 20; i++) {
    const next = log.find(r => r.oldName === current);
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

  // Zbuduj łańcuch zmian prowadzący do obecnej nazwy (od najstarszej).
  const chain: RenameEvent[] = [];
  let cursor = canonical;
  for (let i = 0; i < 20; i++) {
    const prev = log.find(r => r.newName === cursor);
    if (!prev) break;
    chain.unshift(prev);
    cursor = prev.oldName;
  }
  if (chain.length === 0) return canonical;

  let result = chain[0].oldName;
  for (const event of chain) {
    if (event.date && day && event.date <= day) result = event.newName;
    else if (!event.date) result = event.newName;
  }
  return result;
}
