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

export interface MatchStats {
  matchId: string;    // "team1-vs-team2" or similar
  team1Stats: PlayerMatchStats[];
  team2Stats: PlayerMatchStats[];
}

// HLTV 3.0-inspired rating calculation
// Uses: KPR, DPR, Impact (multi-kill potential), KAST%, ADR, Utility contribution
export function calculateRating(stats: PlayerMatchStats): number {
  if (stats.rounds <= 0) return 0;

  const kpr = stats.kills / stats.rounds;
  const dpr = stats.deaths / stats.rounds;
  const apr = stats.assists / stats.rounds;
  const kastNorm = stats.kast / 100; // normalize to 0-1
  const adrNorm = stats.adr / 100;   // normalize ~80 ADR = 0.8

  // Impact approximation (based on kills and assists)
  const impact = 2.13 * kpr + 0.42 * apr - 0.41;

  // Core HLTV 2.0-style components
  const killRating = kpr / 0.679;          // normalized to avg
  const survivalRating = 1 - (dpr / 0.679);
  const impactRating = Math.max(0, impact);
  const kastRating = kastNorm / 0.689;      // normalized to avg KAST ~68.9%
  const adrRating = adrNorm / 0.789;        // normalized to avg ADR ~78.9

  // Utility bonus (subtle contribution from UD and EF)
  const utilityBonus = (stats.ud / 150) * 0.05 + (stats.ef / 3) * 0.03;

  // Weighted combination (HLTV 3.0 inspired weights)
  const rating = 0.2688 * killRating
    + 0.2073 * survivalRating
    + 0.2372 * impactRating
    + 0.1584 * kastRating
    + 0.1283 * adrRating
    + utilityBonus;

  return Math.round(rating * 100) / 100;
}

// Generate realistic random stats for a player in a match
export function generateRandomStats(
  playerName: string,
  team: string,
  rounds: number,
  isWinner: boolean,
  teamRankFactor: number = 0.5 // 0 = best team, 1 = worst
): PlayerMatchStats {
  // Higher ranked teams tend to have better stats
  const skillBase = 1 - teamRankFactor * 0.3;
  const winBonus = isWinner ? 1.1 : 0.9;

  const kills = Math.max(0, Math.round((rounds * (0.6 + Math.random() * 0.4) * skillBase * winBonus)));
  const deaths = Math.max(1, Math.round((rounds * (0.5 + Math.random() * 0.4) / skillBase / winBonus)));
  const assists = Math.max(0, Math.round((rounds * (0.1 + Math.random() * 0.2))));
  const adr = Math.max(20, Math.round((55 + Math.random() * 50) * skillBase * winBonus));
  const kast = Math.min(100, Math.max(30, Math.round((60 + Math.random() * 25) * skillBase)));
  const ud = Math.max(0, Math.round(Math.random() * 80 + 10));
  const ef = Math.max(0, Math.round(Math.random() * 4));

  const stats: PlayerMatchStats = {
    playerName,
    team,
    kills,
    assists,
    deaths,
    adr,
    kast,
    ud,
    ef,
    rounds,
  };

  stats.rating = calculateRating(stats);
  return stats;
}

// Generate full match stats for two teams
export function generateMatchStats(
  team1: string,
  team2: string,
  team1Roster: string[],
  team2Roster: string[],
  score1: number,
  score2: number,
  bo: number
): MatchStats {
  const totalRounds = Math.max(16, (score1 + score2) * Math.round(16 + Math.random() * 8));
  const roundsPlayed = Math.min(totalRounds, Math.max(16, Math.round(22 + Math.random() * 8)));
  const isTeam1Winner = score1 > score2;

  const team1Stats = team1Roster.slice(0, 5).map(p =>
    generateRandomStats(p, team1, roundsPlayed, isTeam1Winner, 0.3 + Math.random() * 0.4)
  );
  const team2Stats = team2Roster.slice(0, 5).map(p =>
    generateRandomStats(p, team2, roundsPlayed, !isTeam1Winner, 0.3 + Math.random() * 0.4)
  );

  return {
    matchId: `${team1}-vs-${team2}`,
    team1Stats,
    team2Stats,
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
