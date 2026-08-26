// ===== Player contracts system =====
//
// A full data module (not just UI): contracts are generated for every rostered
// player, persisted through the standard storage helper (so device backups and
// the change log capture them), and integrated with transfers, free agents and
// the fictional world clock.
//
// Storage key: "player_contracts" (list of every contract ever, including
// historical ones — the history is derived by filtering per player).

import { teamDatabase } from "@/data/tournaments";
import { playerRoles, type PlayerRole } from "@/data/playerRoles";
import { loadFromStorage, saveToStorage } from "./storage";
import { getWorldNow, getWorldNowIso } from "./worldClock";
import { computeAllPlayersBasicStats } from "./playerCareerStats";
import { canonicalTeamName } from "./teamRenames";
import type { TeamData, Transfer } from "./types";

export const CONTRACTS_KEY = "player_contracts";
export const CONTRACTS_EVENT = "contracts:update";

export type ContractStatus = "active" | "warning" | "critical" | "expired" | "terminated";

export interface ContractTerms {
  /** Kwota odstępnego (buyout) w USD. */
  buyout?: number;
  /** Premia za podpis w USD. */
  signingBonus?: number;
  /** Dodatkowe zapisy (klauzule) — tekst. */
  note?: string;
  /** Rola ustalona w kontrakcie. */
  role?: PlayerRole | "";
}

export interface PlayerContract {
  id: string;
  player: string;
  team: string;
  /** ISO */
  startDate: string;
  /** ISO */
  endDate: string;
  /** Miesięczne wynagrodzenie w USD. */
  salary: number;
  /** ISO — kiedy kontrakt został podpisany. */
  signedAt: string;
  /** Ustawiane tylko przy ręcznym/automatycznym zakończeniu. */
  terminatedAt?: string;
  terminationReason?: "transfer" | "renewal" | "release" | "expired";
  terms: ContractTerms;
}

export const SALARY_MIN = 800;
export const SALARY_MAX = 90_000;
export const MIN_CONTRACT_MONTHS = 1;
export const MAX_CONTRACT_MONTHS = 60;

// ---------------------------------------------------------------- storage

export function loadContracts(): PlayerContract[] {
  return loadFromStorage<PlayerContract[]>(CONTRACTS_KEY, []);
}

export function saveContracts(list: PlayerContract[]): void {
  saveToStorage(CONTRACTS_KEY, list);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CONTRACTS_EVENT));
  }
}

// ---------------------------------------------------------------- helpers

export function loadLiveTeams(): TeamData[] {
  const stored = loadFromStorage<TeamData[] | null>("ranking_data", null);
  return stored && stored.length > 0 ? stored : teamDatabase;
}

/** Kluby (bez reprezentacji narodowych) posortowane wg punktów. */
export function clubTeams(): TeamData[] {
  return loadLiveTeams().filter(t => !t.isNational).sort((a, b) => b.points - a.points);
}

export function addMonthsIso(iso: string, months: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Handle month overflow (31 Jan + 1 month)
  if (d.getDate() < day) d.setDate(0);
  return d.toISOString();
}

export function monthsBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / (30.4375 * 86_400_000)));
}

export function daysLeft(endIso: string, nowMs = getWorldNow().getTime()): number {
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(end)) return 0;
  return Math.ceil((end - nowMs) / 86_400_000);
}

