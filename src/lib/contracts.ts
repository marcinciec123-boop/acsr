// ===== Player contracts =====
// Każdy gracz (i trener) mający klub ma dokładnie jeden aktywny kontrakt.
// Data startu = data transferu do tej drużyny (jeśli istnieje), inaczej null.
// Data końca = maks. 2 lata od startu, deterministycznie "losowa" per gracz.
// Po wygaśnięciu gracz trafia do wolnych agentów + wpis na liście transferów.

import { teamDatabase } from "@/data/tournaments";
import { customTransfersGlobal, type Transfer as RawTransfer } from "@/data/history";
import { loadFromStorage, saveToStorage } from "./storage";
import { getWorldDate, getWorldNowIso, WORLD_CLOCK_EVENT } from "./worldClock";
import { removeFromAllBenches } from "./benchedPlayers";
import type { TeamData, Transfer } from "./types";

export type ContractStatus = "active" | "expired";

export interface Contract {
  id: string;
  player: string;
  team: string;
  /** ISO date (YYYY-MM-DD) albo null gdy brak zarejestrowanego transferu. */
  start_date: string | null;
  /** ISO date (YYYY-MM-DD). */
  end_date: string;
  status: ContractStatus;
  /** Miesięczna płaca w EUR. */
  salary?: number;
}

const CONTRACTS_KEY = "player_contracts";
const RANKING_KEY = "ranking_data";
const TRANSFERS_KEY = "transfers_data";
const DAY = 86_400_000;

export const CONTRACTS_EVENT = "contracts:update";

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseIso = (iso: string): Date => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
};
const addDays = (iso: string, days: number): string => {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
};

const hash = (value: string): number => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

