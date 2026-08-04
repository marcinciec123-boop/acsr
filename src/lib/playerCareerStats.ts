// ===== Aggregate career stats for a single player across all tournaments =====
//
// Walks the saved tournaments_data (flat MatchResult.maps[].team{1,2}Players)
// and produces an HLTV-style profile: career rating, K/D, ADR, KAST, per-map
// breakdown, recent matches, head-to-head opponents, etc.

import type { TournamentData, MatchResult, MapPlayerStats } from "./types";
import { calculateRating, type PlayerMatchStats } from "./playerStats";
import { loadFromStorage } from "./storage";
import { worldNowMs } from "./worldClock";

export interface CareerMatchEntry {
  tournamentId: string;
  tournamentName: string;
  matchId: string;
  team: string;
  opponent: string;
  ownScore: number;
  oppScore: number;
  ownRounds: number;
  oppRounds: number;
  /** Per-map round scores from player's perspective (e.g. ["13:10","16:14"]) */
  mapScores: string[];
  won: boolean;
  bo: 1 | 3 | 5;
  /** Round label for display (e.g. "Quarterfinals", "Swiss R1") */
  round?: string;
  /** ISO timestamp from the match (when finalized) — used for chronological sort. */
  playedAt?: string;
  /** Aggregated across all maps in this match */
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  kast: number;
  ud: number;
  ef: number;
  rounds: number;
  rating: number;
  maps: {
    map: string;
    score1: number;
    score2: number;
    stats: MapPlayerStats & { rating: number };
  }[];
}

export interface PlayerTrophy {
  tournamentId: string;
  tournamentName: string;
  team: string;
  placement: number;
  endDate?: string;
}

export interface CareerStats {
  player: string;
  matchesPlayed: number;
  mapsPlayed: number;
  totalRounds: number;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  totalUd: number;
  totalEf: number;
  /** Round-weighted averages */
  avgAdr: number;
  avgKast: number;
  /** Career rating: arithmetic mean of per-match ratings (HLTV style) */
  careerRating: number;
  /** Per-round derived */
  kpr: number;
  dpr: number;
  apr: number;
  kdRatio: number;
  /** Best map by avg rating */
  bestMap?: { map: string; rating: number; mapsPlayed: number };
  worstMap?: { map: string; rating: number; mapsPlayed: number };
  /** Per-map aggregates */
  perMap: { map: string; mapsPlayed: number; avgRating: number; kpr: number; adr: number; winRate: number }[];
  /** Last 20 matches sorted newest first */
  recentMatches: CareerMatchEntry[];
  wins: number;
  losses: number;
  /** Top opponents (most matches against) */
  topOpponents: { opponent: string; matches: number; wins: number }[];
  /** Most-used teammates */
  topTeammates: { teammate: string; matches: number }[];
  /** Tournament placements where this player participated */
  trophies: PlayerTrophy[];
  /** MVP awards from tournaments where this player was picked as MVP. */
  mvpAwards: { tournamentId: string; tournamentName: string; team: string; endDate?: string }[];
  /** Highest single-match rating */
  bestMatchRating?: { rating: number; opponent: string; matchId: string };
  /** Highest single-map kills */
  bestMapKills?: { kills: number; map: string; opponent: string };
}

const ratingFor = (p: MapPlayerStats, rounds: number): number => {
  if (typeof p.rating === "number" && p.rating > 0) return p.rating;
  return calculateRating({
    playerName: p.playerName,
    team: p.team,
    kills: p.kills,
    assists: p.assists,
    deaths: p.deaths,
    adr: p.adr,
    kast: p.kast,
    ud: p.ud,
    ef: p.ef,
    rounds,
  } as PlayerMatchStats);
};

const findInMap = (
  match: MatchResult,
  playerName: string,
): { map: NonNullable<MatchResult["maps"]>[number]; player: MapPlayerStats; isTeam1: boolean }[] => {
  const out: { map: NonNullable<MatchResult["maps"]>[number]; player: MapPlayerStats; isTeam1: boolean }[] = [];
  if (!match.maps) return out;
  for (const m of match.maps) {
    const t1 = m.team1Players?.find(p => p.playerName === playerName);
    if (t1) { out.push({ map: m, player: t1, isTeam1: true }); continue; }
    const t2 = m.team2Players?.find(p => p.playerName === playerName);
    if (t2) { out.push({ map: m, player: t2, isTeam1: false }); }
  }
  return out;
};

