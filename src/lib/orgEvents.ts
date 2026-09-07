// ===== Historia organizacji =====
// Trwały rejestr zdarzeń dotyczących samych organizacji (nie zawodników):
//  - zmiany nazw drużyn (rename)
//  - rozwiązania organizacji (disband)
//  - powstania nowych organizacji (create)
//
// Baza startowa pochodzi z arkusza Excel (`src/data/history.ts`), a każde nowe
// zdarzenie w aplikacji jest dopisywane na bieżąco i zapisywane w localStorage.

import { loadFromStorage, saveToStorage } from "./storage";
import { nameChanges, disbands } from "@/data/history";

export type OrgEventKind = "rename" | "disband" | "create";

export interface OrgEvent {
  id: string;
  kind: OrgEventKind;
  date: string;          // YYYY-MM-DD
  team: string;          // aktualna / nowa nazwa
  previousName?: string; // dla rename
  note?: string;         // powód / opis
  /** true = wpis z bazy startowej (Excel), nie da się go usunąć */
  seeded?: boolean;
}

const KEY = "org_events";
const EVENT = "org-events:update";

function loadStored(): OrgEvent[] {
  return loadFromStorage<OrgEvent[]>(KEY, []);
}

function saveStored(list: OrgEvent[]): void {
  saveToStorage(KEY, list);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

function seededEvents(): OrgEvent[] {
  const fromRenames: OrgEvent[] = nameChanges.map(change => ({
    id: `seed-rename-${change.oldName}-${change.newName}`,
    kind: "rename" as const,
    date: (change.date || "").slice(0, 10),
    team: change.newName,
    previousName: change.oldName,
    seeded: true,
  }));
  const fromDisbands: OrgEvent[] = disbands.map(disband => ({
    id: `seed-disband-${disband.team}-${disband.date}`,
    kind: "disband" as const,
    date: (disband.date || "").slice(0, 10),
    team: disband.team,
    note: disband.reason,
    seeded: true,
  }));
  return [...fromRenames, ...fromDisbands];
}

/** Pełna, posortowana chronologicznie historia organizacji. */
export function loadOrgEvents(): OrgEvent[] {
  const all = [...seededEvents(), ...loadStored()];
  const unique = new Map<string, OrgEvent>();
  all.forEach(event => unique.set(event.id, event));
  return [...unique.values()].sort(
    (a, b) => (b.date || "").localeCompare(a.date || "") || a.team.localeCompare(b.team),
  );
}

function record(event: Omit<OrgEvent, "id" | "seeded">): void {
  const id = `${event.kind}-${event.previousName || ""}-${event.team}-${event.date}`;
  const stored = loadStored();
  if (stored.some(e => e.id === id)) return;
  if (seededEvents().some(e => e.id === `seed-${event.kind}-${event.previousName || event.team}-${event.kind === "rename" ? event.team : event.date}`)) return;
  saveStored([...stored, { ...event, id }]);
}

export function recordOrgRename(oldName: string, newName: string, date: string): void {
  if (!oldName || !newName || oldName === newName) return;
  record({ kind: "rename", team: newName, previousName: oldName, date: (date || "").slice(0, 10) });
}

export function recordOrgDisband(team: string, date: string, reason?: string): void {
  if (!team) return;
  record({ kind: "disband", team, date: (date || "").slice(0, 10), note: reason });
}

export function recordOrgCreate(team: string, date: string, note?: string): void {
  if (!team) return;
  record({ kind: "create", team, date: (date || "").slice(0, 10), note });
}

/** Usuwa ręcznie dodany wpis (wpisów z bazy startowej nie można usunąć). */
export function removeOrgEvent(id: string): void {
  saveStored(loadStored().filter(e => e.id !== id));
}

export const ORG_EVENTS_UPDATE_EVENT = EVENT;
