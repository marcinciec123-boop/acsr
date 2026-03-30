// ===== Player Match Statistics & HLTV 3.0-style Rating =====

export interface PlayerMatchStats {
  playerName: string;
  team: string;
  kills: number;
  assists: number;
  deaths: number;
  adr: number;        // Average Damage per Round
  kast: number;       // KAST% (0-100)
  ud: number;         // Utility Damage
  ef: number;         // Enemies Flashed
  rounds: number;     // Total rounds played
  rating?: number;    // Calculated rating
}

export interface MapStats {
  mapNumber: number;
  mapName: string;
  team1Stats: PlayerMatchStats[];
  team2Stats: PlayerMatchStats[];
  team1RoundsWon: number;
  team2RoundsWon: number;
  totalRounds: number;
}

export interface MatchStats {
  matchId: string;
  team1Stats: PlayerMatchStats[];   // Aggregate stats
  team2Stats: PlayerMatchStats[];   // Aggregate stats
  maps?: MapStats[];                // Per-map stats for Bo3/Bo5
  bo: number;
}

// HLTV 3.0-inspired rating calculation
export function calculateRating(stats: PlayerMatchStats): number {
  if (stats.rounds <= 0) return 0;

  const kpr = stats.kills / stats.rounds;
  const dpr = stats.deaths / stats.rounds;
  const apr = stats.assists / stats.rounds;
  const kastNorm = stats.kast / 100;
  const adrNorm = stats.adr / 100;

  const impact = 2.13 * kpr + 0.42 * apr - 0.41;

  const killRating = kpr / 0.679;
  const survivalRating = 1 - (dpr / 0.679);
  const impactRating = Math.max(0, impact);
  const kastRating = kastNorm / 0.689;
  const adrRating = adrNorm / 0.789;

  const utilityBonus = (stats.ud / 150) * 0.05 + (stats.ef / 3) * 0.03;

  const rating = 0.2688 * killRating
    + 0.2073 * survivalRating
    + 0.2372 * impactRating
    + 0.1584 * kastRating
    + 0.1283 * adrRating
    + utilityBonus;

  return Math.round(rating * 100) / 100;
}

const MAP_POOL = ["Anubis", "Ancient", "Cache", "Dust II", "Inferno", "Mirage", "Nuke", "Overpass", "Train", "Tuscan", "Vertigo"];