export function computeCareerStats(playerName: string, tournaments?: TournamentData[]): CareerStats {
  const ts = tournaments ?? loadFromStorage<TournamentData[]>("tournaments_data", []);

  const matchEntries: CareerMatchEntry[] = [];
  const perMapAgg = new Map<string, { ratings: number[]; rounds: number; kills: number; adr: number[]; wins: number; played: number }>();
  const opponentCount = new Map<string, { matches: number; wins: number }>();
  const teammateCount = new Map<string, number>();

  let totalKills = 0, totalDeaths = 0, totalAssists = 0, totalUd = 0, totalEf = 0;
  let totalRounds = 0, totalAdrWeighted = 0, totalKastWeighted = 0;
  let mapsPlayed = 0;
  const matchRatings: number[] = [];
  let wins = 0, losses = 0;

  for (const t of ts) {
    // Collect all bracket + group matches
    const allMatches: MatchResult[] = [];
    for (const phase of t.phases || []) {
      if (phase.bracket) allMatches.push(...phase.bracket);
      if (phase.groups) for (const g of phase.groups) allMatches.push(...g.matches);
    }
    if (t.matches) allMatches.push(...t.matches);

    for (const match of allMatches) {
      if (match.team1 === "BYE" || match.team2 === "BYE") continue;
      const inMaps = findInMap(match, playerName);
      if (inMaps.length === 0) continue;

      // Determine which team the player belongs to in this match
      const isTeam1 = inMaps[0].isTeam1;
      const team = isTeam1 ? match.team1 : match.team2;
      const opponent = isTeam1 ? match.team2 : match.team1;
      const ownScore = isTeam1 ? match.score1 : match.score2;
      const oppScore = isTeam1 ? match.score2 : match.score1;
      const won = ownScore > oppScore && (ownScore + oppScore) > 0;
      if (ownScore + oppScore > 0) {
        if (won) wins++; else losses++;
      }

      let mKills = 0, mDeaths = 0, mAssists = 0, mUd = 0, mEf = 0;
      let mRounds = 0, mAdrWeighted = 0, mKastWeighted = 0;
      const mapDetails: CareerMatchEntry["maps"] = [];

      for (const { map, player } of inMaps) {
        const rounds = (map.score1 || 0) + (map.score2 || 0);
        if (rounds <= 0) continue;
        const r = ratingFor(player, rounds);
        mKills += player.kills;
        mDeaths += player.deaths;
        mAssists += player.assists;
        mUd += player.ud;
        mEf += player.ef;
        mRounds += rounds;
        mAdrWeighted += player.adr * rounds;
        mKastWeighted += player.kast * rounds;
        mapsPlayed++;

        // Per-map aggregate
        const agg = perMapAgg.get(map.map) || { ratings: [], rounds: 0, kills: 0, adr: [], wins: 0, played: 0 };
        agg.ratings.push(r);
        agg.rounds += rounds;
        agg.kills += player.kills;
        agg.adr.push(player.adr);
        agg.played++;
        const mapWon = isTeam1 ? (map.score1 > map.score2) : (map.score2 > map.score1);
        if (mapWon) agg.wins++;
        perMapAgg.set(map.map, agg);

        mapDetails.push({
          map: map.map,
          score1: map.score1,
          score2: map.score2,
          stats: { ...player, rating: r },
        });

        // Teammates from this map
        const ownPlayers = isTeam1 ? map.team1Players : map.team2Players;
        ownPlayers?.forEach(tp => {
          if (tp.playerName !== playerName) {
            teammateCount.set(tp.playerName, (teammateCount.get(tp.playerName) || 0) + 1);
          }
        });
      }

      if (mRounds === 0) continue;

      const matchRating = calculateRating({
        playerName,
        team,
        kills: mKills,
        deaths: mDeaths,
        assists: mAssists,
        adr: Math.round(mAdrWeighted / mRounds),
        kast: Math.round(mKastWeighted / mRounds),
        ud: mUd,
        ef: mEf,
        rounds: mRounds,
      });
      matchRatings.push(matchRating);

      totalKills += mKills;
      totalDeaths += mDeaths;
      totalAssists += mAssists;
      totalUd += mUd;
      totalEf += mEf;
      totalRounds += mRounds;
      totalAdrWeighted += mAdrWeighted;
      totalKastWeighted += mKastWeighted;

      // Opponent tracking
      if (opponent && opponent !== "TBD" && opponent !== "BYE") {
        const oc = opponentCount.get(opponent) || { matches: 0, wins: 0 };
        oc.matches++;
        if (won) oc.wins++;
        opponentCount.set(opponent, oc);
      }

      const ownRounds = mapDetails.reduce((sum, mp) => sum + (isTeam1 ? mp.score1 : mp.score2), 0);
      const oppRounds = mapDetails.reduce((sum, mp) => sum + (isTeam1 ? mp.score2 : mp.score1), 0);
      const mapScores = mapDetails.map(mp =>
        `${isTeam1 ? mp.score1 : mp.score2}:${isTeam1 ? mp.score2 : mp.score1}`
      );

      matchEntries.push({
        tournamentId: t.id,
        tournamentName: t.name,
        matchId: match.id,
        team,
        opponent,
        ownScore,
        oppScore,
        ownRounds,
        oppRounds,
        mapScores,
        won,
        bo: (match.bo || 1) as 1 | 3 | 5,
        round: match.round,
        playedAt: match.playedAt || match.scheduledAt || t.endDate,
        kills: mKills,
        deaths: mDeaths,
        assists: mAssists,
        adr: Math.round(mAdrWeighted / mRounds),
        kast: Math.round(mKastWeighted / mRounds),
        ud: mUd,
        ef: mEf,
        rounds: mRounds,
        rating: matchRating,
        maps: mapDetails,
      });
    }
  }

  // Sort all matches chronologically (newest first) for the recent list
  const seq = new Map<typeof matchEntries[number], number>();
  matchEntries.forEach((e, i) => seq.set(e, i));
  matchEntries.sort((a, b) => {
    const c = (b.playedAt || "").localeCompare(a.playedAt || "");
    if (c !== 0) return c;
    return (seq.get(b) ?? 0) - (seq.get(a) ?? 0);
  });

  const matchesPlayed = matchEntries.length;
  const careerRating = matchesPlayed > 0
    ? Math.round((matchRatings.reduce((s, r) => s + r, 0) / matchesPlayed) * 100) / 100
    : 0;
  const avgAdr = totalRounds > 0 ? Math.round(totalAdrWeighted / totalRounds) : 0;
  const avgKast = totalRounds > 0 ? Math.round(totalKastWeighted / totalRounds) : 0;
  const kpr = totalRounds > 0 ? Math.round((totalKills / totalRounds) * 100) / 100 : 0;
  const dpr = totalRounds > 0 ? Math.round((totalDeaths / totalRounds) * 100) / 100 : 0;
  const apr = totalRounds > 0 ? Math.round((totalAssists / totalRounds) * 100) / 100 : 0;
  const kdRatio = totalDeaths > 0 ? Math.round((totalKills / totalDeaths) * 100) / 100 : totalKills;

  const perMap = Array.from(perMapAgg.entries()).map(([map, v]) => ({
    map,
    mapsPlayed: v.played,
    avgRating: Math.round((v.ratings.reduce((s, r) => s + r, 0) / v.ratings.length) * 100) / 100,
    kpr: v.rounds > 0 ? Math.round((v.kills / v.rounds) * 100) / 100 : 0,
    adr: v.adr.length > 0 ? Math.round(v.adr.reduce((s, x) => s + x, 0) / v.adr.length) : 0,
    winRate: v.played > 0 ? Math.round((v.wins / v.played) * 100) : 0,
  })).sort((a, b) => b.mapsPlayed - a.mapsPlayed);

  const sortedByRating = [...perMap].sort((a, b) => b.avgRating - a.avgRating);
  const bestMap = sortedByRating[0] ? { map: sortedByRating[0].map, rating: sortedByRating[0].avgRating, mapsPlayed: sortedByRating[0].mapsPlayed } : undefined;
  const worstMap = sortedByRating.length > 1 ? { map: sortedByRating[sortedByRating.length - 1].map, rating: sortedByRating[sortedByRating.length - 1].avgRating, mapsPlayed: sortedByRating[sortedByRating.length - 1].mapsPlayed } : undefined;

  // ===== Trophies: tournaments where player's team finished in top placements =====
  const trophies: PlayerTrophy[] = [];
  for (const t of ts) {
    if (!t.placements || t.placements.length === 0) continue;
    // Find which team this player was on (most-played in this tournament)
    const playerTeams = new Map<string, number>();
    const collect = (matches: MatchResult[] | undefined) => {
      if (!matches) return;
      for (const m of matches) {
        if (!m.maps) continue;
        for (const mp of m.maps) {
          if (mp.team1Players?.some(p => p.playerName === playerName)) {
            playerTeams.set(m.team1, (playerTeams.get(m.team1) || 0) + 1);
          }
          if (mp.team2Players?.some(p => p.playerName === playerName)) {
            playerTeams.set(m.team2, (playerTeams.get(m.team2) || 0) + 1);
          }
        }
      }
    };
    for (const phase of t.phases || []) {
      collect(phase.bracket);
      if (phase.groups) for (const g of phase.groups) collect(g.matches);
    }
    collect(t.matches);
    if (playerTeams.size === 0) continue;
    const playerTeam = Array.from(playerTeams.entries()).sort((a, b) => b[1] - a[1])[0][0];
    const placement = t.placements.find(p => p.team === playerTeam);
    if (placement && placement.placement <= 4) {
      trophies.push({
        tournamentId: t.id,
        tournamentName: t.name,
        team: playerTeam,
        placement: placement.placement,
        endDate: t.endDate,
      });
    }
  }
  trophies.sort((a, b) => a.placement - b.placement || (b.endDate || "").localeCompare(a.endDate || ""));

  // ===== MVP Awards =====
  const mvpAwards: CareerStats["mvpAwards"] = [];
  for (const t of ts) {
    if (t.awards?.mvp === playerName) {
      mvpAwards.push({
        tournamentId: t.id,
        tournamentName: t.name,
        team: t.awards.mvpTeam || "",
        endDate: t.endDate,
      });
    }
  }
  mvpAwards.sort((a, b) => (b.endDate || "").localeCompare(a.endDate || ""));



  // ===== Best individual achievements =====
  let bestMatchRating: CareerStats["bestMatchRating"];
  matchEntries.forEach(m => {
    if (!bestMatchRating || m.rating > bestMatchRating.rating) {
      bestMatchRating = { rating: m.rating, opponent: m.opponent, matchId: m.matchId };
    }
  });
  let bestMapKills: CareerStats["bestMapKills"];
  matchEntries.forEach(m => {
    m.maps.forEach(mp => {
      if (!bestMapKills || mp.stats.kills > bestMapKills.kills) {
        bestMapKills = { kills: mp.stats.kills, map: mp.map, opponent: m.opponent };
      }
    });
  });

  return {
    player: playerName,
    matchesPlayed,
    mapsPlayed,
    totalRounds,
    totalKills,
    totalDeaths,
    totalAssists,
    totalUd,
    totalEf,
    avgAdr,
    avgKast,
    careerRating,
    kpr,
    dpr,
    apr,
    kdRatio,
    bestMap,
    worstMap,
    perMap,
    recentMatches: matchEntries.slice(0, 20),
    wins,
    losses,
    topOpponents: Array.from(opponentCount.entries())
      .map(([opponent, v]) => ({ opponent, ...v }))
      .sort((a, b) => b.matches - a.matches)
      .slice(0, 5),
    topTeammates: Array.from(teammateCount.entries())
      .map(([teammate, matches]) => ({ teammate, matches }))
      .sort((a, b) => b.matches - a.matches)
      .slice(0, 4),
    trophies,
    mvpAwards,
    bestMatchRating,
    bestMapKills,
  };
}

