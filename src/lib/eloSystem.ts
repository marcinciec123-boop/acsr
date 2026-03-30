// ===== ELO-style VRS Points System =====
// Points gained/lost per match depend on rank difference between teams

export interface EloMatchResult {
  team: string;
  opponent: string;
  won: boolean;
  teamRank: number;      // position in ranking (1-based)
  opponentRank: number;
  tier: string;           // tournament tier for K-factor
}

// K-factor by tournament tier (higher tier = more impactful)
function getKFactor(tier: string): number {
  switch (tier) {
    case "S": return 40;
    case "A": return 30;
    case "B": return 20;
    case "C": return 12;
    default: return 20;
  }
}

// Calculate expected win probability based on rank difference
function expectedScore(teamRank: number, opponentRank: number): number {
  // Lower rank number = better team. Convert to "strength" (inverse of rank)
  const strength1 = 100 - Math.min(teamRank, 100);
  const strength2 = 100 - Math.min(opponentRank, 100);
  const diff = strength1 - strength2;
  return 1 / (1 + Math.pow(10, -diff / 40));
}

// Calculate ELO points for a single match
export function calculateEloPoints(result: EloMatchResult): number {
  const K = getKFactor(result.tier);
  const expected = expectedScore(result.teamRank, result.opponentRank);
  const actual = result.won ? 1 : 0;
  const points = Math.round(K * (actual - expected));
  return points;
}

// Calculate ELO changes for all matches in a tournament
export function calculateTournamentElo(
  matches: { team1: string; team2: string; winner: string }[],
  getRank: (team: string) => number,
  tier: string
): Record<string, number> {
  const eloChanges: Record<string, number> = {};

  for (const match of matches) {
    if (match.winner === "" || match.team2 === "BYE") continue;

    const rank1 = getRank(match.team1);
    const rank2 = getRank(match.team2);
    const loser = match.winner === match.team1 ? match.team2 : match.team1;

    const winnerPoints = calculateEloPoints({
      team: match.winner,
      opponent: loser,
      won: true,
      teamRank: match.winner === match.team1 ? rank1 : rank2,
      opponentRank: match.winner === match.team1 ? rank2 : rank1,
      tier,
    });

    const loserPoints = calculateEloPoints({
      team: loser,
      opponent: match.winner,
      won: false,
      teamRank: match.winner === match.team1 ? rank2 : rank1,
      opponentRank: match.winner === match.team1 ? rank1 : rank2,
      tier,
    });

    eloChanges[match.winner] = (eloChanges[match.winner] || 0) + winnerPoints;
    eloChanges[loser] = (eloChanges[loser] || 0) + loserPoints;
  }

  return eloChanges;
}

// Collect all matches from a tournament simulation
export function collectAllMatches(sim: {
  swiss?: { rounds: { matches: { team1: string; team2: string; winner: string }[] }[] };
  groups?: { matches: { team1: string; team2: string; winner: string }[] }[];
  knockout?: { rounds: { matches: { team1: string; team2: string; winner: string }[] }[] };
  majorStages?: { swiss?: { rounds: { matches: { team1: string; team2: string; winner: string }[] }[] }; knockout?: { rounds: { matches: { team1: string; team2: string; winner: string }[] }[] } }[];
}): { team1: string; team2: string; winner: string }[] {
  const all: { team1: string; team2: string; winner: string }[] = [];

  if (sim.swiss) {
    sim.swiss.rounds.forEach(r => all.push(...r.matches));
  }
  if (sim.groups) {
    sim.groups.forEach(g => all.push(...g.matches));
  }
  if (sim.knockout) {
    sim.knockout.rounds.forEach(r => all.push(...r.matches));
  }
  if (sim.majorStages) {
    sim.majorStages.forEach(stage => {
      if (stage.swiss) stage.swiss.rounds.forEach(r => all.push(...r.matches));
      if (stage.knockout) stage.knockout.rounds.forEach(r => all.push(...r.matches));
    });
  }

  return all.filter(m => m.team2 !== "BYE" && m.winner !== "");
}