function pickMaps(count: number): string[] {
  const shuffled = [...MAP_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Generate realistic stats for one map where team kills = opponent deaths
function generateMapStats(
  team1Roster: string[],
  team2Roster: string[],
  team1Name: string,
  team2Name: string,
  team1RoundsWon: number,
  team2RoundsWon: number,
  mapNumber: number,
  mapName: string
): MapStats {
  const totalRounds = team1RoundsWon + team2RoundsWon;
  const players1 = team1Roster.slice(0, 5);
  const players2 = team2Roster.slice(0, 5);

  // Team2 total deaths = team1 total kills = team1RoundsWon * avg_kills_per_round_won + some eco kills
  // In CS, each round won typically yields ~2-4 kills on the winning side
  // Total kills for team1 across the match ≈ sum of deaths of team2
  const team1TotalKills = distributeKillsForTeam(team1RoundsWon, team2RoundsWon, totalRounds, true);
  const team2TotalKills = distributeKillsForTeam(team2RoundsWon, team1RoundsWon, totalRounds, false);

  // team1 kills = team2 deaths, team2 kills = team1 deaths
  const team1PlayerKills = distributeAmongPlayers(team1TotalKills, 5);
  const team2PlayerKills = distributeAmongPlayers(team2TotalKills, 5);

  // Deaths: team1 total deaths = team2 total kills, team2 total deaths = team1 total kills
  const team1PlayerDeaths = distributeAmongPlayers(team2TotalKills, 5, totalRounds);
  const team2PlayerDeaths = distributeAmongPlayers(team1TotalKills, 5, totalRounds);

  const team1Stats: PlayerMatchStats[] = players1.map((name, i) => {
    const kills = team1PlayerKills[i];
    const deaths = team1PlayerDeaths[i];
    const assists = Math.max(0, Math.round(totalRounds * (0.08 + Math.random() * 0.15)));
    const adr = Math.max(30, Math.round((kills / totalRounds) * (85 + Math.random() * 30)));
    const kast = Math.min(100, Math.max(35, Math.round(55 + Math.random() * 30 + (kills > deaths ? 8 : -5))));
    const ud = Math.max(0, Math.round(Math.random() * 80 + 5));
    const ef = Math.max(0, Math.round(Math.random() * 4));
    const stats: PlayerMatchStats = { playerName: name, team: team1Name, kills, assists, deaths, adr, kast, ud, ef, rounds: totalRounds };
    stats.rating = calculateRating(stats);
    return stats;
  });

  const team2Stats: PlayerMatchStats[] = players2.map((name, i) => {
    const kills = team2PlayerKills[i];
    const deaths = team2PlayerDeaths[i];
    const assists = Math.max(0, Math.round(totalRounds * (0.08 + Math.random() * 0.15)));
    const adr = Math.max(30, Math.round((kills / totalRounds) * (85 + Math.random() * 30)));
    const kast = Math.min(100, Math.max(35, Math.round(55 + Math.random() * 30 + (kills > deaths ? 8 : -5))));
    const ud = Math.max(0, Math.round(Math.random() * 80 + 5));
    const ef = Math.max(0, Math.round(Math.random() * 4));
    const stats: PlayerMatchStats = { playerName: name, team: team2Name, kills, assists, deaths, adr, kast, ud, ef, rounds: totalRounds };
    stats.rating = calculateRating(stats);
    return stats;
  });

  return {
    mapNumber,
    mapName,
    team1Stats,
    team2Stats,
    team1RoundsWon,
    team2RoundsWon,
    totalRounds,
  };
}

function distributeKillsForTeam(ownRoundsWon: number, oppRoundsWon: number, totalRounds: number, isStronger: boolean): number {
  // In rounds you win, you get ~3-5 kills (you killed enough to win the round)
  // In rounds you lose, you get ~1-3 kills (partial kills before dying)
  const killsFromWonRounds = ownRoundsWon * (3 + Math.random() * 2);
  const killsFromLostRounds = oppRoundsWon * (1 + Math.random() * 2);
  return Math.round(killsFromWonRounds + killsFromLostRounds);
}

function distributeAmongPlayers(total: number, count: number, maxPerPlayer?: number): number[] {
  // Random distribution that sums to total
  const weights = Array.from({ length: count }, () => 0.5 + Math.random());
  const sum = weights.reduce((a, b) => a + b, 0);
  let distributed = weights.map(w => Math.round((w / sum) * total));

  // Fix rounding error
  const diff = total - distributed.reduce((a, b) => a + b, 0);
  distributed[0] += diff;

  // Ensure no player exceeds max (totalRounds)
  if (maxPerPlayer) {
    distributed = distributed.map(d => Math.min(d, maxPerPlayer));
  }

  // Ensure non-negative
  distributed = distributed.map(d => Math.max(0, d));

  return distributed;
}

// Aggregate per-map stats into total stats
function aggregatePlayerStats(mapStatsList: PlayerMatchStats[]): PlayerMatchStats {
  const totalRounds = mapStatsList.reduce((s, m) => s + m.rounds, 0);
  const totalKills = mapStatsList.reduce((s, m) => s + m.kills, 0);
  const totalDeaths = mapStatsList.reduce((s, m) => s + m.deaths, 0);
  const totalAssists = mapStatsList.reduce((s, m) => s + m.assists, 0);
  const avgAdr = totalRounds > 0 ? Math.round(mapStatsList.reduce((s, m) => s + m.adr * m.rounds, 0) / totalRounds) : 0;
  const avgKast = totalRounds > 0 ? Math.round(mapStatsList.reduce((s, m) => s + m.kast * m.rounds, 0) / totalRounds) : 0;
  const totalUd = mapStatsList.reduce((s, m) => s + m.ud, 0);
  const totalEf = mapStatsList.reduce((s, m) => s + m.ef, 0);

  const agg: PlayerMatchStats = {
    playerName: mapStatsList[0].playerName,
    team: mapStatsList[0].team,
    kills: totalKills,
    assists: totalAssists,
    deaths: totalDeaths,
    adr: avgAdr,
    kast: avgKast,
    ud: totalUd,
    ef: totalEf,
    rounds: totalRounds,
  };
  agg.rating = calculateRating(agg);
  return agg;
}

// Generate full match stats
export function generateMatchStats(
  team1: string,
  team2: string,
  team1Roster: string[],
  team2Roster: string[],
  score1: number,
  score2: number,
  bo: number
): MatchStats {
  const mapsPlayed = score1 + score2;
  const mapNames = pickMaps(mapsPlayed);

  if (bo <= 1 || mapsPlayed <= 1) {
    // Single map - use scores directly as round scores
    const finalT1 = score1;
    const finalT2 = score2;

    const map = generateMapStats(team1Roster, team2Roster, team1, team2, finalT1, finalT2, 1, mapNames[0] || "Mirage");

    return {
      matchId: `${team1}-vs-${team2}`,
      team1Stats: map.team1Stats,
      team2Stats: map.team2Stats,
      bo,
    };
  }

  // Bo3/Bo5: generate per-map stats
  const maps: MapStats[] = [];
  let t1MapsWon = 0;
  let t2MapsWon = 0;

  for (let i = 0; i < mapsPlayed; i++) {
    // Determine which team wins this map
    let t1Wins: boolean;
    const remainingMaps = mapsPlayed - i;
    const t1NeedsMore = score1 - t1MapsWon;
    const t2NeedsMore = score2 - t2MapsWon;

    if (t1NeedsMore === remainingMaps) {
      t1Wins = true; // Team1 must win all remaining
    } else if (t2NeedsMore === remainingMaps) {
      t1Wins = false;
    } else {
      // Distribute wins somewhat randomly but matching final score
      t1Wins = Math.random() < (t1NeedsMore / remainingMaps);
    }

    // Generate round score for this map (with possible overtime)
    const isOT = Math.random() < 0.2; // 20% chance of overtime
    let winnerRounds: number;
    let loserRounds: number;
    if (isOT) {
      // Overtime: 12-12 then MR4 OT (each OT = 4 rounds, win by taking 4)
      // Possible: single OT → 16:12-15, double OT → 19:15-18, etc.
      const otCount = Math.random() < 0.7 ? 1 : 2; // mostly single OT
      winnerRounds = 13 + 3 * otCount; // 16 or 19
      loserRounds = winnerRounds - 1 - Math.floor(Math.random() * 4); // winner-4 to winner-1
    } else {
      winnerRounds = 13;
      loserRounds = Math.round(5 + Math.random() * 7); // 5-12
    }
    const t1Rounds = t1Wins ? winnerRounds : loserRounds;
    const t2Rounds = t1Wins ? loserRounds : winnerRounds;

    if (t1Wins) t1MapsWon++;
    else t2MapsWon++;

    const map = generateMapStats(
      team1Roster, team2Roster, team1, team2,
      t1Rounds, t2Rounds,
      i + 1, mapNames[i] || MAP_POOL[i % MAP_POOL.length]
    );
    maps.push(map);
  }

  // Aggregate stats across all maps
  const roster1 = team1Roster.slice(0, 5);
  const roster2 = team2Roster.slice(0, 5);

  const team1Agg = roster1.map(name => {
    const perMap = maps.map(m => m.team1Stats.find(p => p.playerName === name)!).filter(Boolean);
    return aggregatePlayerStats(perMap);
  });

  const team2Agg = roster2.map(name => {
    const perMap = maps.map(m => m.team2Stats.find(p => p.playerName === name)!).filter(Boolean);
    return aggregatePlayerStats(perMap);
  });

  return {
    matchId: `${team1}-vs-${team2}`,
    team1Stats: team1Agg,
    team2Stats: team2Agg,
    maps,
    bo,
  };
}

// Get color class for rating value
export function getRatingColor(rating: number): string {
  if (rating >= 1.30) return "text-accent";
  if (rating >= 1.10) return "text-win";
  if (rating >= 0.90) return "text-foreground";
  if (rating >= 0.75) return "text-muted-foreground";
  return "text-loss";
}

// Get color class for KD ratio
export function getKDColor(kills: number, deaths: number): string {
  const kd = deaths > 0 ? kills / deaths : kills;
  if (kd >= 1.5) return "text-accent";
  if (kd >= 1.2) return "text-win";
  if (kd >= 0.9) return "text-foreground";
  return "text-loss";
}
