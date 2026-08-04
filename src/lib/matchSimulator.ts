// ===== Strength-based match simulator =====
//
// Generates a full match (BO1 / BO3 / BO5) based on team "strength" (ranking
// points). Produces per-map MatchMap objects with consistent player stats that
// honor the following invariants:
//
//   1. For each map: sum(team1.kills) === sum(team2.deaths)
//      and          sum(team2.kills) === sum(team1.deaths)
//   2. For each player on a map: 0 <= deaths <= rounds (a player can die at
//      most once per round, so total team deaths <= rounds).
//   3. Per map round score is realistic: winner reaches 13 (or 16/19 in OT),
//      loser between 0 and winner-1.
//   4. ADR / KAST / UD / EF are derived from kills, deaths, rounds and a
//      per-player skill weight, so they stay in sensible CS:GO ranges.
//   5. Per-map ratings (HLTV 3.0) are filled in for every player.

import type { MatchMap, MapPlayerStats } from "./types";
import { calculateRating } from "./playerStats";
import { teamDatabase } from "@/data/tournaments";
import { loadFromStorage } from "./storage";
import type { TeamData } from "./types";
import { getBenchedFor } from "./benchedPlayers";
import { getTournamentLineup } from "./tournamentLineups";

export const SIM_MAP_POOL = [
  "Anubis", "Ancient", "Dust II", "Inferno",
  "Mirage", "Nuke", "Overpass", "Train", "Vertigo",
];

// ----- helpers -----------------------------------------------------------

const rand = () => Math.random();
const randRange = (min: number, max: number) => min + rand() * (max - min);
const randInt = (min: number, max: number) => Math.floor(randRange(min, max + 1));

const getTeamStrength = (teamName: string): number => {
  const stored = loadFromStorage<TeamData[] | null>("ranking_data", null);
  const src = stored && stored.length > 0 ? stored : teamDatabase;
  const t = src.find(x => x.name === teamName);
  return Math.max(100, t?.points ?? 800);
};

const getRoster = (teamName: string, tournamentId?: string): string[] => {
  const stored = loadFromStorage<TeamData[] | null>("ranking_data", null);
  const src = stored && stored.length > 0 ? stored : teamDatabase;
  const t = src.find(x => x.name === teamName);

  // 1) Tournament-specific lineup wins if set.
  if (tournamentId) {
    const explicit = getTournamentLineup(tournamentId, teamName);
    if (explicit.length > 0) {
      const roster = explicit.slice(0, 5);
      while (roster.length < 5) roster.push(`Player ${roster.length + 1}`);
      return roster;
    }
  }

  // 2) Otherwise: full roster minus benched players.
  const benched = new Set(getBenchedFor(teamName));
  const active = (t?.roster || []).filter(p => !benched.has(p));
  const roster = active.slice(0, 5);
  while (roster.length < 5) roster.push(`Player ${roster.length + 1}`);
  return roster;
};