export function formatSalary(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

export function formatDatePl(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatRemaining(days: number): string {
  if (days < 0) return `wygasł ${Math.abs(days)} dni temu`;
  if (days === 0) return "wygasa dziś";
  if (days < 45) return `${days} dni`;
  const months = Math.round(days / 30.4375);
  if (months < 12) return `${months} mies.`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years} l. ${rest} mies.` : `${years} ${years === 1 ? "rok" : "lata"}`;
}

/** Status wyliczany zawsze z aktualnej (fikcyjnej) daty — nigdy trzymany na sztywno. */
export function contractStatus(c: PlayerContract, nowMs = getWorldNow().getTime()): ContractStatus {
  if (c.terminatedAt) return "terminated";
  const d = daysLeft(c.endDate, nowMs);
  if (d < 0) return "expired";
  if (d <= 30) return "critical";
  if (d <= 90) return "warning";
  return "active";
}

export const STATUS_LABEL: Record<ContractStatus, string> = {
  active: "Aktywny",
  warning: "Wygasa (≤90 dni)",
  critical: "Pilne (≤30 dni)",
  expired: "Wygasł",
  terminated: "Zakończony",
};

export const STATUS_CLASS: Record<ContractStatus, string> = {
  active: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  warning: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  critical: "text-orange-400 border-orange-500/40 bg-orange-500/10",
  expired: "text-destructive border-destructive/40 bg-destructive/10",
  terminated: "text-muted-foreground border-border bg-secondary/40",
};

// ---------------------------------------------------------------- queries

/** Bieżący (niezakończony) kontrakt zawodnika — również jeśli już wygasł. */
export function getCurrentContract(player: string, list?: PlayerContract[]): PlayerContract | undefined {
  const all = list ?? loadContracts();
  return all
    .filter(c => c.player === player && !c.terminatedAt)
    .sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""))[0];
}

/** Aktywny kontrakt = niezakończony i jeszcze nie wygasły. */
export function getActiveContract(player: string, list?: PlayerContract[]): PlayerContract | undefined {
  const c = getCurrentContract(player, list);
  if (!c) return undefined;
  return contractStatus(c) === "expired" ? undefined : c;
}

export function getContractHistory(player: string, list?: PlayerContract[]): PlayerContract[] {
  const all = list ?? loadContracts();
  return all
    .filter(c => c.player === player)
    .sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
}

export function getTeamContracts(team: string, list?: PlayerContract[]): PlayerContract[] {
  const all = list ?? loadContracts();
  const canonical = canonicalTeamName(team);
  return all.filter(c => !c.terminatedAt && canonicalTeamName(c.team) === canonical);
}

export interface ContractSummary {
  total: number;
  active: number;
  warning: number;
  critical: number;
  expired: number;
  payroll: number;
}

export function summarizeTeamContracts(team: string, list?: PlayerContract[]): ContractSummary {
  const contracts = getTeamContracts(team, list);
  const out: ContractSummary = { total: contracts.length, active: 0, warning: 0, critical: 0, expired: 0, payroll: 0 };
  for (const c of contracts) {
    const s = contractStatus(c);
    if (s === "expired") out.expired += 1;
    else {
      out.payroll += c.salary;
      if (s === "critical") out.critical += 1;
      else if (s === "warning") out.warning += 1;
      else out.active += 1;
    }
  }
  return out;
}

/** Czy drużyna ma jakikolwiek kontrakt wymagający uwagi (do ikonki w rankingu). */
export function teamContractAlert(team: string, list?: PlayerContract[]): "none" | "warning" | "critical" | "expired" {
  const s = summarizeTeamContracts(team, list);
  if (s.expired > 0) return "expired";
  if (s.critical > 0) return "critical";
  if (s.warning > 0) return "warning";
  return "none";
}

// ---------------------------------------------------------------- salary

const ROLE_MULTIPLIER: Record<string, number> = {
  IGL: 1.18,
  AWPer: 1.15,
  Entry: 1.05,
  Lurker: 1.0,
  Anchor: 0.98,
  Coach: 0.7,
};

function hash(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Deterministyczny "random" 0..1 dla danego ziarna (te same dane = ten sam wynik). */
export function seededRandom(seed: string): number {
  return (hash(seed) % 100000) / 100000;
}

/**
 * Wyliczenie wynagrodzenia:
 *  baza z siły drużyny (pozycja w rankingu) × modyfikator siły zawodnika
 *  (rating z istniejącego systemu statystyk) × modyfikator roli × losowość.
 */
export function suggestSalary(player: string, team: string, seedSalt = ""): number {
  const teams = clubTeams();
  const idx = teams.findIndex(t => canonicalTeamName(t.name) === canonicalTeamName(team));
  const rank = idx === -1 ? teams.length + 10 : idx + 1;

  // Baza: ~$28k dla #1, ~$2.5k poza top 100.
  const base = 2200 + 26000 / Math.pow(rank, 0.62);

  // Siła zawodnika z istniejących statystyk (rating). Brak meczów → neutralnie.
  let ratingFactor = 1;
  try {
    const stats = computeAllPlayersBasicStats("all").get(player);
    if (stats && stats.matches >= 3) {
      ratingFactor = Math.min(1.85, Math.max(0.6, 1 + (stats.rating - 1) * 2.6));
    }
  } catch { /* stats optional */ }

  const role = (playerRoles as Record<string, string>)[player];
  const roleFactor = ROLE_MULTIPLIER[role] ?? 1;

  // Losowość: 0.82 – 1.28 (deterministyczna per zawodnik+drużyna+salt).
  const rnd = 0.82 + seededRandom(`sal|${player}|${team}|${seedSalt}`) * 0.46;

  const raw = base * ratingFactor * roleFactor * rnd;
  const rounded = Math.round(raw / 100) * 100;
  return Math.min(SALARY_MAX, Math.max(SALARY_MIN, rounded));
}

/** Sugerowana długość kontraktu 4–24 miesiące (losowa, deterministyczna). */
export function suggestDurationMonths(player: string, team: string, seedSalt = ""): number {
  return 4 + Math.floor(seededRandom(`dur|${player}|${team}|${seedSalt}`) * 21); // 4..24
}

// ---------------------------------------------------------------- validation

export interface ContractDraft {
  player: string;
  team: string;
  startDate: string;
  endDate: string;
  salary: number;
  terms?: ContractTerms;
}

export function validateContract(draft: ContractDraft, list?: PlayerContract[]): string | null {
  if (!draft.player.trim()) return "Brak zawodnika.";
  if (!draft.team || draft.team === "-") return "Brak drużyny.";
  const start = new Date(draft.startDate).getTime();
  const end = new Date(draft.endDate).getTime();
  if (!Number.isFinite(start)) return "Nieprawidłowa data rozpoczęcia.";
  if (!Number.isFinite(end)) return "Nieprawidłowa data zakończenia.";
  if (end <= start) return "Data zakończenia musi być późniejsza niż rozpoczęcia.";
  const months = monthsBetween(draft.startDate, draft.endDate);
  if (months < MIN_CONTRACT_MONTHS) return "Kontrakt musi trwać co najmniej 1 miesiąc.";
  if (months > MAX_CONTRACT_MONTHS) return "Kontrakt nie może trwać dłużej niż 5 lat.";
  if (!Number.isFinite(draft.salary)) return "Nieprawidłowe wynagrodzenie.";
  if (draft.salary < SALARY_MIN) return `Wynagrodzenie nie może być niższe niż ${formatSalary(SALARY_MIN)}.`;
  if (draft.salary > SALARY_MAX) return `Wynagrodzenie nie może przekraczać ${formatSalary(SALARY_MAX)}.`;

  const existing = getActiveContract(draft.player, list);
  if (existing && canonicalTeamName(existing.team) !== canonicalTeamName(draft.team)) {
    return `${draft.player} ma już aktywny kontrakt z ${existing.team} (do ${formatDatePl(existing.endDate)}). Zakończ go przed podpisaniem nowego.`;
  }
  return null;
}

// ---------------------------------------------------------------- mutations

function newId(): string {
  return `ctr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Zamyka bieżący kontrakt zawodnika (bez zapisu — zwraca zmodyfikowaną listę). */
function closeCurrent(
  list: PlayerContract[],
  player: string,
  atIso: string,
  reason: PlayerContract["terminationReason"],
): PlayerContract[] {
  return list.map(c =>
    c.player === player && !c.terminatedAt
      ? { ...c, terminatedAt: atIso, terminationReason: reason, endDate: reason === "renewal" ? c.endDate : atIso }
      : c,
  );
}

export interface CreateContractResult {
  ok: boolean;
  error?: string;
  contract?: PlayerContract;
}

/**
 * Podpisanie kontraktu. Poprzedni kontrakt zawodnika trafia do historii.
 * Zwraca błąd bez żadnej mutacji, jeśli walidacja się nie powiedzie.
 */
export function signContract(
  draft: ContractDraft,
  options: { reason?: PlayerContract["terminationReason"]; skipDuplicateCheck?: boolean } = {},
): CreateContractResult {
  const list = loadContracts();
  const checkList = options.skipDuplicateCheck
    ? list.filter(c => c.player !== draft.player)
    : list;
  const error = validateContract(draft, checkList);
  if (error) return { ok: false, error };

  const contract: PlayerContract = {
    id: newId(),
    player: draft.player,
    team: draft.team,
    startDate: draft.startDate,
    endDate: draft.endDate,
    salary: Math.round(draft.salary),
    signedAt: getWorldNowIso(),
    terms: draft.terms || {},
  };

  const closed = closeCurrent(list, draft.player, draft.startDate, options.reason || "transfer");
  saveContracts([...closed, contract]);
  return { ok: true, contract };
}

/** Odnowienie kontraktu: stary trafia do historii, nowy startuje dziś (lub od podanej daty). */
export function renewContract(
  player: string,
  input: { months: number; salary: number; startDate?: string; terms?: ContractTerms },
): CreateContractResult {
  const current = getCurrentContract(player);
  if (!current) return { ok: false, error: "Zawodnik nie ma kontraktu do odnowienia." };
  const startDate = input.startDate || getWorldNowIso();
  const endDate = addMonthsIso(startDate, input.months);
  return signContract(
    {
      player,
      team: current.team,
      startDate,
      endDate,
      salary: input.salary,
      terms: { ...current.terms, ...(input.terms || {}) },
    },
    { reason: "renewal", skipDuplicateCheck: true },
  );
}

/**
 * Szybkie przedłużenie wygasającego kontraktu o N miesięcy.
 * Nowy kontrakt startuje w dniu wygaśnięcia starego, pensja bez zmian
 * (chyba że podano inną).
 */
export function extendContract(
  player: string,
  months = 12,
  salary?: number,
): CreateContractResult {
  const current = getCurrentContract(player);
  if (!current) return { ok: false, error: "Zawodnik nie ma kontraktu do przedłużenia." };
  return renewContract(player, {
    months,
    salary: salary ?? current.salary,
    startDate: current.endDate,
  });
}


/** Rozwiązanie kontraktu (np. przy odejściu do FA). */
export function terminateContract(
  player: string,
  reason: PlayerContract["terminationReason"] = "release",
  atIso = getWorldNowIso(),
): void {
  const list = loadContracts();
  if (!list.some(c => c.player === player && !c.terminatedAt)) return;
  saveContracts(closeCurrent(list, player, atIso, reason));
}

// ---------------------------------------------------------------- seeding

/** Data dołączenia do drużyny wg logu transferów (jeśli istnieje). */
function joinDateFor(player: string, team: string, transfers: Transfer[]): string | null {
  const joins = transfers
    .filter(t => t.player === player && canonicalTeamName(t.newTeam) === canonicalTeamName(team) && t.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  return joins.length ? joins[joins.length - 1].date : null;
}

export interface SeedResult {
  created: number;
  skipped: number;
}

/**
 * Bezpieczny seed: każdy zawodnik/trener bez aktywnego kontraktu dostaje jeden.
 * Nigdy nie tworzy drugiego kontraktu dla kogoś, kto już go ma.
 */
export function seedMissingContracts(): SeedResult {
  const list = loadContracts();
  const transfers = loadFromStorage<Transfer[]>("transfers_data", []);
  const nowMs = getWorldNow().getTime();
  const created: PlayerContract[] = [];
  let skipped = 0;

  for (const team of clubTeams()) {
    const people = [...team.roster, ...(team.coach ? [team.coach] : [])];
    for (const player of people) {
      const existing = getCurrentContract(player, [...list, ...created]);
      if (existing) { skipped += 1; continue; }

      const months = suggestDurationMonths(player, team.name);
      const join = joinDateFor(player, team.name, transfers);
      let startDate: string;
      if (join) {
        startDate = new Date(join).toISOString();
      } else {
        // Losowy start w przeszłości: 0–18 miesięcy przed "dziś" w świecie gry.
        const back = Math.floor(seededRandom(`start|${player}|${team.name}`) * 18);
        startDate = addMonthsIso(new Date(nowMs).toISOString(), -back);
      }
      let endDate = addMonthsIso(startDate, months);
      // Kontrakt nie może być z góry wygasły przy seedzie — przesuwamy koniec.
      if (new Date(endDate).getTime() <= nowMs) {
        const extra = 2 + Math.floor(seededRandom(`ext|${player}|${team.name}`) * 20);
        endDate = addMonthsIso(new Date(nowMs).toISOString(), extra);
      }

      created.push({
        id: `${newId()}-${created.length}`,
        player,
        team: team.name,
        startDate,
        endDate,
        salary: suggestSalary(player, team.name),
        signedAt: startDate,
        terms: { role: (playerRoles as Record<string, PlayerRole>)[player] },
      });
    }
  }

  if (created.length > 0) saveContracts([...list, ...created]);
  return { created: created.length, skipped };
}

// ---------------------------------------------------------------- expiry

export interface ExpiredRelease {
  player: string;
  team: string;
  endDate: string;
}

/**
 * Kontrakty, które wygasną przy przeskoku zegara świata z `fromMs` do `toMs`
 * (jeszcze ważne dziś, ale po przejściu daty będą już po terminie).
 */
export function contractsExpiringBetween(fromMs: number, toMs: number): PlayerContract[] {
  if (toMs <= fromMs) return [];
  return loadContracts()
    .filter(c => !c.terminatedAt)
    .filter(c => daysLeft(c.endDate, fromMs) >= 0 && daysLeft(c.endDate, toMs) < 0)
    .sort((a, b) => (a.endDate || "").localeCompare(b.endDate || ""));
}


/**
 * Automatyczna obsługa wygasania: kontrakty po dacie końca są zamykane,
 * a zawodnik trafia do wolnych agentów (transfer do "-"), co widać w panelu
 * transferów. Zwraca listę wykonanych zwolnień.
 */
export function processExpiredContracts(): ExpiredRelease[] {
  const list = loadContracts();
  const nowMs = getWorldNow().getTime();
  const expired = list.filter(c => !c.terminatedAt && daysLeft(c.endDate, nowMs) < 0);
  if (expired.length === 0) return [];

  const nowIso = getWorldNowIso();
  const releases: ExpiredRelease[] = [];
  let next = list;

  for (const c of expired) {
    next = next.map(x => (x.id === c.id
      ? { ...x, terminatedAt: nowIso, terminationReason: "expired" as const }
      : x));
    releases.push({ player: c.player, team: c.team, endDate: c.endDate });
  }
  saveContracts(next);
  return releases;
}