// ===== Period-scoped rating (used by Gracze panel filters) =====
export type RatingPeriod = "all" | "month" | "year" | "lastTournament";

/** All matches a player participated in, sorted newest first (full list, not sliced). */
export function listPlayerMatches(playerName: string, tournaments?: TournamentData[]): CareerMatchEntry[] {
  // Reuse computeCareerStats by widening recentMatches: just run our own collector.
  const ts = tournaments ?? loadFromStorage<TournamentData[]>("tournaments_data", []);
  const entries: CareerMatchEntry[] = [];
  for (const t of ts) {
    const allMatches: MatchResult[] = [];
    for (const phase of t.phases || []) {
      if (phase.bracket) allMatches.push(...phase.bracket);
      if (phase.groups) for (const g of phase.groups) allMatches.push(...g.matches);
    }
    if (t.matches) allMatches.push(...t.matches);
    for (const match of allMatches) {
      if (match.team1 === "BYE" || match.team2 === "BYE") continue;
      const inMaps = findInMap(match, playerName);
      if (inMaps.length === 0) continue;
      const isTeam1 = inMaps[0].isTeam1;
      const team = isTeam1 ? match.team1 : match.team2;
      const opponent = isTeam1 ? match.team2 : match.team1;
      const ownScore = isTeam1 ? match.score1 : match.score2;
      const oppScore = isTeam1 ? match.score2 : match.score1;
      let mKills = 0, mDeaths = 0, mAssists = 0, mUd = 0, mEf = 0;
      let mRounds = 0, mAdrW = 0, mKastW = 0;
      let ownRounds = 0, oppRounds = 0;
      const mapScores: string[] = [];
      for (const { map, player } of inMaps) {
        const rounds = (map.score1 || 0) + (map.score2 || 0);
        if (rounds <= 0) continue;
        mKills += player.kills; mDeaths += player.deaths; mAssists += player.assists;
        mUd += player.ud; mEf += player.ef; mRounds += rounds;
        mAdrW += player.adr * rounds; mKastW += player.kast * rounds;
        if (isTeam1) { ownRounds += map.score1 || 0; oppRounds += map.score2 || 0; }
        else { ownRounds += map.score2 || 0; oppRounds += map.score1 || 0; }
        mapScores.push(`${isTeam1 ? (map.score1 || 0) : (map.score2 || 0)}:${isTeam1 ? (map.score2 || 0) : (map.score1 || 0)}`);
      }
      if (mRounds === 0) continue;
      const rating = calculateRating({
        playerName, team, kills: mKills, deaths: mDeaths, assists: mAssists,
        adr: Math.round(mAdrW / mRounds), kast: Math.round(mKastW / mRounds),
        ud: mUd, ef: mEf, rounds: mRounds,
      });
      entries.push({
        tournamentId: t.id, tournamentName: t.name, matchId: match.id,
        team, opponent, ownScore, oppScore, ownRounds, oppRounds, mapScores,
        won: ownScore > oppScore && (ownScore + oppScore) > 0,
        bo: (match.bo || 1) as 1 | 3 | 5,
        round: match.round, playedAt: match.playedAt || match.scheduledAt || t.endDate,
        kills: mKills, deaths: mDeaths, assists: mAssists,
        adr: Math.round(mAdrW / mRounds), kast: Math.round(mKastW / mRounds),
        ud: mUd, ef: mEf, rounds: mRounds, rating, maps: [],
      });
    }
  }
  const seqE = new Map<typeof entries[number], number>();
  entries.forEach((e, i) => seqE.set(e, i));
  entries.sort((a, b) => {
    const c = (b.playedAt || "").localeCompare(a.playedAt || "");
    if (c !== 0) return c;
    return (seqE.get(b) ?? 0) - (seqE.get(a) ?? 0);
  });
  return entries;
}

