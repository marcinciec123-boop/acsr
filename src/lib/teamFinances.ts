import { getTeamRankingSeries } from "@/lib/rankingHistory";
import { isMatchDecided } from "./matchStatus";
// ===== Finanse organizacji =====
// Bilans jest WYLICZANY z istniejących danych (turnieje, kontrakty) + ręcznych
// wpisów użytkownika. Nic nie dzieje się automatycznie — żadnych bankructw ani
// sprzedaży graczy. Wynik jest liczony jednym przebiegiem dla wszystkich drużyn
// i cache'owany do czasu realnej zmiany danych (brak lagów przy renderach).

import { loadFromStorage, saveToStorage } from "./storage";
import type { MatchResult, TournamentData } from "./types";
import { ORG_CUT, resolveTournamentPrizes } from "./prizeDistribution";
import { CONTRACTS_EVENT, loadContracts, seededRandom, type PlayerContract } from "./contracts";
import { getWorldDate, WORLD_CLOCK_DEFAULT } from "./worldClock";
import { loadAllTeams } from "./teamManagement";
import { canonicalTeamName, sameName } from "./teamRenames";

export const FINANCES_EVENT = "finances:update";
const ENTRIES_KEY = "team_finance_entries";
const SETTINGS_KEY = "team_finance_settings";

export type LedgerCategory = "prize" | "sponsor" | "merch" | "media" | "stickers" | "sponsor_bonus" | "transfer_in" | "transfer_out" | "salary" | "bonus" | "running" | "staff" | "manual_in" | "manual_out" | "start";

export const CATEGORY_LABEL: Record<LedgerCategory, string> = {
  start: "Budżet startowy",
  prize: "Nagrody turniejowe (25%)",
  sponsor: "Sponsorzy (miesięcznie)",
  sponsor_bonus: "Premie sponsorskie za wyniki",
  merch: "Fan store i koszulki",
  media: "Prawa transmisyjne (turnieje TV)",
  stickers: "Naklejki z Majorów",
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
  const base = rank <= 10 ? 38_000 : rank <= 30 ? 20_000 : rank <= 60 ? 10_000 : 5_000;
  return round(base * jitter(team, "run", 0.6, 1.5), 500);
}
export function defaultMonthlyStaff(rank: number, team = ""): number {
  const base = rank <= 10 ? 28_000 : rank <= 30 ? 16_000 : rank <= 60 ? 8_000 : 3_500;
  return round(base * jitter(team, "staff", 0.65, 1.45), 500);
}

