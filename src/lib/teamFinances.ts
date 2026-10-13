// ===== Finanse organizacji =====
// Bilans jest WYLICZANY z istniejących danych (turnieje, kontrakty) + ręcznych
// wpisów użytkownika. Nic nie dzieje się automatycznie — żadnych bankructw ani
// sprzedaży graczy. Wynik jest liczony jednym przebiegiem dla wszystkich drużyn
// i cache'owany do czasu realnej zmiany danych (brak lagów przy renderach).

import { loadFromStorage, saveToStorage } from "./storage";
import type { TournamentData } from "./types";
import { ORG_CUT, resolveTournamentPrizes } from "./prizeDistribution";
import { CONTRACTS_EVENT, loadContracts, seededRandom, type PlayerContract } from "./contracts";
import { getWorldDate, WORLD_CLOCK_DEFAULT } from "./worldClock";
import { loadAllTeams } from "./teamManagement";
import { canonicalTeamName } from "./teamRenames";

export const FINANCES_EVENT = "finances:update";
const ENTRIES_KEY = "team_finance_entries";
const SETTINGS_KEY = "team_finance_settings";

export type LedgerCategory = "prize" | "transfer_in" | "transfer_out" | "salary" | "bonus" | "running" | "staff" | "manual_in" | "manual_out" | "start";

export const CATEGORY_LABEL: Record<LedgerCategory, string> = {
  start: "Budżet startowy",
  prize: "Nagrody turniejowe (25%)",
  transfer_in: "Sprzedaż zawodników",
  manual_in: "Dofinansowania / wpływy",
  salary: "Pensje",
  bonus: "Premie za podpis",
  transfer_out: "Zakupy zawodników",
  running: "Koszty bieżące (marketing, eventy)",
  staff: "Personel (sztab, analitycy, fizjo, media)",
  manual_out: "Inne wydatki",
};

export interface LedgerEntry {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // + przychód, - koszt
  category: LedgerCategory;
  label: string;
  manual?: boolean;
}

export interface ManualEntry {
  id: string;
  team: string;
  date: string;
  amount: number; // dodatnia = wpływ, ujemna = wydatek
  label: string;
}

export interface TeamFinanceSettings {
  startingBalance?: number;
  monthlyRunning?: number;
  monthlyStaff?: number;
}

export type FinanceHealth = "ok" | "low" | "negative" | "critical";

export interface TeamFinance {
  team: string;
  balance: number;
  income: number;
  expenses: number;
  /** Przychody / koszty tylko z bieżącego miesiąca fikcyjnego kalendarza. */
  monthIncome: number;
  monthExpenses: number;
  month: string; // YYYY-MM
  monthlyBurn: number; // pensje + koszty bieżące / mies.
  byCategory: Partial<Record<LedgerCategory, number>>;
  ledger: LedgerEntry[];
  health: FinanceHealth;
  startingBalance: number;
  monthlyRunning: number;
  monthlyStaff: number;
}

export const CRITICAL_THRESHOLD = -500_000;
export const LOW_THRESHOLD = 100_000;

// ---------- storage ----------

export function loadManualEntries(): ManualEntry[] {
  return loadFromStorage<ManualEntry[]>(ENTRIES_KEY, []);
}
export function loadFinanceSettings(): Record<string, TeamFinanceSettings> {
  return loadFromStorage<Record<string, TeamFinanceSettings>>(SETTINGS_KEY, {});
}
const emit = () => window.dispatchEvent(new CustomEvent(FINANCES_EVENT));

