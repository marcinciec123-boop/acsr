import { memoOnSave } from "./dataMemo";
// ===== Statistics Portal =====
// Liquipedia-style aggregate statistics computed from the local tournament
// database: prize money totals, earnings per organization/player, medal
// counts and the largest prize pools — filterable per year.

import { loadFromStorage } from "@/lib/storage";
import type { TournamentData } from "@/lib/types";
import { ORG_CUT, parsePrizePool, resolveTournamentPrizes } from "@/lib/prizeDistribution";
import { getTeamRosterAt } from "@/lib/rankingHistory";
import { getTournamentLineup } from "@/lib/tournamentLineups";
import { resolveLineup } from "@/lib/tournamentLineups";
import { isMajorTournament } from "@/lib/majors";
import { canonicalTeamName, nameKey, sameName } from "./teamRenames";

export type Tier = "S" | "A" | "B" | "C";

export interface OrgStat {
  team: string;
  earnings: number;
  gold: number;
  silver: number;
  bronze: number;
  events: number;
  titles: { id: string; name: string; tier: Tier; major: boolean }[];
}

export interface PlayerStat {
  player: string;
  earnings: number;
  gold: number;
  events: number;
  teams: string[];
}

export interface BigPool {
  id: string;
  name: string;
  pool: number;
  tier: Tier;
  major: boolean;
  startDate: string;
  location: string;
  winner?: string;
}

export interface PortalStats {
  years: string[];
  tournamentCount: number;
  tierCounts: Record<Tier, number>;
  totalPrize: number;
  lanPrize: number;
  onlinePrize: number;
  matchCount: number;
  mapCount: number;
  orgs: OrgStat[];
  players: PlayerStat[];
  biggestPools: BigPool[];
  majorCount: number;
}

const yearOf = (t: TournamentData): string => (t.startDate || "").slice(0, 4);

const isOnline = (t: TournamentData): boolean =>
  /online|zdalnie/i.test(t.location || "");

/** Nazwy reprezentacji narodowych — pomijane w zarobkach organizacji. */
export function nationalTeamNames(): Set<string> {
  try {
    const teams = loadFromStorage<{ name: string; isNational?: boolean }[]>("ranking_data", []) || [];
    return new Set(teams.filter(t => t.isNational).map(t => t.name));
  } catch {
    return new Set<string>();
  }
}

export function loadStatsTournaments(): TournamentData[] {
  return loadFromStorage<TournamentData[]>("tournaments_data", []) || [];
}


export const computePortalStats = memoOnSave<string, PortalStats>(computePortalStatsRaw);