/** Stopniowa adaptacja kosztów: wzrost max 15% luki/mies., cięcia 25% luki/mies. */
export function adaptCost(prev: number | null, target: number): number {
  if (prev === null) return target;
  const gap = target - prev;
  const step = gap > 0 ? gap * 0.15 : gap * 0.25;
  return Math.abs(gap) < 500 ? target : Math.round(prev + step);
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

// ---------- przychody eventowe ----------

/** Prawa transmisyjne za udział w turnieju TV (Tier S/A) — każdy uczestnik. */
export function mediaRightsFor(tier: string, placement: number): number {
  const base = tier === "S" ? 60_000 : tier === "A" ? 30_000 : 0;
  const mult = placement === 1 ? 2 : placement === 2 ? 1.6 : placement <= 4 ? 1.3 : placement <= 8 ? 1.1 : 1;
  return Math.round(base * mult);
}
/** Premia sponsorów za podium w turnieju TV. */
export function sponsorBonusFor(tier: string, placement: number): number {
  const t = tier === "S" ? [50_000, 25_000, 15_000] : tier === "A" ? [25_000, 12_000, 6_000] : [0, 0, 0];
  return placement === 1 ? t[0] : placement === 2 ? t[1] : placement <= 4 ? t[2] : 0;
}
/** Udział w sprzedaży naklejek z Majora. */
export function stickerMoneyFor(placement: number): number {
  return placement === 1 ? 400_000 : placement === 2 ? 320_000 : placement <= 4 ? 260_000 : placement <= 8 ? 200_000 : 150_000;
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

  // 1a) Turnieje telewizyjne (Tier S/A): prawa transmisyjne dla KAŻDEGO
  // uczestnika (niezależnie od rankingu), premie sponsorskie za podium oraz
  // naklejki dla uczestników Majorów.
  for (const t of tournaments) {
    if (t.status !== "completed" || !t.placements?.length) continue;
    const date = day(t.endDate || t.startDate) || nowDay;
    const tv = t.tier === "S" || t.tier === "A";
    const major = /major/i.test(t.name);
    for (const pl of t.placements) {
      if (!pl.team || pl.team === "-") continue;
      const p = pl.placement;
      if (tv) {
        push(pl.team, { id: `media_${t.id}`, date, amount: mediaRightsFor(t.tier, p), category: "media", label: `Prawa TV: ${t.name}` });
        const sb = sponsorBonusFor(t.tier, p);
        if (sb > 0) push(pl.team, { id: `sbon_${t.id}`, date, amount: sb, category: "sponsor_bonus", label: `Premia sponsorów: ${t.name} (miejsce ${p})` });
      }
      if (major) push(pl.team, { id: `stk_${t.id}`, date, amount: stickerMoneyFor(p), category: "stickers", label: `Naklejki: ${t.name}` });
    }
  }

  // 1b) Forma sportowa do wyceny sponsorów (mecze + miejsca, fikcyjne daty)
  const TIER_W: Record<string, number> = { S: 1, A: 0.6, B: 0.35, C: 0.2 };
  const perf = new Map<string, { at: number; win?: boolean; w: number; place?: number }[]>();
  const addPerf = (team: string, ev: { at: number; win?: boolean; w: number; place?: number }) => {
    if (!team || team === "-") return;
    const k = canonicalTeamName(team);
    let l = perf.get(k);
    if (!l) { l = []; perf.set(k, l); }
    l.push(ev);
  };
  for (const t of tournaments) {
    const w = TIER_W[t.tier] ?? 0.3;
    const tDate = day(t.endDate || t.startDate);
    const tAt = tDate ? ms(tDate) : NaN;
    const all: MatchResult[] = [...(t.matches || [])];
    for (const p of t.phases || []) {
      if (p.bracket) all.push(...p.bracket);
      for (const g of p.groups || []) all.push(...(g.matches || []));
    }
    for (const m of all) {
      if (!isMatchDecided(m)) continue;
      const at = m.scheduledAt ? ms(m.scheduledAt) : day(t.startDate) ? ms(day(t.startDate)) : NaN;
      if (!Number.isFinite(at)) continue;
      const one = m.score1 > m.score2;
      addPerf(m.team1, { at, win: one, w });
      addPerf(m.team2, { at, win: !one, w });
    }
    if (t.status === "completed" && Number.isFinite(tAt)) {
      for (const pl of t.placements || []) addPerf(pl.team, { at: tAt, w, place: pl.placement });
    }
  }
  const sponsorBase = (rank: number, team: string) => {
    const base = rank <= 3 ? 140_000 : rank <= 5 ? 110_000 : rank <= 10 ? 80_000 : rank <= 20 ? 50_000 : rank <= 30 ? 32_000 : rank <= 60 ? 16_000 : 7_000;
    return base * jitter(team, "spon", 0.8, 1.25);
  };
  /** Wycena miesięczna: baza z rozpoznawalności × forma z ostatnich 90 dni przed wypłatą. */
  const sponsorFor = (team: string, rank: number, at: number) => {
    const from = at - 90 * 86_400_000;
    let wins = 0, games = 0, bonus = 0;
    for (const e of perf.get(team) || []) {
      if (e.at < from || e.at >= at) continue;
      if (e.place !== undefined) {
        bonus += e.w * (e.place === 1 ? 0.3 : e.place === 2 ? 0.15 : e.place <= 4 ? 0.07 : e.place <= 8 ? 0.02 : -0.03);
      } else {
        games += e.w; if (e.win) wins += e.w;
      }
    }
    const form = games >= 0.6 ? 0.7 + (wins / games) * 0.6 : 1; // 0.7..1.3
    const b = Math.max(-0.15, Math.min(0.7, bonus));
    const mood = jitter(team, `spon_${monthKey(at)}`, 0.9, 1.1);
    return round(sponsorBase(rank, team) * form * (1 + b) * mood, 500);
  };
  /** Fan store: baza z rozpoznawalności × hype po wynikach (90 dni). */
  const merchFor = (team: string, rank: number, at: number) => {
    const base = rank <= 5 ? 45_000 : rank <= 10 ? 32_000 : rank <= 20 ? 22_000 : rank <= 30 ? 14_000 : rank <= 60 ? 7_000 : 3_000;
    let hype = 0;
    for (const e of perf.get(team) || []) {
      if (e.place === undefined || e.at < at - 90 * 86_400_000 || e.at >= at) continue;
      hype += e.w * (e.place === 1 ? 0.6 : e.place === 2 ? 0.3 : e.place <= 4 ? 0.12 : 0);
    }
    return round(base * jitter(team, "merch", 0.8, 1.2) * (1 + Math.min(1, hype)) * jitter(team, `merch_${monthKey(at)}`, 0.9, 1.1), 500);
  };

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
      if (prev.terminationReason !== "transfer" || fee <= 0 || sameName(canonicalTeamName(prev.team), canonicalTeamName(next.team))) continue;
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
    const fixedStaff = s.monthlyStaff;
    const fixedRunning = s.monthlyRunning;
    let monthlyStaff = fixedStaff ?? defaultMonthlyStaff(rank, team);
    const ledger = ledgers.get(team) || [];
    const fc = firstContract.get(team);
    // Aktywne drużyny płacą koszty stałe od startu sezonu niezależnie od dat
    // kontraktów (kontrakty z „przyszłą” datą po cofnięciu zegara nie mogą
    // wyłączać miesięcznych obciążeń).
    const epoch = rankOf.has(team) ? seasonStart : (fc !== undefined ? Math.max(fc, seasonStart) : undefined);
    const epochDay = epoch ? new Date(epoch).toISOString().slice(0, 10) : nowDay;
    ledger.push({ id: `start_${team}`, date: epochDay, amount: startingBalance, category: "start", label: "Budżet startowy" });
    let runLevel = monthlyRunning;
    if (epoch && rankOf.has(team)) {
      const series = getTeamRankingSeries(team);
      const rankAt = (at: number) => {
        const d = new Date(at).toISOString().slice(0, 10);
        let r: number | undefined;
        for (const p of series) { if (p.date <= d) r = p.rank ?? r; else break; }
        return r ?? series.find(p => p.rank)?.rank ?? rank;
      };
      let staffLevel: number | null = null;
      let runL: number | null = null;
      for (const at of firstsOfMonth(epoch + 1, nowMs)) {
        const date = day(new Date(at).toISOString());
        const mk = monthKey(at);
        const rk = rankAt(at);
        const tStaff = defaultMonthlyStaff(rk, team), tRun = defaultMonthlyRunning(rk, team);
        staffLevel = adaptCost(staffLevel, tStaff);
        runL = adaptCost(runL, tRun);
        const st = fixedStaff ?? staffLevel;
        const rn = fixedRunning ?? runL;
        monthlyStaff = st; runLevel = rn;
        if (rn > 0) ledger.push({ id: `run_${team}_${mk}`, date, amount: -Math.round(rn), category: "running", label: `Marketing, eventy, bootcampy ${mk}` });
        if (st > 0) ledger.push({ id: `staff_${team}_${mk}`, date, amount: -Math.round(st), category: "staff", label: `Personel ${mk}` });
        const spon = sponsorFor(team, rank, at);
        const mer = merchFor(team, rank, at);
        if (mer > 0) ledger.push({ id: `merch_${team}_${mk}`, date, amount: mer, category: "merch", label: `Fan store ${mk}` });
        if (spon > 0) ledger.push({ id: `spon_${team}_${mk}`, date, amount: spon, category: "sponsor", label: `Sponsorzy ${mk}` });
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
      team, balance, income, expenses, monthIncome, monthExpenses, month: curMonth, byCategory, ledger, startingBalance, monthlyRunning: runLevel, monthlyStaff,
      monthlyBurn: salaries + (rankOf.has(team) ? runLevel + monthlyStaff : 0),
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