/** Pick `count` distinct maps from the pool */
const pickMaps = (count: number): string[] => {
  const shuffled = [...SIM_MAP_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

/**
 * Distribute a non-negative integer `total` into `count` buckets weighted by
 * `weights`, with each bucket capped at `cap` (if provided). Always sums
 * exactly to `total` (or to count*cap if total > count*cap).
 */
const distributeWeighted = (total: number, weights: number[], cap?: number): number[] => {
  const n = weights.length;
  if (total <= 0) return Array(n).fill(0);
  const sumW = weights.reduce((s, w) => s + Math.max(0.01, w), 0);
  let raw = weights.map(w => (Math.max(0.01, w) / sumW) * total);
  let out = raw.map(v => Math.round(v));
  // Fix rounding drift
  let drift = total - out.reduce((s, v) => s + v, 0);
  // Apply drift to highest-weighted buckets first
  const order = weights.map((w, i) => ({ w, i })).sort((a, b) => b.w - a.w).map(x => x.i);
  let idx = 0;
  while (drift !== 0) {
    const i = order[idx % n];
    if (drift > 0) { out[i]++; drift--; }
    else if (out[i] > 0) { out[i]--; drift++; }
    idx++;
    if (idx > n * 50) break;
  }
  // Apply cap and redistribute overflow
  if (cap !== undefined) {
    let overflow = 0;
    out = out.map(v => {
      if (v > cap) { overflow += v - cap; return cap; }
      return v;
    });
    while (overflow > 0) {
      let placed = false;
      for (const i of order) {
        if (out[i] < cap) { out[i]++; overflow--; placed = true; if (overflow === 0) break; }
      }
      if (!placed) break;
    }
  }
  // Final clamp
  return out.map(v => Math.max(0, v));
};

// ----- public API --------------------------------------------------------

export interface SimulateOptions {
  /** Override map names (length should match expected mapsPlayed). */
  maps?: string[];
  /** Force a specific score (e.g. 2-1). If omitted derived from strength. */
  forcedScore?: { score1: number; score2: number };
  /** Tournament context: if set and a per-tournament lineup exists for either
   *  team, that lineup is used instead of the team's active roster. */
  tournamentId?: string;
}

/**
 * Decide map-score (e.g. 2-1) for a BO based on relative strengths.
 */
const decideSeriesScore = (s1: number, s2: number, bo: 1 | 3 | 5): { s1: number; s2: number; mapsToWin: number } => {
  const mapsToWin = bo === 1 ? 1 : bo === 3 ? 2 : 3;
  if (bo === 1) {
    const p = s1 / (s1 + s2);
    const t1Wins = rand() < p;
    return { s1: t1Wins ? 1 : 0, s2: t1Wins ? 0 : 1, mapsToWin };
  }
  // Per-map win prob derived from strengths but clamped so upsets stay possible
  const baseP = s1 / (s1 + s2);
  const p = 0.15 + 0.7 * baseP; // clamp into [0.15, 0.85]
  let won1 = 0, won2 = 0;
  while (won1 < mapsToWin && won2 < mapsToWin) {
    if (rand() < p) won1++; else won2++;
  }
  return { s1: won1, s2: won2, mapsToWin };
};

/**
 * Decide round score for a single map (winner reaches 13, optional OT).
 */
const decideMapRounds = (): { winnerRounds: number; loserRounds: number } => {
  const isOT = rand() < 0.12;
  if (isOT) {
    // OT trigger = regulation 12-12. Each OT is MR3 (first to 4, must win by 2
    // in this sim — a 3-3 OT forces another OT).
    // OT1 winner reaches 16 (12+4), OT2 19, OT3 22, OT4 25...
    const otCount = rand() < 0.78 ? 1 : 2;
    const winnerRounds = 13 + 3 * otCount; // 16, 19, 22, 25...
    // Loser already had previous OTs end 3-3, so loser >= 12 + 3*(otCount-1)
    const loserMin = 12 + 3 * (otCount - 1);
    const loserMax = winnerRounds - 2; // must lose by >= 2
    const loserRounds = randInt(loserMin, loserMax);

    return { winnerRounds, loserRounds };
  }
  const winnerRounds = 13;
  // Regulation: loser must be <= 11 (otherwise it'd be 12-12 -> OT).
  const loserRounds = Math.max(2, Math.min(11, Math.round(randRange(3, 11))));
  return { winnerRounds, loserRounds };
};

/**
 * Generate stats for one map respecting all invariants.
 */
const buildMapStats = (
  team1: string,
  team2: string,
  team1Roster: string[],
  team2Roster: string[],
  team1Strength: number,
  team2Strength: number,
  team1Rounds: number,
  team2Rounds: number,
  mapName: string,
): MatchMap => {
  const totalRounds = team1Rounds + team2Rounds;

  // Per-player skill weights — random spread that doesn't depend on names so
  // every player gets a chance to top-frag, but slightly biased by team
  // strength.
  const skillSpread = (n: number, baseStrength: number) =>
    Array.from({ length: n }, () => {
      const stretch = baseStrength / 1000;
      // weights centered around 1, with team-strength multiplier
      return Math.max(0.4, randRange(0.6, 1.5)) * (0.85 + 0.3 * stretch);
    });

  const t1Skills = skillSpread(5, team1Strength);
  const t2Skills = skillSpread(5, team2Strength);

  // ===== Total kills per team =====
  // Invariants we MUST honor:
  //   - Per player: 0 <= deaths <= totalRounds (a player dies at most once per
  //     round). So per team, total deaths <= 5 * totalRounds.
  //   - Per map: sum(team1.kills) === sum(team2.deaths) and vice versa.
  // Realistic CS:GO model:
  //   - Round you WIN: ~4.3 kills on the winning side (most wins end in a wipe).
  //   - Round you LOSE: ~1.6 kills on the losing side (trades/economy damage
  //     dying — a few rounds you get 0).
  // This gives top fraggers ~18-25 kills on a 25-round map (KPR ~0.8-1.0).
  const baseTeamKills = (ownRoundsWon: number, oppRoundsWon: number) =>
    ownRoundsWon * randRange(4.0, 4.7) + oppRoundsWon * randRange(1.0, 2.1);

  // Hard cap per team: 5 * totalRounds (5 enemies alive per round = max kills
  // possible). In practice we never get close to this.
  const teamKillCap = 5 * totalRounds;
  let team1Kills = Math.min(teamKillCap, Math.max(totalRounds, Math.round(baseTeamKills(team1Rounds, team2Rounds))));
  let team2Kills = Math.min(teamKillCap, Math.max(totalRounds, Math.round(baseTeamKills(team2Rounds, team1Rounds))));

  // ===== Per-player kill split =====
  // Cap individual kills at totalRounds (KPR <= 1.0 enforced — top frag in CS
  // is rarely above this; 1.2 KPR is monster-game tier).
  // Allow slight leeway for star players: cap at min(rounds, ceil(team/3)+rounds*0.4).
  const perPlayerKillCap = totalRounds;
  const t1Kills = distributeWeighted(team1Kills, t1Skills, perPlayerKillCap);
  const t2Kills = distributeWeighted(team2Kills, t2Skills, perPlayerKillCap);

  // ===== Deaths invariant: team1 deaths == team2 kills, etc. =====
  // Per-player death cap: one death per round. Distribute inversely to skill
  // (weaker players die more).
  const perPlayerDeathCap = totalRounds;
  const t1DeathWeights = t1Skills.map(s => 1 / Math.max(0.4, s));
  const t2DeathWeights = t2Skills.map(s => 1 / Math.max(0.4, s));
  const t1Deaths = distributeWeighted(team2Kills, t1DeathWeights, perPlayerDeathCap);
  const t2Deaths = distributeWeighted(team1Kills, t2DeathWeights, perPlayerDeathCap);

  // ===== Build per-player rows =====
  const buildRow = (
    name: string, teamName: string, kills: number, deaths: number, skill: number,
  ): MapPlayerStats => {
    // Assists: roughly 3-7 on a standard 24-round map.
    const assists = Math.min(totalRounds, Math.max(0, Math.round(totalRounds * randRange(0.12, 0.28))));
    // ADR includes lethal damage, assists and non-lethal chip damage. A neutral
    // 0.65 KPR / 0.20 APR player lands around 78 ADR; stars can exceed 100.
    const kpr = kills / Math.max(1, totalRounds);
    const apr = assists / Math.max(1, totalRounds);
    const adr = Math.round(Math.min(165, Math.max(35, 14 + kpr * randRange(88, 98) + apr * randRange(24, 38) + randRange(-4, 6))));
    // Neutral pro-level KAST sits near 70%; kills, assists and survival move it.
    const dpr = deaths / Math.max(1, totalRounds);
    const kastBase = 69 + (kpr - 0.65) * 24 - (dpr - 0.65) * 22 + (apr - 0.2) * 14;
    const kast = Math.round(Math.min(94, Math.max(42, kastBase + randRange(-4, 4))));
    // Utility damage: 5-90, weighted by skill
    const ud = Math.max(0, Math.round(randRange(5, 80) * (0.7 + 0.5 * skill / 1.5)));
    // Enemies flashed: 0-6
    const ef = Math.max(0, Math.round(randRange(0, 5)));
    const stats: MapPlayerStats = {
      playerName: name,
      team: teamName,
      kills,
      assists,
      deaths,
      adr,
      kast,
      ud,
      ef,
    };
    stats.rating = calculateRating({ ...stats, rounds: totalRounds });
    return stats;
  };

  const team1Players = team1Roster.map((n, i) => buildRow(n, team1, t1Kills[i], t1Deaths[i], t1Skills[i]));
  const team2Players = team2Roster.map((n, i) => buildRow(n, team2, t2Kills[i], t2Deaths[i], t2Skills[i]));

  // Sanity: invariants
  // sum(t1.kills) == sum(t2.deaths)
  const sumT1K = team1Players.reduce((s, p) => s + p.kills, 0);
  const sumT2D = team2Players.reduce((s, p) => s + p.deaths, 0);
  const sumT2K = team2Players.reduce((s, p) => s + p.kills, 0);
  const sumT1D = team1Players.reduce((s, p) => s + p.deaths, 0);
  if (sumT1K !== sumT2D || sumT2K !== sumT1D) {
    // Distribution rounding edge — patch the largest player on the deaths side
    const fixSide = (players: MapPlayerStats[], target: number) => {
      const cur = players.reduce((s, p) => s + p.deaths, 0);
      let drift = target - cur;
      const order = players.map((p, i) => ({ d: p.deaths, i })).sort((a, b) => b.d - a.d).map(x => x.i);
      let idx = 0;
      while (drift !== 0 && idx < players.length * 50) {
        const i = order[idx % players.length];
        if (drift > 0 && players[i].deaths < totalRounds) { players[i].deaths++; drift--; }
        else if (drift < 0 && players[i].deaths > 0) { players[i].deaths--; drift++; }
        idx++;
      }
      // Recompute rating
      players.forEach(p => { p.rating = calculateRating({ ...p, rounds: totalRounds }); });
    };
    fixSide(team1Players, sumT2K);
    fixSide(team2Players, sumT1K);
  }

  // ===== Strony i wynik pierwszej połowy (połowa = 12 rund) =====
  const team1StartSide: "T" | "CT" = rand() < 0.5 ? "T" : "CT";
  const firstHalfRounds = Math.min(12, totalRounds);
  // Rozkład rund w pierwszej połowie proporcjonalny do końcowego wyniku,
  // z lekkim losowym odchyleniem (CT zwykle nieco mocniejsze).
  const share = totalRounds > 0 ? team1Rounds / totalRounds : 0.5;
  const bias = team1StartSide === "CT" ? 0.06 : -0.06;
  let half1Score1 = Math.round(firstHalfRounds * Math.min(0.92, Math.max(0.08, share + bias + randRange(-0.12, 0.12))));
  half1Score1 = Math.max(0, Math.min(firstHalfRounds, Math.min(half1Score1, team1Rounds)));
  let half1Score2 = firstHalfRounds - half1Score1;
  if (half1Score2 > team2Rounds) {
    half1Score2 = team2Rounds;
    half1Score1 = firstHalfRounds - half1Score2;
  }

  return {
    map: mapName,
    score1: team1Rounds,
    score2: team2Rounds,
    team1StartSide,
    half1Score1,
    half1Score2,
    team1Players,
    team2Players,
  };
};

export interface SimulationResult {
  score1: number; // map wins
  score2: number;
  maps: MatchMap[];
}

export function simulateMatch(
  team1: string,
  team2: string,
  bo: 1 | 3 | 5,
  options: SimulateOptions = {},
): SimulationResult {
  const team1Roster = getRoster(team1, options.tournamentId);
  const team2Roster = getRoster(team2, options.tournamentId);
  const s1 = getTeamStrength(team1);
  const s2 = getTeamStrength(team2);

  const series = options.forcedScore
    ? { s1: options.forcedScore.score1, s2: options.forcedScore.score2, mapsToWin: bo === 1 ? 1 : bo === 3 ? 2 : 3 }
    : decideSeriesScore(s1, s2, bo);

  const totalMaps = series.s1 + series.s2;
  const mapNames = options.maps && options.maps.length >= totalMaps
    ? options.maps.slice(0, totalMaps)
    : pickMaps(totalMaps);

  const maps: MatchMap[] = [];
  let won1 = 0, won2 = 0;
  for (let i = 0; i < totalMaps; i++) {
    const remaining = totalMaps - i;
    const need1 = series.s1 - won1;
    const need2 = series.s2 - won2;
    let team1WinsMap: boolean;
    if (need1 === remaining) team1WinsMap = true;
    else if (need2 === remaining) team1WinsMap = false;
    else team1WinsMap = rand() < (need1 / remaining);

    const { winnerRounds, loserRounds } = decideMapRounds();
    const t1Rounds = team1WinsMap ? winnerRounds : loserRounds;
    const t2Rounds = team1WinsMap ? loserRounds : winnerRounds;

    if (team1WinsMap) won1++; else won2++;

    maps.push(buildMapStats(
      team1, team2, team1Roster, team2Roster,
      s1, s2, t1Rounds, t2Rounds, mapNames[i],
    ));
  }

  return { score1: series.s1, score2: series.s2, maps };
}