/** Average match rating (HLTV-style) over a time window. */
export function computePlayerRatingForPeriod(
  playerName: string,
  period: RatingPeriod,
  tournaments?: TournamentData[],
): { rating: number; matches: number } {
  const all = listPlayerMatches(playerName, tournaments);
  if (all.length === 0) return { rating: 0, matches: 0 };
  let filtered: CareerMatchEntry[] = all;
  if (period === "lastTournament") {
    const lastId = all[0].tournamentId;
    filtered = all.filter(m => m.tournamentId === lastId);
  } else if (period === "month" || period === "year") {
    const cutoff = worldNowMs() - (period === "month" ? 30 : 365) * 24 * 60 * 60 * 1000;
    filtered = all.filter(m => {
      const t = m.playedAt ? Date.parse(m.playedAt) : NaN;
      return Number.isFinite(t) && t >= cutoff;
    });
  }
  if (filtered.length === 0) return { rating: 0, matches: 0 };
  const avg = filtered.reduce((s, m) => s + m.rating, 0) / filtered.length;
  return { rating: Math.round(avg * 100) / 100, matches: filtered.length };
}

// ===== Batched per-player basic stats =====
//
// Single pass over `tournaments_data` producing rating/K-D/ADR/match-count
// for EVERY player at once. Used by the players panel — the previous approach
// called `computeCareerStats(name)` per row, which loaded storage and scanned
// every match once per player (O(P*M)). This version is O(M).

