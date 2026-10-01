// ===== Historia organizacji =====
// Trwały rejestr zdarzeń dotyczących samych organizacji (nie zawodników):
//  - zmiany nazw drużyn (rename)
//  - rozwiązania organizacji (disband)
//  - powstania nowych organizacji (create)
//
// Zmiana nazwy nie tworzy nowej organizacji — każde zdarzenie jest powiązane
// z aktualną tożsamością klubu (`org`), więc historia pod starymi nazwami
// zostaje przypisana do dzisiejszej drużyny. Dopasowania nazw są niewrażliwe
// na wielkość liter.
//
// Baza startowa pochodzi z arkusza Excel (`src/data/history.ts`), a każde nowe
// zdarzenie w aplikacji jest dopisywane na bieżąco i zapisywane w localStorage.

import { loadFromStorage, saveToStorage } from "./storage";
import { nameChanges, disbands } from "@/data/history";
import { canonicalTeamName, nameKey, sameName } from "./teamRenames";

export type OrgEventKind = "rename" | "disband" | "create";

export interface OrgEvent {
  id: string;
  kind: OrgEventKind;
  date: string;          // YYYY-MM-DD
  team: string;          // nazwa w chwili zdarzenia (dla rename: nowa nazwa)
  previousName?: string; // dla rename
  note?: string;         // powód / opis
  /** Aktualna tożsamość organizacji (po wszystkich zmianach nazw). */
  org?: string;
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

function eventId(kind: OrgEventKind, team: string, previousName: string | undefined, date: string): string {
  return `${kind}-${nameKey(previousName)}-${nameKey(team)}-${(date || "").slice(0, 10)}`;
}

function seededEvents(): OrgEvent[] {
  const fromRenames: OrgEvent[] = nameChanges.map(change => ({
    id: eventId("rename", change.newName, change.oldName, change.date),
    kind: "rename" as const,
    date: (change.date || "").slice(0, 10),
    team: change.newName,
    previousName: change.oldName,
    seeded: true,
  }));
  const fromDisbands: OrgEvent[] = disbands.map(disband => ({
    id: eventId("disband", disband.team, undefined, disband.date),
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
  all.forEach(event => {
    const id = eventId(event.kind, event.team, event.previousName, event.date);
    const previous = unique.get(id);
    unique.set(id, { ...previous, ...event, id, org: canonicalTeamName(event.team) });
  });
  return [...unique.values()].sort(
    (a, b) => (b.date || "").localeCompare(a.date || "") || a.team.localeCompare(b.team),
  );
}

/** Historia pogrupowana po aktualnej tożsamości organizacji. */
export function groupOrgEventsByOrg(events = loadOrgEvents()): { org: string; events: OrgEvent[] }[] {
  const groups = new Map<string, { org: string; events: OrgEvent[] }>();
  events.forEach(event => {
    const org = event.org || canonicalTeamName(event.team);
    const key = nameKey(org);
    const group = groups.get(key) || { org, events: [] };
    group.events.push(event);
    groups.set(key, group);
  });
  return [...groups.values()].sort((a, b) => a.org.localeCompare(b.org));
}

/** Wszystkie zdarzenia dotyczące danej organizacji (również pod starymi nazwami). */
export function orgEventsFor(team: string): OrgEvent[] {
  const canonical = canonicalTeamName(team);
  return loadOrgEvents().filter(event => sameName(event.org || event.team, canonical));
}

function record(event: Omit<OrgEvent, "id" | "seeded" | "org">): void {
  const id = eventId(event.kind, event.team, event.previousName, event.date);
  const stored = loadStored();
  if (stored.some(e => e.id === id)) return;
  if (seededEvents().some(e => e.id === id)) return;
  saveStored([...stored, { ...event, id }]);
}

export function recordOrgRename(oldName: string, newName: string, date: string): void {
  if (!oldName || !newName || sameName(oldName, newName)) return;
  record({ kind: "rename", team: newName, previousName: oldName, date: (date || "").slice(0, 10) });
}

export function recordOrgDisband(team: string, date: string, reason?: string): void {
  if (!team) return;
  record({ kind: "disband", team, date: (date || "").slice(0, 10), note: reason });
}

export function recordOrgCreate(team: string, date: string, note?: string): void {
  if (!team) return;
  // Zmiana nazwy istniejącej organizacji nie jest jej powstaniem.
  const existing = loadOrgEvents().some(
    e => e.kind === "rename" && sameName(e.team, team),
  );
  if (existing) return;
  record({ kind: "create", team, date: (date || "").slice(0, 10), note });
}

/** Usuwa ręcznie dodany wpis (wpisów z bazy startowej nie można usunąć). */
export function removeOrgEvent(id: string): void {
  saveStored(loadStored().filter(e => e.id !== id));
}

export const ORG_EVENTS_UPDATE_EVENT = EVENT;
