// ===== Finanse organizacji =====
// Bilans jest WYLICZANY z istniejących danych (turnieje, kontrakty) + ręcznych
// wpisów użytkownika. Nic nie dzieje się automatycznie — żadnych bankructw ani
// sprzedaży graczy. Wynik jest liczony jednym przebiegiem dla wszystkich drużyn
// i cache'owany do czasu realnej zmiany danych (brak lagów przy renderach).

import { loadFromStorage, saveToStorage } from "./storage";
import type { TournamentData } from "./types";
import { ORG_CUT, resolveTournamentPrizes } from "./prizeDistribution";
import { CONTRACTS_EVENT, loadContracts, type PlayerContract } from "./contracts";
import { getWorldNow, getWorldDate } from "./worldClock";
import { loadAllTeams } from "./teamManagement";

export const FINANCES_EVENT = "finances:update";
const ENTRIES_KEY = "team_finance_entries";
const SETTINGS_KEY = "team_finance_settings";
const DAY = 86_400_000;
const MONTH_DAYS = 30.44;

export type LedgerCategory = "prize" | "transfer_in" | "transfer_out" | "salary" | "bonus" | "running" | "manual_in" | "manual_out" | "start";

export const CATEGORY_LABEL: Record<LedgerCategory, string> = {
  start: "Budżet startowy",
  prize: "Nagrody turniejowe (25%)",
  transfer_in: "Sprzedaż zawodników",
  manual_in: "Dofinansowania / wpływy",
  salary: "Pensje",
  bonus: "Premie za podpis",
  transfer_out: "Zakupy zawodników",
  running: "Koszty bieżące",
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
}

export type FinanceHealth = "ok" | "low" | "negative" | "critical";

export interface TeamFinance {
  team: string;
  balance: number;
  income: number;
  expenses: number;
  monthlyBurn: number; // pensje + koszty bieżące / mies.
  byCategory: Partial<Record<LedgerCategory, number>>;
  ledger: LedgerEntry[];
  health: FinanceHealth;
  startingBalance: number;
  monthlyRunning: number;
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
  all[team] = { ...all[team], ...patch };
  saveToStorage(SETTINGS_KEY, all);
  emit();
}

// ---------- defaults ----------

export function defaultStartingBalance(rank: number): number {
  if (rank <= 10) return 2_000_000;
  if (rank <= 30) return 800_000;
  if (rank <= 60) return 350_000;
  return 150_000;
}
export function defaultMonthlyRunning(rank: number): number {
  if (rank <= 10) return 60_000;
  if (rank <= 30) return 30_000;
  if (rank <= 60) return 15_000;
  return 8_000;
}

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
  const nowMs = getWorldNow().getTime();
  const nowDay = new Date(nowMs).toISOString().slice(0, 10);
  const teams = [...loadAllTeams()].sort((a, b) => b.points - a.points);
  const rankOf = new Map(teams.map((t, i) => [t.name, i + 1]));
  const settings = loadFinanceSettings();
  const ledgers = new Map<string, LedgerEntry[]>();
  const push = (team: string, e: LedgerEntry) => {
    if (!team || team === "-") return;
    let l = ledgers.get(team);
    if (!l) { l = []; ledgers.set(team, l); }
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
  const byPlayer = new Map<string, PlayerContract[]>();
  const firstContract = new Map<string, number>();
  for (const c of contracts) {
    const arr = byPlayer.get(c.player) || [];
    arr.push(c);
    byPlayer.set(c.player, arr);
    const s = ms(c.startDate);
    if (!firstContract.has(c.team) || s < firstContract.get(c.team)!) firstContract.set(c.team, s);

    const end = Math.min(nowMs, ms(c.terminatedAt || c.endDate));
    const start = ms(c.startDate);
    if (end > start && c.salary > 0) {
      const months = (end - start) / DAY / MONTH_DAYS;
      push(c.team, {
        id: `sal_${c.id}`, date: day(new Date(end).toISOString()), amount: -Math.round(c.salary * months),
        category: "salary", label: `Pensja: ${c.player} (${months.toFixed(1)} mies.)`,
      });
    }
    const bonus = c.terms?.signingBonus || 0;
    if (bonus > 0 && start <= nowMs) {
      push(c.team, { id: `bon_${c.id}`, date: day(c.startDate), amount: -bonus, category: "bonus", label: `Premia za podpis: ${c.player}` });
    }
  }
  for (const [player, list] of byPlayer) {
    list.sort((a, b) => ms(a.startDate) - ms(b.startDate));
    for (let i = 0; i < list.length - 1; i++) {
      const prev = list[i];
      const next = list[i + 1];
      const fee = prev.terms?.buyout || 0;
      if (prev.terminationReason !== "transfer" || fee <= 0 || prev.team === next.team) continue;
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

  // 4) Złożenie per drużyna (+ budżet startowy, koszty bieżące)
  const names = new Set<string>([...teams.map(t => t.name), ...ledgers.keys()]);
  const out = new Map<string, TeamFinance>();
  for (const team of names) {
    const rank = rankOf.get(team) ?? 999;
    const s = settings[team] || {};
    const startingBalance = s.startingBalance ?? defaultStartingBalance(rank);
    const monthlyRunning = s.monthlyRunning ?? defaultMonthlyRunning(rank);
    const ledger = ledgers.get(team) || [];
    const epoch = firstContract.get(team);
    const epochDay = epoch ? new Date(epoch).toISOString().slice(0, 10) : nowDay;
    ledger.push({ id: `start_${team}`, date: epochDay, amount: startingBalance, category: "start", label: "Budżet startowy" });
    if (epoch && rankOf.has(team) && nowMs > epoch && monthlyRunning > 0) {
      const months = (nowMs - epoch) / DAY / MONTH_DAYS;
      ledger.push({
        id: `run_${team}`, date: nowDay, amount: -Math.round(monthlyRunning * months), category: "running",
        label: `Marketing, eventy, bootcampy (${months.toFixed(1)} mies.)`,
      });
    }
    ledger.sort((a, b) => b.date.localeCompare(a.date));
    let income = 0, expenses = 0;
    const byCategory: Partial<Record<LedgerCategory, number>> = {};
    for (const e of ledger) {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
      if (e.category === "start") continue;
      if (e.amount >= 0) income += e.amount; else expenses -= e.amount;
    }
    const salaries = contracts
      .filter(c => c.team === team && !c.terminatedAt && ms(c.startDate) <= nowMs && ms(c.endDate) > nowMs)
      .reduce((a, c) => a + c.salary, 0);
    const balance = startingBalance + income - expenses;
    out.set(team, {
      team, balance, income, expenses, byCategory, ledger, startingBalance, monthlyRunning,
      monthlyBurn: salaries + (rankOf.has(team) ? monthlyRunning : 0),
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
  return all().get(team) || null;
}

/** Tylko aktywne drużyny — do tabeli finansów ligi. */
export function getLeagueFinances(): TeamFinance[] {
  const active = new Set(loadAllTeams().map(t => t.name));
  return [...all().values()].filter(f => active.has(f.team)).sort((a, b) => b.balance - a.balance);
}

export const HEALTH_LABEL: Record<FinanceHealth, string> = {
  ok: "Stabilnie",
  low: "Niski budżet",
  negative: "Na minusie",
  critical: "Grubo pod kreską",
};