function computePortalStatsRaw(year: string | "total"): PortalStats {
  const all = loadStatsTournaments().filter(t => t.kind !== "qualifier");
  const years = Array.from(new Set(all.map(yearOf).filter(Boolean))).sort().reverse();
  const list = year === "total" ? all : all.filter(t => yearOf(t) === year);

  const tierCounts: Record<Tier, number> = { S: 0, A: 0, B: 0, C: 0 };
  let totalPrize = 0;
  let lanPrize = 0;
  let onlinePrize = 0;
  let matchCount = 0;
  let mapCount = 0;
  let majorCount = 0;

  const national = new Set([...nationalTeamNames()].map(team => nameKey(canonicalTeamName(team))));
  const currentNames = new Map(
    loadFromStorage<{ name: string }[]>("ranking_data", []).map(t => [nameKey(canonicalTeamName(t.name)), t.name]),
  );
  const orgMap = new Map<string, OrgStat>();
  const playerMap = new Map<string, PlayerStat>();
  const biggestPools: BigPool[] = [];


  for (const t of list) {
    const tier = (t.tier || "C") as Tier;
    tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    const major = isMajorTournament(t);
    if (major) majorCount++;

    const pool = parsePrizePool(t.prizePool);
    const distributed = resolveTournamentPrizes(t);
    const awarded = Object.values(distributed).reduce((a, b) => a + b, 0);
    totalPrize += awarded;
    if (isOnline(t)) onlinePrize += awarded; else lanPrize += awarded;

    // matches / maps
    const collect = (t.phases || []).flatMap(p => [
      ...(p.bracket || []),
      ...((p.groups || []).flatMap(g => g.matches || [])),
    ]).concat(t.matches || []);
    for (const m of collect) {
      if ((m.score1 || 0) + (m.score2 || 0) > 0) {
        matchCount++;
        mapCount += (m.maps || []).filter(mp => (mp.score1 || 0) + (mp.score2 || 0) > 0).length || 1;
      }
    }

    const winner = (t.placements || []).find(p => p.placement === 1)?.team;
    if (pool > 0) {
      biggestPools.push({
        id: t.id, name: t.name, pool, tier, major,
        startDate: t.startDate, location: t.location, winner,
      });
    }

    for (const pl of t.placements || []) {
      if (!pl.team) continue;
      // Reprezentacje narodowe nie są organizacjami — pomijamy w zarobkach.
      const canonical = canonicalTeamName(pl.team);
      const key = nameKey(canonical);
      const team = currentNames.get(key) || canonical;
      if (national.has(key)) continue;
      const prize = distributed[pl.placement] || 0;

      const org = orgMap.get(key) || {
        team, earnings: 0, gold: 0, silver: 0, bronze: 0, events: 0, titles: [],
      };
      org.earnings += prize;
      org.events += 1;
      if (pl.placement === 1) { org.gold++; org.titles.push({ id: t.id, name: t.name, tier, major }); }
      else if (pl.placement === 2) org.silver++;
      else if (pl.placement === 3 || pl.placement === 4) org.bronze++;
      orgMap.set(key, org);

      // Only players who actually represented the team at that event earn money:
      // explicit tournament lineup > historical roster snapshot at the event date
      // > current active roster (fallback for freshly created events).
      const explicit = getTournamentLineup(t.id, pl.team);
      const historical = getTeamRosterAt(pl.team, t.endDate || t.startDate || "");
      const roster = (explicit.length ? explicit : historical.length ? historical : resolveLineup(t.id, pl.team))
        .filter(Boolean)
        .slice(0, 5);
      if (roster.length) {
        // 25% of the team's winnings goes to the organisation, the rest is split.
        const playersPot = prize * (1 - ORG_CUT);
        const share = Math.round(playersPot / roster.length);
        for (const p of roster) {
          const ps = playerMap.get(p) || { player: p, earnings: 0, gold: 0, events: 0, teams: [] };
          ps.earnings += share;
          ps.events += 1;
          if (pl.placement === 1) ps.gold++;
          if (!ps.teams.some(name => sameName(name, team))) ps.teams.push(team);
          playerMap.set(p, ps);
        }
      }
    }
  }

  return {
    years,
    tournamentCount: list.length,
    tierCounts,
    totalPrize,
    lanPrize,
    onlinePrize,
    matchCount,
    mapCount,
    majorCount,
    orgs: [...orgMap.values()].sort((a, b) => b.earnings - a.earnings || b.gold - a.gold),
    players: [...playerMap.values()].sort((a, b) => b.earnings - a.earnings || b.gold - a.gold),
    biggestPools: biggestPools.sort((a, b) => b.pool - a.pool).slice(0, 25),
  };
}

// ===== Lekki cache zarobków (profil drużyny / gracza) =====
// computePortalStats jest kosztowne, a profile potrzebują tylko jednej pozycji.
// Cache jest unieważniany przy każdej zmianie danych turniejów/rankingu.
let earningsCache: { stats: PortalStats; stamp: number } | null = null;
let cacheStamp = 0;
const bumpCache = () => { cacheStamp++; earningsCache = null; };
if (typeof window !== "undefined") {
  ["tournaments:update", "teams:update", "ranking:update", "storage"].forEach(ev =>
    window.addEventListener(ev, bumpCache),
  );
}

function totalStats(): PortalStats {
  if (earningsCache && earningsCache.stamp === cacheStamp) return earningsCache.stats;
  const stats = computePortalStats("total");
  earningsCache = { stats, stamp: cacheStamp };
  return stats;
}

export interface EarningsSummary {
  earnings: number;
  events: number;
  gold: number;
  /** Miejsce w rankingu zarobków (1-based) lub null. */
  rank: number | null;
}

export function getTeamEarnings(team: string): EarningsSummary {
  const { orgs } = totalStats();
  const currentName = canonicalTeamName(team);
  const idx = orgs.findIndex(o => sameName(canonicalTeamName(o.team), currentName));
  if (idx < 0) return { earnings: 0, events: 0, gold: 0, rank: null };
  const o = orgs[idx];
  return { earnings: o.earnings, events: o.events, gold: o.gold, rank: idx + 1 };
}

export function getPlayerEarnings(player: string): EarningsSummary {
  const { players } = totalStats();
  const idx = players.findIndex(p => p.player === player);
  if (idx < 0) return { earnings: 0, events: 0, gold: 0, rank: null };
  const p = players[idx];
  return { earnings: p.earnings, events: p.events, gold: p.gold, rank: idx + 1 };
}

