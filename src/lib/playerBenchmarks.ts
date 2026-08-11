// ===== Benchmarki ligowe graczy =====
// Liczy rozkład podstawowych metryk (rating, KPR, DPR, KAST, ADR, UD/rundę)
// dla WSZYSTKICH graczy z bazy turniejów i pozwala policzyć percentyl
// konkretnego zawodnika na tle reszty ligi.

import type { TournamentData, MatchResult, MapPlayerStats } from "./types";
import { calculateRating } from "./playerStats";
import { loadFromStorage } from "./storage";

export type BenchmarkKey = "rating" | "kpr" | "dpr" | "kast" | "adr" | "udr";

export interface Benchmarks {
  /** Posortowane rosnąco wartości dla każdej metryki (jeden wpis = jeden gracz). */
  dist: Record<BenchmarkKey, number[]>;
  /** Średnia ligowa dla każdej metryki. */
  avg: Record<BenchmarkKey, number>;
  players: number;
}

const EMPTY = (): Benchmarks => ({
  dist: { rating: [], kpr: [], dpr: [], kast: [], adr: [], udr: [] },
  avg: { rating: 0, kpr: 0, dpr: 0, kast: 0, adr: 0, udr: 0 },
  players: 0,
});

/** Minimalna liczba rund, by gracz wliczał się do benchmarków (odsiewa jednorazowe występy). */
const MIN_ROUNDS = 60;

function build(tournaments?: TournamentData[]): Benchmarks {
  const ts = tournaments ?? loadFromStorage<TournamentData[]>("tournaments_data", []) ?? [];
  interface Acc {
    kills: number; deaths: number; assists: number;
    ud: number; ef: number; adrW: number; kastW: number; rounds: number;
    ratingSum: number; matches: number;
  }
  const perPlayer = new Map<string, Acc>();
  const get = (n: string): Acc => {
    let a = perPlayer.get(n);
    if (!a) {
      a = { kills: 0, deaths: 0, assists: 0, ud: 0, ef: 0, adrW: 0, kastW: 0, rounds: 0, ratingSum: 0, matches: 0 };
      perPlayer.set(n, a);
    }
    return a;
  };

  for (const t of ts) {
    const all: MatchResult[] = [];
    for (const phase of t.phases || []) {
      if (phase.bracket) all.push(...phase.bracket);
      if (phase.groups) for (const g of phase.groups) all.push(...g.matches);
    }
    if (t.matches) all.push(...t.matches);

    for (const match of all) {
      if (!match.maps) continue;
      const local = new Map<string, { isTeam1: boolean; kills: number; deaths: number; assists: number; ud: number; ef: number; adrW: number; kastW: number; rounds: number }>();
      const push = (players: MapPlayerStats[] | undefined, isTeam1: boolean, rounds: number) => {
        if (!players) return;
        for (const p of players) {
          let a = local.get(p.playerName);
          if (!a) {
            a = { isTeam1, kills: 0, deaths: 0, assists: 0, ud: 0, ef: 0, adrW: 0, kastW: 0, rounds: 0 };
            local.set(p.playerName, a);
          }
          a.kills += p.kills; a.deaths += p.deaths; a.assists += p.assists;
          a.ud += p.ud; a.ef += p.ef;
          a.adrW += p.adr * rounds; a.kastW += p.kast * rounds; a.rounds += rounds;
        }
      };
      for (const map of match.maps) {
        const rounds = (map.score1 || 0) + (map.score2 || 0);
        if (rounds <= 0) continue;
        push(map.team1Players, true, rounds);
        push(map.team2Players, false, rounds);
      }
      for (const [name, a] of local) {
        if (a.rounds === 0) continue;
        const rating = calculateRating({
          playerName: name,
          team: a.isTeam1 ? match.team1 : match.team2,
          kills: a.kills, deaths: a.deaths, assists: a.assists,
          adr: Math.round(a.adrW / a.rounds),
          kast: Math.round(a.kastW / a.rounds),
          ud: a.ud, ef: a.ef, rounds: a.rounds,
        });
        const acc = get(name);
        acc.kills += a.kills; acc.deaths += a.deaths; acc.assists += a.assists;
        acc.ud += a.ud; acc.ef += a.ef;
        acc.adrW += a.adrW; acc.kastW += a.kastW; acc.rounds += a.rounds;
        acc.ratingSum += rating; acc.matches += 1;
      }
    }
  }

  const out = EMPTY();
  const sums: Record<BenchmarkKey, number> = { rating: 0, kpr: 0, dpr: 0, kast: 0, adr: 0, udr: 0 };
  for (const acc of perPlayer.values()) {
    if (acc.rounds < MIN_ROUNDS || acc.matches === 0) continue;
    const vals: Record<BenchmarkKey, number> = {
      rating: acc.ratingSum / acc.matches,
      kpr: acc.kills / acc.rounds,
      dpr: acc.deaths / acc.rounds,
      kast: acc.kastW / acc.rounds,
      adr: acc.adrW / acc.rounds,
      udr: acc.ud / acc.rounds,
    };
    (Object.keys(vals) as BenchmarkKey[]).forEach(k => {
      out.dist[k].push(vals[k]);
      sums[k] += vals[k];
    });
    out.players++;
  }
  (Object.keys(sums) as BenchmarkKey[]).forEach(k => {
    out.dist[k].sort((a, b) => a - b);
    out.avg[k] = out.players ? sums[k] / out.players : 0;
  });
  return out;
}

// ===== cache (unieważniany przy zmianie danych) =====
let cache: Benchmarks | null = null;
const bump = () => { cache = null; };
if (typeof window !== "undefined") {
  ["tournaments:update", "teams:update", "ranking:update", "storage"].forEach(ev =>
    window.addEventListener(ev, bump),
  );
}

export function getBenchmarks(): Benchmarks {
  if (!cache) cache = build();
  return cache;
}

/**
 * Percentyl gracza (0-100) dla danej metryki.
 * `lowerIsBetter` odwraca skalę (np. DPR — mniej śmierci = lepiej).
 */
export function percentileOf(key: BenchmarkKey, value: number, lowerIsBetter = false): number {
  const arr = getBenchmarks().dist[key];
  if (!arr.length || !Number.isFinite(value)) return 50;
  let below = 0;
  for (const v of arr) { if (v < value) below++; else break; }
  const pct = (below / arr.length) * 100;
  return Math.round(lowerIsBetter ? 100 - pct : pct);
}
