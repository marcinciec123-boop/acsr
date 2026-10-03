// ===== Cotygodniowy raport rankingu (HLTV Monday Update) =====
// Generowany przy przejściu zegara gry na poniedziałek. Porównuje ranking
// z końca niedzieli (stan na żywo w chwili przejścia) z rankingiem sprzed
// tygodnia (poprzednia niedziela z historii zapisu). Raporty trzymane są
// w zapisie użytkownika jako historia tygodniowa.

import type { TeamData } from "@/lib/types";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import { teamDatabase } from "@/data/tournaments";
import { WORLD_CLOCK_EVENT } from "@/lib/worldClock";
import { getRankingAt } from "@/lib/rankingHistory";
import { canonicalTeamName } from "@/lib/teamRenames";

const KEY = "weekly_ranking_reports";
export const WEEKLY_REPORT_EVENT = "weekly-report:update";

export interface WeeklyEntry {
  team: string;
  rank: number;
  points: number;
  prevRank: number | null;
  prevPoints: number | null;
}

export interface WeeklyReport {
  /** Poniedziałek publikacji (YYYY-MM-DD). */
  date: string;
  /** Niedziela, z którą porównujemy (YYYY-MM-DD). */
  compareDate: string;
  entries: WeeklyEntry[]; // Top 50 bieżącego rankingu
  /** Drużyny, które wypadły z Top 50. */
  dropped: WeeklyEntry[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };
const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };

export function loadWeeklyReports(): WeeklyReport[] {
  return loadFromStorage<WeeklyReport[]>(KEY, []);
}

const TOP = 50;

export function buildWeeklyReport(monday: string): WeeklyReport {
  const sunday = addDays(monday, -1);
  const compareDate = addDays(sunday, -7);
  const ranking = loadFromStorage<TeamData[] | null>("ranking_data", null) || (teamDatabase as TeamData[]);
  const current = ranking.filter(t => !t.isNational)
    .sort((a, b) => (b.points || 0) - (a.points || 0) || a.name.localeCompare(b.name))
    .map((t, i) => ({ id: canonicalTeamName(t.name), team: t.name, points: t.points || 0, rank: i + 1 }));
  const prev = new Map(getRankingAt(compareDate).map(r => [canonicalTeamName(r.currentTeam).toLowerCase(), r]));
  const toEntry = (c: typeof current[number]): WeeklyEntry => {
    const p = prev.get(c.id.toLowerCase());
    return { team: c.team, rank: c.rank, points: c.points, prevRank: p?.rank ?? null, prevPoints: p?.points ?? null };
  };
  const entries = current.slice(0, TOP).map(toEntry);
  const dropped = current.slice(TOP).map(toEntry).filter(e => e.prevRank !== null && e.prevRank <= TOP);
  return { date: monday, compareDate, entries, dropped };
}

/** Klucz migawki punktów używanej przez trendy w panelu rankingu. */
export const RANKING_SNAPSHOT_KEY = "ranking_snapshot_prev";

/** Zapisuje bieżący ranking (punkty) jako migawkę trendów — wołane po każdym raporcie. */
function captureRankingSnapshot(): void {
  const ranking = loadFromStorage<TeamData[] | null>("ranking_data", null) || (teamDatabase as TeamData[]);
  const snap: Record<string, number> = {};
  ranking.filter(t => !t.isNational).forEach(t => { snap[canonicalTeamName(t.name)] = t.points || 0; });
  saveToStorage(RANKING_SNAPSHOT_KEY, snap);
}

export function saveWeeklyReport(report: WeeklyReport): void {
  const list = loadWeeklyReports().filter(r => r.date !== report.date);
  list.push(report);
  list.sort((a, b) => b.date.localeCompare(a.date));
  saveToStorage(KEY, list);
  // Migawka trendów odświeża się automatycznie razem z raportem.
  captureRankingSnapshot();
  window.dispatchEvent(new Event(WEEKLY_REPORT_EVENT));
}

export function deleteWeeklyReport(date: string): void {
  saveToStorage(KEY, loadWeeklyReports().filter(r => r.date !== date));
  window.dispatchEvent(new Event(WEEKLY_REPORT_EVENT));
}

/** Pochodne do wyświetlenia. */
export function reportHighlights(r: WeeklyReport) {
  const withDelta = r.entries.filter(e => e.prevRank !== null).map(e => ({ ...e, delta: (e.prevRank as number) - e.rank }));
  const risers = withDelta.filter(e => e.delta > 0).sort((a, b) => b.delta - a.delta || a.rank - b.rank).slice(0, 5);
  const fallers = [
    ...withDelta.filter(e => e.delta < 0),
    ...r.dropped.map(e => ({ ...e, delta: (e.prevRank as number) - e.rank })),
  ].sort((a, b) => a.delta - b.delta || a.rank - b.rank).slice(0, 5);
  const debut = (limit: number) => r.entries.filter(e => e.rank <= limit && (e.prevRank === null || e.prevRank > limit));
  return { risers, fallers, top10: debut(10), top20: debut(20).filter(e => e.rank > 10), top30: debut(30).filter(e => e.rank > 20) };
}

let installed = false;
/** Przy przejściu do przodu przez poniedziałek generuje raport (ostatni przekroczony poniedziałek). */
export function installWeeklyRankingReports(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener(WORLD_CLOCK_EVENT, (event: Event) => {
    const detail = (event as CustomEvent<{ previousDate?: string; currentDate?: string }>).detail;
    const from = detail?.previousDate?.slice(0, 10);
    const to = detail?.currentDate?.slice(0, 10);
    if (!from || !to || to <= from) return;
    let monday: string | null = null;
    for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) {
      if (parse(d).getDay() === 1) monday = d;
    }
    if (!monday) return;
    try { saveWeeklyReport(buildWeeklyReport(monday)); }
    catch (error) { console.error("Raport tygodniowy nie powiódł się:", error); }
  });
}
