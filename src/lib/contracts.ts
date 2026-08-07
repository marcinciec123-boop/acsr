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