export interface BasicPlayerStats {
  rating: number;
  matches: number;
  kdr: number;
  adr: number;
}

interface BasicEntry {
  rating: number;
  kills: number;
  deaths: number;
  adrW: number;
  rounds: number;
  tournamentId: string;
  playedAt: string;
}

export function computeAllPlayersBasicStats(
  period: RatingPeriod = "all",
  tournaments?: TournamentData[],
): Map<string, BasicPlayerStats> {
  const ts = tournaments ?? loadFromStorage<TournamentData[]>("tournaments_data", []);
  const perPlayer = new Map<string, BasicEntry[]>();

  for (const t of ts) {
    const allMatches: MatchResult[] = [];
    for (const phase of t.phases || []) {
      if (phase.bracket) allMatches.push(...phase.bracket);
      if (phase.groups) for (const g of phase.groups) allMatches.push(...g.matches);
    }
    if (t.matches) allMatches.push(...t.matches);

    for (const match of allMatches) {
      if (!match.maps) continue;
      // Accumulate per-player across all maps of this match.
      interface Acc {
        isTeam1: boolean;
        kills: number; deaths: number; assists: number;
        ud: number; ef: number;
        adrW: number; kastW: number; rounds: number;
      }
      const acc = new Map<string, Acc>();
      const pushSide = (players: MapPlayerStats[] | undefined, isTeam1: boolean, rounds: number) => {
        if (!players) return;
        for (const p of players) {
          let a = acc.get(p.playerName);
          if (!a) {
            a = { isTeam1, kills: 0, deaths: 0, assists: 0, ud: 0, ef: 0, adrW: 0, kastW: 0, rounds: 0 };
            acc.set(p.playerName, a);
          }
          a.kills += p.kills; a.deaths += p.deaths; a.assists += p.assists;
          a.ud += p.ud; a.ef += p.ef;
          a.adrW += p.adr * rounds; a.kastW += p.kast * rounds; a.rounds += rounds;
        }
      };
      for (const map of match.maps) {
        const rounds = (map.score1 || 0) + (map.score2 || 0);
        if (rounds <= 0) continue;
        pushSide(map.team1Players, true, rounds);
        pushSide(map.team2Players, false, rounds);
      }
      const playedAt = match.playedAt || match.scheduledAt || t.endDate || "";
      for (const [name, a] of acc) {
        if (a.rounds === 0) continue;
        const rating = calculateRating({
          playerName: name,
          team: a.isTeam1 ? match.team1 : match.team2,
          kills: a.kills, deaths: a.deaths, assists: a.assists,
          adr: Math.round(a.adrW / a.rounds),
          kast: Math.round(a.kastW / a.rounds),
          ud: a.ud, ef: a.ef, rounds: a.rounds,
        });
        const list = perPlayer.get(name);
        const entry: BasicEntry = {
          rating,
          kills: a.kills, deaths: a.deaths,
          adrW: a.adrW, rounds: a.rounds,
          tournamentId: t.id, playedAt,
        };
        if (list) list.push(entry);
        else perPlayer.set(name, [entry]);
      }
    }
  }

  const out = new Map<string, BasicPlayerStats>();
  const cutoff =
    period === "month" ? worldNowMs() - 30 * 86400000 :
    period === "year" ? worldNowMs() - 365 * 86400000 : 0;

  for (const [name, entries] of perPlayer) {
    let filtered = entries;
    if (period === "lastTournament") {
      entries.sort((a, b) => (b.playedAt || "").localeCompare(a.playedAt || ""));
      const lastId = entries[0].tournamentId;
      filtered = entries.filter(e => e.tournamentId === lastId);
    } else if (period === "month" || period === "year") {
      filtered = entries.filter(e => {
        const t = e.playedAt ? Date.parse(e.playedAt) : NaN;
        return Number.isFinite(t) && t >= cutoff;
      });
    }
    if (filtered.length === 0) {
      out.set(name, { rating: 0, matches: 0, kdr: 0, adr: 0 });
      continue;
    }
    let totKills = 0, totDeaths = 0, totAdrW = 0, totRounds = 0, rSum = 0;
    for (const e of filtered) {
      totKills += e.kills; totDeaths += e.deaths;
      totAdrW += e.adrW; totRounds += e.rounds; rSum += e.rating;
    }
    out.set(name, {
      rating: Math.round((rSum / filtered.length) * 100) / 100,
      matches: filtered.length,
      kdr: totDeaths > 0 ? Math.round((totKills / totDeaths) * 100) / 100 : totKills,
      adr: totRounds > 0 ? Math.round(totAdrW / totRounds) : 0,
    });
  }
  return out;
}