export function addManualEntry(e: Omit<ManualEntry, "id" | "date"> & { date?: string }): void {
  const list = loadManualEntries();
  list.push({ ...e, id: `fin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, date: e.date || getWorldDate() });
  saveToStorage(ENTRIES_KEY, list);
  emit();
}
export function removeManualEntry(id: string): void {
  saveToStorage(ENTRIES_KEY, loadManualEntries().filter(e => e.id !== id));
  emit();
}
export function updateFinanceSettings(team: string, patch: TeamFinanceSettings): void {
  const all = loadFinanceSettings();
  const key = canonicalTeamName(team);
  all[key] = { ...all[key], ...patch };
  saveToStorage(SETTINGS_KEY, all);
  emit();
}

// ---------- defaults ----------

/** Stały dla danej drużyny mnożnik losowy z zakresu [min, max]. */
const jitter = (team: string, salt: string, min: number, max: number) => min + seededRandom(`${team}:${salt}`) * (max - min);
const round = (v: number, step: number) => Math.max(step, Math.round(v / step) * step);

export function defaultStartingBalance(rank: number, team = ""): number {
  const base = rank <= 5 ? 3_000_000 : rank <= 10 ? 2_000_000 : rank <= 20 ? 1_200_000 : rank <= 30 ? 800_000 : rank <= 60 ? 350_000 : 150_000;
  // Część organizacji ma bogatego właściciela, część ledwo przędzie.
  const r = seededRandom(`${team}:sugar`);
  const mult = r > 0.9 ? jitter(team, "rich", 2, 3.5) : r < 0.15 ? jitter(team, "poor", 0.25, 0.6) : jitter(team, "start", 0.6, 1.6);
  return round(base * mult, 10_000);
}
export function defaultMonthlyRunning(rank: number, team = ""): number {
  const base = rank <= 10 ? 60_000 : rank <= 30 ? 30_000 : rank <= 60 ? 15_000 : 8_000;
  return round(base * jitter(team, "run", 0.6, 1.5), 500);
}
export function defaultMonthlyStaff(rank: number, team = ""): number {
  const base = rank <= 10 ? 45_000 : rank <= 30 ? 25_000 : rank <= 60 ? 12_000 : 5_000;
  return round(base * jitter(team, "staff", 0.65, 1.45), 500);
}

// Obciążenia: KAŻDEGO 1. dnia miesiąca schodzi pełna miesięczna kwota
// (pensje aktywnych kontraktów + koszty bieżące + personel). Bez ułamków
// i bez obciążeń w środku miesiąca — kwota = „Wydatki / mies.”.
/** Kolejne 1. dni miesiąca (UTC) od `from` (włącznie) do `now` (włącznie). */
function firstsOfMonth(from: number, now: number): number[] {
  const out: number[] = [];
  const d = new Date(from);
  let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  if (t < from) t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  while (t <= now && out.length < 600) {
    out.push(t);
    const n = new Date(t);
    t = Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + 1, 1);
  }
  return out;
}
const monthKey = (t: number) => new Date(t).toISOString().slice(0, 7);
const contractEnd = (c: PlayerContract) => Math.min(ms(c.endDate), c.terminatedAt ? ms(c.terminatedAt) : Infinity);
/** Kontrakt aktywny w chwili `t` (start <= t < koniec/zerwanie). */
const activeAt = (c: PlayerContract, t: number) => ms(c.startDate) <= t && t < contractEnd(c);

// ---------- compute ----------

const day = (iso: string | undefined) => (iso || "").slice(0, 10);
const ms = (iso: string) => new Date(day(iso) + "T00:00:00Z").getTime();

function healthOf(b: number): FinanceHealth {
  if (b <= CRITICAL_THRESHOLD) return "critical";
  if (b < 0) return "negative";
  if (b < LOW_THRESHOLD) return "low";
  return "ok";
}

let cache: Map<string, TeamFinance> | null = null;
if (typeof window !== "undefined") {
  const bust = () => { cache = null; };
  [FINANCES_EVENT, CONTRACTS_EVENT, "tournaments:update", "teams:update", "worldclock:update", "season:reset", "storage"].forEach(ev =>
    window.addEventListener(ev, bust),
  );
}

function computeAll(): Map<string, TeamFinance> {
  const nowDay = getWorldDate();
  const nowMs = ms(nowDay) + 12 * 3600_000; // południe UTC dnia w grze
  // Finanse liczone od startu świata gry (fikcyjny kalendarz) — kontrakty
  // podpisane „przed sezonem” nie generują kosztów z lat poprzednich.
  const seasonStart = ms(WORLD_CLOCK_DEFAULT);
  const teams = [...loadAllTeams()].sort((a, b) => b.points - a.points);
  const rankOf = new Map(teams.map((t, i) => [canonicalTeamName(t.name), i + 1]));
  const settings = loadFinanceSettings();
  const ledgers = new Map<string, LedgerEntry[]>();
  const push = (team: string, e: LedgerEntry) => {
    if (!team || team === "-") return;
    const key = canonicalTeamName(team);
    let l = ledgers.get(key);
    if (!l) { l = []; ledgers.set(key, l); }
    if (l.some(x => x.id === e.id)) return;
    l.push(e);
  };

  // 1) Nagrody — 25% dla organizacji
  const tournaments = loadFromStorage<TournamentData[]>("tournaments_data", []);
  for (const t of tournaments) {
    if (!t.placements?.length) continue;
    const prizes = resolveTournamentPrizes(t);
    const date = day(t.endDate || t.startDate) || nowDay;
    for (const pl of t.placements) {
      const prize = prizes[pl.placement] || 0;
      if (!pl.team || prize <= 0) continue;
      push(pl.team, {
        id: `prize_${t.id}`, date, amount: Math.round(prize * ORG_CUT), category: "prize",
        label: `${t.name} — miejsce ${pl.placement}`,
      });
    }
  }

  // 2) Kontrakty — pensje, premie, odstępne
  const contracts = loadContracts();
  const seenContract = new Set<string>();
  const byPlayer = new Map<string, PlayerContract[]>();
  const firstContract = new Map<string, number>();
  const salaryMonths = new Map<string, { team: string; at: number; amount: number; players: number }>();
  for (const c of contracts) {
    if (seenContract.has(c.id)) continue;
    seenContract.add(c.id);
    const arr = byPlayer.get(c.player) || [];
    arr.push(c);
    byPlayer.set(c.player, arr);
    const s = ms(c.startDate);
    const cTeam = canonicalTeamName(c.team);
    if (!firstContract.has(cTeam) || s < firstContract.get(cTeam)!) firstContract.set(cTeam, s);

    const bonus = c.terms?.signingBonus || 0;
    if (bonus > 0 && s >= seasonStart && s <= nowMs) {
      push(c.team, { id: `bon_${c.id}`, date: day(c.startDate), amount: -bonus, category: "bonus", label: `Premia za podpis: ${c.player}` });
    }
  }
  // Pensje: 1. dnia każdego miesiąca (fikcyjny kalendarz) pełna pensja za
  // kontrakt obowiązujący w tym dniu. Bieżący kontrakt z datą „w przyszłości”
  // (np. po cofnięciu zegara) też jest płacony, żeby zawodnik na liście
  // nie grał za darmo.
  const payDays = firstsOfMonth(seasonStart + 1, nowMs);
  for (const [, list] of byPlayer) {
    const current = list
      .filter(c => !c.terminatedAt)
      .sort((a, b) => ms(b.startDate) - ms(a.startDate))[0];
    for (const at of payDays) {
      let c = list.find(x => !x.terminatedAt && activeAt(x, at)) || list.find(x => activeAt(x, at));
      if (!c && current && ms(current.startDate) > at && at < contractEnd(current)) c = current;
      if (!c || !(c.salary > 0)) continue;
      const cTeam = canonicalTeamName(c.team);
      if (!cTeam || cTeam === "-") continue;
      const key = `${cTeam}|${monthKey(at)}`;
      const cur = salaryMonths.get(key) || { team: cTeam, at, amount: 0, players: 0 };
      cur.amount += c.salary;
      cur.players += 1;
      salaryMonths.set(key, cur);
    }
  }
  for (const [key, m] of salaryMonths) {
    push(m.team, {
      id: `sal_${key}`, date: day(new Date(m.at).toISOString()), amount: -Math.round(m.amount),
      category: "salary", label: `Pensje ${monthKey(m.at)} (${m.players} os.)`,
    });
  }
  for (const [player, list] of byPlayer) {
    list.sort((a, b) => ms(a.startDate) - ms(b.startDate));
    for (let i = 0; i < list.length - 1; i++) {
      const prev = list[i];
      const next = list[i + 1];
      const fee = prev.terms?.buyout || 0;
      if (prev.terminationReason !== "transfer" || fee <= 0 || prev.team === next.team) continue;
      if (ms(next.startDate) < seasonStart || ms(next.startDate) > nowMs) continue;
      const date = day(next.startDate);
      push(prev.team, { id: `tin_${prev.id}`, date, amount: fee, category: "transfer_in", label: `Sprzedaż: ${player} → ${next.team}` });
      push(next.team, { id: `tout_${next.id}`, date, amount: -fee, category: "transfer_out", label: `Zakup: ${player} z ${prev.team}` });
    }
  }

  // 3) Ręczne wpisy
  for (const m of loadManualEntries()) {
    push(m.team, {
      id: m.id, date: day(m.date), amount: m.amount, manual: true,
      category: m.amount >= 0 ? "manual_in" : "manual_out", label: m.label,
    });
  }

  const nf = new Date(nowMs);
  const nextFirst = Date.UTC(nf.getUTCFullYear(), nf.getUTCMonth() + 1, 1);
  const curMonth = nowDay.slice(0, 7);

  // 4) Złożenie per drużyna (+ budżet startowy, koszty bieżące)
  const names = new Set<string>([...teams.map(t => canonicalTeamName(t.name)), ...ledgers.keys()]);
  const out = new Map<string, TeamFinance>();
  for (const team of names) {
    const rank = rankOf.get(team) ?? 999;
    const s = settings[team] || {};
    const startingBalance = s.startingBalance ?? defaultStartingBalance(rank, team);
    const monthlyRunning = s.monthlyRunning ?? defaultMonthlyRunning(rank, team);
    const monthlyStaff = s.monthlyStaff ?? defaultMonthlyStaff(rank, team);
    const ledger = ledgers.get(team) || [];
    const fc = firstContract.get(team);
    // Aktywne drużyny płacą koszty stałe od startu sezonu niezależnie od dat
    // kontraktów (kontrakty z „przyszłą” datą po cofnięciu zegara nie mogą
    // wyłączać miesięcznych obciążeń).
    const epoch = rankOf.has(team) ? seasonStart : (fc !== undefined ? Math.max(fc, seasonStart) : undefined);
    const epochDay = epoch ? new Date(epoch).toISOString().slice(0, 10) : nowDay;
    ledger.push({ id: `start_${team}`, date: epochDay, amount: startingBalance, category: "start", label: "Budżet startowy" });
    if (epoch && rankOf.has(team)) {
      for (const at of firstsOfMonth(epoch + 1, nowMs)) {
        const date = day(new Date(at).toISOString());
        const mk = monthKey(at);
        if (monthlyRunning > 0) ledger.push({ id: `run_${team}_${mk}`, date, amount: -Math.round(monthlyRunning), category: "running", label: `Marketing, eventy, bootcampy ${mk}` });
        if (monthlyStaff > 0) ledger.push({ id: `staff_${team}_${mk}`, date, amount: -Math.round(monthlyStaff), category: "staff", label: `Personel ${mk}` });
      }
    }
    ledger.sort((a, b) => b.date.localeCompare(a.date));
    let income = 0, expenses = 0, monthIncome = 0, monthExpenses = 0;
    const byCategory: Partial<Record<LedgerCategory, number>> = {};
    for (const e of ledger) {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
      if (e.category === "start") continue;
      if (e.amount >= 0) income += e.amount; else expenses -= e.amount;
      if (e.date.slice(0, 7) === curMonth) {
        if (e.amount >= 0) monthIncome += e.amount; else monthExpenses -= e.amount;
      }
    }
    const salaries = contracts
      .filter(c => !c.terminatedAt && canonicalTeamName(c.team) === team && contractEnd(c) > nextFirst)
      .reduce((a, c) => a + (c.salary || 0), 0);
    const balance = startingBalance + income - expenses;
    out.set(team, {
      team, balance, income, expenses, monthIncome, monthExpenses, month: curMonth, byCategory, ledger, startingBalance, monthlyRunning, monthlyStaff,
      monthlyBurn: salaries + (rankOf.has(team) ? monthlyRunning + monthlyStaff : 0),
      health: healthOf(balance),
    });
  }
  return out;
}

function all(): Map<string, TeamFinance> {
  if (!cache) cache = computeAll();
  return cache;
}

export function getTeamFinance(team: string): TeamFinance | null {
  return all().get(canonicalTeamName(team)) || null;
}

/** Tylko aktywne drużyny — do tabeli finansów ligi. */
export function getLeagueFinances(): TeamFinance[] {
  const active = new Set(loadAllTeams().map(t => canonicalTeamName(t.name)));
  return [...all().values()].filter(f => active.has(f.team)).sort((a, b) => b.balance - a.balance);
}

export const HEALTH_LABEL: Record<FinanceHealth, string> = {
  ok: "Stabilnie",
  low: "Niski budżet",
  negative: "Na minusie",
  critical: "Grubo pod kreską",
};