// ===== Płace =====
/** Formatuje kwotę w EUR (kompaktowo). */
export function formatMoney(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`;
  if (value >= 1_000) return `€${Math.round(value / 1_000)}K`;
  return `€${Math.round(value)}`;
}

/** Pozycja drużyny w rankingu klubowym (1-indexed) albo duża liczba gdy brak. */
function teamRankOf(team: string): number {
  const clubs = liveTeams().filter(t => !t.isNational).sort((a, b) => b.points - a.points);
  const idx = clubs.findIndex(t => t.name === team);
  return idx >= 0 ? idx + 1 : 120;
}

/**
 * Losowa (deterministyczna) miesięczna płaca — im lepsza drużyna, tym większa.
 * Top 1 ≈ €38K, top 10 ≈ €20K, top 50 ≈ €5K, poza setką ≈ €1.5K.
 */
export function suggestSalary(player: string, team: string): number {
  if (!team || team === "-") return 0;
  const rank = teamRankOf(team);
  const base = 1_400 + 40_000 * Math.exp(-(rank - 1) / 26);
  const h = hash(`salary|${player}|${team}`);
  const variance = 0.78 + ((h % 1000) / 1000) * 0.5; // 0.78 - 1.28
  const raw = base * variance;
  const step = raw > 10_000 ? 500 : 100;
  return Math.max(800, Math.round(raw / step) * step);
}

// ===== Wartość transferowa =====
let ratingCache: { at: number; map: Map<string, BasicPlayerStats> } | null = null;

function ratingsMap(): Map<string, BasicPlayerStats> {
  if (ratingCache && Date.now() - ratingCache.at < 30_000) return ratingCache.map;
  let map = new Map<string, BasicPlayerStats>();
  try {
    map = computeAllPlayersBasicStats("year");
  } catch {
    map = new Map();
  }
  ratingCache = { at: Date.now(), map };
  return map;
}

export interface MarketValue {
  value: number;
  /** Średni rating z ostatniego roku (0 gdy brak meczów). */
  rating: number;
  matches: number;
  /** Mnożnik formy (1.0 = przeciętna). */
  formFactor: number;
}

/**
 * Wartość transferowa gracza — bazuje na sile drużyny (ranking / płaca)
 * oraz formie (średni rating z ostatniego roku, ważony liczbą meczów).
 */
export function getMarketValue(player: string, team?: string): MarketValue {
  const club = team && team !== "-" ? team : (getActiveContract(player)?.team ?? "");
  const stats = ratingsMap().get(player);
  const rating = stats?.rating ?? 0;
  const matches = stats?.matches ?? 0;

  // Im mniej meczów, tym bliżej neutralnej formy (1.0).
  const confidence = Math.min(1, matches / 25);
  const raw = rating > 0 ? Math.pow(rating, 3.1) : 1;
  const formFactor = Math.max(0.45, Math.min(2.4, 1 + (raw - 1) * confidence));

  const salary = club ? suggestSalary(player, club) : 900;
  const rank = club ? teamRankOf(club) : 120;
  const prestige = 0.75 + 1.35 * Math.exp(-(rank - 1) / 32);
  const h = hash(`mv|${player}|${club}`);
  const variance = 0.88 + ((h % 1000) / 1000) * 0.28; // 0.88 - 1.16

  const rawValue = salary * 12 * prestige * formFactor * variance;
  const step = rawValue > 1_000_000 ? 50_000 : rawValue > 250_000 ? 10_000 : rawValue > 50_000 ? 5_000 : 1_000;
  return {
    value: Math.max(5_000, Math.round(rawValue / step) * step),
    rating,
    matches,
    formFactor: Math.round(formFactor * 100) / 100,
  };
}

/**
 * Kwota odstępnego przy transferze klub → klub — pochodna wartości transferowej,
 * skorygowana o prestiż klubu kupującego.
 */
export function suggestTransferFee(player: string, fromTeam: string, toTeam: string): number {
  if (!fromTeam || !toTeam || fromTeam === "-" || toTeam === "-") return 0;
  const mv = getMarketValue(player, fromTeam).value;
  const toRank = teamRankOf(toTeam);
  const demand = 0.8 + 0.9 * Math.exp(-(toRank - 1) / 40);
  const h = hash(`fee|${player}|${fromTeam}|${toTeam}`);
  const variance = 0.8 + ((h % 1000) / 1000) * 0.6; // 0.8 - 1.4
  const raw = mv * demand * variance;
  const step = raw > 500_000 ? 25_000 : raw > 50_000 ? 5_000 : 1_000;
  return Math.max(5_000, Math.round(raw / step) * step);
}


export function loadContracts(): Contract[] {
  return loadFromStorage<Contract[]>(CONTRACTS_KEY, []);
}

function saveContracts(list: Contract[]): void {
  saveToStorage(CONTRACTS_KEY, list);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CONTRACTS_EVENT));
}

export function getActiveContract(player: string): Contract | null {
  return loadContracts().find(c => c.player === player && c.status === "active") || null;
}

const liveTeams = (): TeamData[] => {
  const stored = loadFromStorage<TeamData[] | null>(RANKING_KEY, null);
  return stored && stored.length > 0 ? stored : teamDatabase;
};

/** Data ostatniego transferu gracza do danej drużyny (YYYY-MM-DD) albo null. */
function transferStartDate(player: string, team: string): string | null {
  const stored = loadFromStorage<Transfer[]>(TRANSFERS_KEY, []);
  const matches = stored
    .filter(t => t.player === player && t.newTeam === team && !!t.date)
    .map(t => t.date.slice(0, 10))
    .sort();
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

/** Tworzy brakujące aktywne kontrakty dla wszystkich zawodników z drużyną. */
export function ensureContracts(): void {
  const now = getWorldDate();
  const list = loadContracts();
  const activeByPlayer = new Map(list.filter(c => c.status === "active").map(c => [c.player, c]));
  let changed = false;

  for (const team of liveTeams()) {
    if (team.isNational) continue;
    const people = [...team.roster, ...(team.coach ? [team.coach] : [])];
    for (const player of people) {
      if (!player) continue;
      const existing = activeByPlayer.get(player);
      if (existing) {
        // Jeden aktywny kontrakt na gracza — trzymamy drużynę w zgodzie z rosterem.
        if (existing.team !== team.name) {
          existing.team = team.name;
          existing.start_date = transferStartDate(player, team.name);
          existing.salary = suggestSalary(player, team.name);
          changed = true;
        } else if (!existing.salary) {
          existing.salary = suggestSalary(player, team.name);
          changed = true;
        }
        continue;
      }

      const h = hash(`${player}|${team.name}`);
      const start = transferStartDate(player, team.name);
      const base = start && start <= now ? start : now;
      // maks. 2 lata (730 dni) od startu kontraktu
      let end = addDays(base, 210 + (h % 521));
      if (end <= now) end = addDays(now, 20 + (h % 640));

      list.push({
        id: `ct-${h.toString(36)}-${player.length}`,
        player,
        team: team.name,
        start_date: start,
        end_date: end,
        status: "active",
        salary: suggestSalary(player, team.name),
      });
      activeByPlayer.set(player, list[list.length - 1]);
      changed = true;
    }
  }

  if (changed) saveContracts(list);
}

/** Wygasza kontrakty, których data końca minęła — gracz zostaje wolnym agentem. */
export function processExpiredContracts(): number {
  const now = getWorldDate();
  const list = loadContracts();
  const expiring = list.filter(c => c.status === "active" && c.end_date < now);
  if (expiring.length === 0) return 0;

  const ranking = loadFromStorage<TeamData[] | null>(RANKING_KEY, null);
  const transfers = loadFromStorage<Transfer[]>(TRANSFERS_KEY, []);
  const stamp = getWorldNowIso();

  for (const c of expiring) {
    c.status = "expired";

    // Runtime roster
    const rt = teamDatabase.find(t => t.name === c.team);
    if (rt) {
      rt.roster = rt.roster.filter(p => p !== c.player);
      if (rt.coach === c.player) rt.coach = undefined;
    }
    removeFromAllBenches(c.player);

    // Wpis na liście transferów (odejście do wolnych agentów)
    if (!transfers.some(t => t.player === c.player && t.oldTeam === c.team && t.newTeam === "-" && t.date?.slice(0, 10) === now)) {
      transfers.unshift({
        id: `contract-${c.id}`,
        player: c.player,
        oldTeam: c.team,
        newTeam: "-",
        date: stamp,
      });
      const raw: RawTransfer = { player: c.player, oldTeam: c.team, newTeam: "-" };
      customTransfersGlobal.push(raw);
    }
  }

  if (ranking) {
    const players = new Set(expiring.map(c => c.player));
    saveToStorage(RANKING_KEY, ranking.map(team => (
      players.size === 0 ? team : {
        ...team,
        roster: team.roster.filter(p => !players.has(p)),
        coach: team.coach && players.has(team.coach) ? undefined : team.coach,
      }
    )));
  }

  saveToStorage(TRANSFERS_KEY, transfers);
  saveToStorage("custom_transfers", customTransfersGlobal);
  saveContracts(list);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("teams:update"));
    window.dispatchEvent(new CustomEvent("ranking:update"));
  }
  return expiring.length;
}

/**
 * Podpisuje nowy kontrakt (wygaszając poprzedni aktywny gracza).
 * Używane przy ręcznym transferze — użytkownik ustala długość i płacę.
 */
export function signContract(
  player: string,
  team: string,
  options: { months: number; salary: number; startDate?: string },
): Contract | null {
  const list = loadContracts();
  for (const c of list) if (c.player === player && c.status === "active") c.status = "expired";
  if (!team || team === "-") {
    saveContracts(list);
    return null;
  }
  const start = options.startDate || getWorldDate();
  const contract: Contract = {
    id: `ct-${hash(`${player}|${team}|${start}`).toString(36)}-${Date.now().toString(36)}`,
    player,
    team,
    start_date: start,
    end_date: addDays(start, Math.max(1, Math.round(options.months * 30.4))),
    status: "active",
    salary: Math.max(0, Math.round(options.salary)),
  };
  list.push(contract);
  saveContracts(list);
  return contract;
}

export type ContractUrgency = "ok" | "soon" | "urgent" | "critical";

export interface ContractInfo {
  contract: Contract;
  daysLeft: number;
  urgency: ContractUrgency;
}

export function getContractInfo(player: string): ContractInfo | null {
  const contract = getActiveContract(player);
  if (!contract) return null;
  const daysLeft = Math.round((parseIso(contract.end_date).getTime() - parseIso(getWorldDate()).getTime()) / DAY);
  const urgency: ContractUrgency =
    daysLeft < 10 ? "critical" : daysLeft <= 30 ? "urgent" : daysLeft <= 90 ? "soon" : "ok";
  return { contract, daysLeft, urgency };
}

export function formatRemaining(daysLeft: number): string {
  if (daysLeft <= 0) return "wygasa dziś";
  if (daysLeft < 31) return `${daysLeft} dni`;
  const months = Math.floor(daysLeft / 30);
  if (months < 12) return `${months} mies.`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest > 0 ? `${years} r. ${rest} mies.` : `${years} r.`;
}

/** Startowa synchronizacja + nasłuch na zmiany fikcyjnego kalendarza. */
export function installContractsWatcher(): void {
  const sync = () => {
    processExpiredContracts();
    ensureContracts();
  };
  sync();
  if (typeof window === "undefined") return;
  window.addEventListener(WORLD_CLOCK_EVENT, sync);
  window.addEventListener("teams:update", () => ensureContracts());
}
