// ===== Naprawa dat meczów w zaimportowanych (historycznych) turniejach =====
//
// Wgrane turnieje miały `playedAt` ustawiane na moment importu (stąd "lipcowe"
// daty w profilach graczy i drużyn). Ta migracja rozkłada mecze zakończonych
// turniejów równomiernie w przedziale startDate–endDate, zachowując kolejność
// faz i meczów.

import { loadFromStorage, saveToStorage } from "./storage";
import type { MatchResult, TournamentData } from "./types";

const isIso = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}/.test(s);

const addDays = (iso: string, days: number): string => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + days, 12, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

const daysBetween = (a: string, b: string): number =>
  Math.max(0, Math.round(
    (Date.parse(`${b.slice(0, 10)}T12:00:00`) - Date.parse(`${a.slice(0, 10)}T12:00:00`)) / 86400000,
  ));

const hasScore = (m: MatchResult) =>
  (m.score1 || 0) + (m.score2 || 0) > 0 && m.team1 !== "BYE" && m.team2 !== "BYE";

/** Rozkłada mecze jednego turnieju po dniach jego trwania. */
const fixTournament = (t: TournamentData): { tournament: TournamentData; changed: number } => {
  if (!isIso(t.startDate) || !isIso(t.endDate)) return { tournament: t, changed: 0 };
  const start = t.startDate.slice(0, 10);
  const end = t.endDate.slice(0, 10);
  if (end < start) return { tournament: t, changed: 0 };
  const span = daysBetween(start, end);

  // Zbierz mecze w kolejności rozgrywania (fazy → grupy/bracket).
  const ordered: MatchResult[] = [];
  (t.phases || []).forEach(p => {
    p.groups?.forEach(g => ordered.push(...g.matches));
    if (p.bracket) ordered.push(...p.bracket);
  });
  if (t.matches) ordered.push(...t.matches);
  const played = ordered.filter(hasScore);
  if (played.length === 0) return { tournament: t, changed: 0 };

  const outOfRange = (iso?: string) => !iso || iso.slice(0, 10) < start || iso.slice(0, 10) > end;
  if (!played.some(m => outOfRange(m.playedAt))) return { tournament: t, changed: 0 };

  const dateFor = new Map<string, string>();
  played.forEach((m, i) => {
    const offset = played.length === 1 ? 0 : Math.round((i / (played.length - 1)) * span);
    const day = addDays(start, offset);
    const hour = 10 + (i % 9);
    dateFor.set(m.id, `${day}T${String(hour).padStart(2, "0")}:00:00.000Z`);
  });

  let changed = 0;
  const patch = (m: MatchResult): MatchResult => {
    if (!hasScore(m) || !outOfRange(m.playedAt)) return m;
    const next = dateFor.get(m.id);
    if (!next) return m;
    changed += 1;
    const scheduledAt = outOfRange(m.scheduledAt) ? next.slice(0, 16) : m.scheduledAt;
    return { ...m, playedAt: next, scheduledAt };
  };

  const tournament: TournamentData = {
    ...t,
    phases: (t.phases || []).map(p => ({
      ...p,
      bracket: p.bracket?.map(patch),
      groups: p.groups?.map(g => ({ ...g, matches: g.matches.map(patch) })),
    })),
    matches: t.matches?.map(patch),
  };
  return { tournament, changed };
};

/** Uruchamiane przy starcie aplikacji — idempotentne. */
export function fixHistoricalMatchDates(): number {
  const tournaments = loadFromStorage<TournamentData[]>("tournaments_data", []);
  if (!tournaments.length) return 0;
  let total = 0;
  const next = tournaments.map(t => {
    if (t.status !== "completed") return t;
    const { tournament, changed } = fixTournament(t);
    total += changed;
    return tournament;
  });
  if (total > 0) saveToStorage("tournaments_data", next);
  return total;
}
