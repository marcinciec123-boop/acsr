// ===== Otwarte sloty turnieju (obsada jeszcze nieznana) =====
// Wolne miejsca to placeholdery "TBD-S{n}" w participants i w fazach.
import type { TournamentData } from "./types";

export const OPEN_SLOT_PREFIX = "TBD-S";
export const isOpenSlot = (n: string) => typeof n === "string" && n.startsWith(OPEN_SLOT_PREFIX);
export const openSlotName = (i: number) => `${OPEN_SLOT_PREFIX}${i}`;

const swap = <T>(obj: T, from: string, to: string): T =>
  JSON.parse(JSON.stringify(obj).split(JSON.stringify(from)).join(JSON.stringify(to)));

/** Wstawia drużynę w pierwszy wolny slot. Gdy brak slotów — dopisuje do uczestników. */
export function fillOpenSlot(t: TournamentData, team: string): TournamentData {
  if (t.participants.includes(team)) return t;
  const slot = t.participants.find(isOpenSlot);
  if (!slot) {
    const participants = [...t.participants, team];
    return { ...t, participants, teams: Math.max(t.teams, participants.length) };
  }
  return {
    ...t,
    participants: t.participants.map(p => (p === slot ? team : p)),
    phases: swap(t.phases, slot, team),
  };
}

/** Zwalnia miejsce drużyny (tylko przed startem). */
export function freeSlot(t: TournamentData, team: string): TournamentData {
  let n = 1;
  while (t.participants.includes(openSlotName(n))) n++;
  const slot = openSlotName(n);
  return {
    ...t,
    participants: t.participants.map(p => (p === team ? slot : p)),
    phases: swap(t.phases, team, slot),
  };
}
