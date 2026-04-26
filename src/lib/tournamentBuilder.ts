import type {
  MatchResult,
  PhaseFormat,
  PhaseGroup,
  TournamentPhase,
  TournamentData,
  MapPlayerStats,
} from "./types";
import type { MatchStats, MapStats, PlayerMatchStats } from "./playerStats";
import { calculateRating } from "./playerStats";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Shuffle helper (Fisher-Yates) */
export const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const nextPow2 = (n: number) => {
  let p = 1;
  while (p < n) p *= 2;
  return p;
};

const roundLabel = (totalRounds: number, roundIdx: number) => {
  const remaining = totalRounds - roundIdx;
  if (remaining === 1) return "Final";
  if (remaining === 2) return "Semifinal";
  if (remaining === 3) return "Quarterfinal";
  return `Round ${roundIdx + 1}`;
};

/** Build a single elimination bracket (with BYEs for non-pow2) */
export const buildSingleElim = (teams: string[], bo: 1 | 3 | 5 = 3): MatchResult[] => {
  const size = nextPow2(Math.max(2, teams.length));
  const seeded: (string | null)[] = [...teams];
  while (seeded.length < size) seeded.push(null); // BYE

  const totalRounds = Math.log2(size);
  const matches: MatchResult[] = [];
  // Track previous round match IDs to wire winnerTo
  let prevRoundIds: string[] = [];

  for (let r = 0; r < totalRounds; r++) {
    const matchesInRound = size / Math.pow(2, r + 1);
    const currentRoundIds: string[] = [];
    for (let m = 0; m < matchesInRound; m++) {
      const id = uid();
      let team1 = "";
      let team2 = "";
      if (r === 0) {
        team1 = seeded[m * 2] ?? "BYE";
        team2 = seeded[m * 2 + 1] ?? "BYE";
      }
      const match: MatchResult = {
        id,
        team1,
        team2,
        score1: 0,
        score2: 0,
        bracketSlot: `UB-R${r + 1}-M${m + 1}`,
        round: roundLabel(totalRounds, r),
        bo,
      };
      currentRoundIds.push(id);
      matches.push(match);
    }
    // Wire previous round → current
    if (prevRoundIds.length) {
      prevRoundIds.forEach((pid, idx) => {
        const target = currentRoundIds[Math.floor(idx / 2)];
        const prev = matches.find(x => x.id === pid)!;
        prev.winnerTo = target;
      });
    }
    prevRoundIds = currentRoundIds;
  }
  return matches;
};

/** Double elim: upper bracket + lower bracket + grand final.
 *  Simplified: builds UB like SE; LB has 2*(rounds-1) rounds. We do not auto-fill teams, only structure. */
export const buildDoubleElim = (teams: string[], bo: 1 | 3 | 5 = 3): MatchResult[] => {
  const ub = buildSingleElim(teams, bo).map(m => ({ ...m })); // UB
  const size = nextPow2(Math.max(2, teams.length));
  const ubRounds = Math.log2(size);
  const lbRoundCount = Math.max(0, (ubRounds - 1) * 2);

  const lb: MatchResult[] = [];
  // matches per LB round pattern: size/4, size/4, size/8, size/8 ... 1, 1
  let matchesInRound = size / 4;
  for (let r = 0; r < lbRoundCount; r++) {
    for (let m = 0; m < matchesInRound; m++) {
      lb.push({
        id: uid(),
        team1: "",
        team2: "",
        score1: 0,
        score2: 0,
        bracketSlot: `LB-R${r + 1}-M${m + 1}`,
        round: `Lower R${r + 1}`,
        bo,
      });
    }
    if (r % 2 === 1) matchesInRound = Math.max(1, matchesInRound / 2);
  }
  // Grand Final
  const gf: MatchResult = {
    id: uid(),
    team1: "",
    team2: "",
    score1: 0,
    score2: 0,
    bracketSlot: "GF",
    round: "Grand Final",
    bo: 5,
  };
  return [...ub, ...lb, gf];
};

/** Round Robin: every team plays every other once */
export const buildRoundRobin = (teams: string[], bo: 1 | 3 | 5 = 3): MatchResult[] => {
  const matches: MatchResult[] = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matches.push({
        id: uid(),
        team1: teams[i],
        team2: teams[j],
        score1: 0,
        score2: 0,
        round: "Round Robin",
        bo,
      });
    }
  }
  return matches;
};

/** GSL Group (4 teams): Opening matches → Winners + Losers → Decider */
export const buildGSLGroup = (teams: string[], bo: 1 | 3 | 5 = 3): MatchResult[] => {
  const t = [...teams];
  while (t.length < 4) t.push("TBD");
  return [
    { id: uid(), team1: t[0], team2: t[3], score1: 0, score2: 0, bracketSlot: "GSL-OM1", round: "Opening", bo },
    { id: uid(), team1: t[1], team2: t[2], score1: 0, score2: 0, bracketSlot: "GSL-OM2", round: "Opening", bo },
    { id: uid(), team1: "", team2: "", score1: 0, score2: 0, bracketSlot: "GSL-WM", round: "Winners Match", bo },
    { id: uid(), team1: "", team2: "", score1: 0, score2: 0, bracketSlot: "GSL-LM", round: "Elimination Match", bo },
    { id: uid(), team1: "", team2: "", score1: 0, score2: 0, bracketSlot: "GSL-DM", round: "Decider Match", bo },
  ];
};

/**
 * IEM-style 8-team double-elimination group with lower bracket.
 * Top 2 advance.
 *
 * Round structure:
 *   - UB R1 (Opening, 4 matches)         — losers fall to LB R1
 *   - LB R1 (Elimination, 2 matches)     — losers eliminated
 *   - UB SF (Winners' Match, 2 matches)  — losers fall to LB R2
 *   - LB R2 (2 matches)                  — losers eliminated
 *   - UB Final (Winners' Decider, 1)     — winner = 1st seed; loser to LB Final
 *   - LB Final (Decider, 1)              — winner = 2nd seed
 */
export const buildGSLDoubleElimGroup = (teams: string[], bo: 1 | 3 | 5 = 3): MatchResult[] => {
  const t = [...teams];
  while (t.length < 8) t.push("TBD");
  // Seed pairings (1v8, 2v7, 3v6, 4v5)
  const om = [
    [t[0], t[7]],
    [t[1], t[6]],
    [t[2], t[5]],
    [t[3], t[4]],
  ];
  return [
    { id: uid(), team1: om[0][0], team2: om[0][1], score1: 0, score2: 0, bracketSlot: "IEM-UB-R1-M1", round: "Opening", bo },
    { id: uid(), team1: om[1][0], team2: om[1][1], score1: 0, score2: 0, bracketSlot: "IEM-UB-R1-M2", round: "Opening", bo },
    { id: uid(), team1: om[2][0], team2: om[2][1], score1: 0, score2: 0, bracketSlot: "IEM-UB-R1-M3", round: "Opening", bo },
    { id: uid(), team1: om[3][0], team2: om[3][1], score1: 0, score2: 0, bracketSlot: "IEM-UB-R1-M4", round: "Opening", bo },

    { id: uid(), team1: "", team2: "", score1: 0, score2: 0, bracketSlot: "IEM-LB-R1-M1", round: "Elimination R1", bo },
    { id: uid(), team1: "", team2: "", score1: 0, score2: 0, bracketSlot: "IEM-LB-R1-M2", round: "Elimination R1", bo },

    { id: uid(), team1: "", team2: "", score1: 0, score2: 0, bracketSlot: "IEM-UB-SF-M1", round: "Winners Match", bo },
    { id: uid(), team1: "", team2: "", score1: 0, score2: 0, bracketSlot: "IEM-UB-SF-M2", round: "Winners Match", bo },

    { id: uid(), team1: "", team2: "", score1: 0, score2: 0, bracketSlot: "IEM-LB-R2-M1", round: "Elimination R2", bo },
    { id: uid(), team1: "", team2: "", score1: 0, score2: 0, bracketSlot: "IEM-LB-R2-M2", round: "Elimination R2", bo },

    { id: uid(), team1: "", team2: "", score1: 0, score2: 0, bracketSlot: "IEM-UB-FINAL", round: "Winners Decider", bo },
    { id: uid(), team1: "", team2: "", score1: 0, score2: 0, bracketSlot: "IEM-LB-FINAL", round: "Decider", bo },
  ];
};

/** Swiss: returns first-round matches only (subsequent rounds added by user as results come in) */
export const buildSwissRound1 = (teams: string[], bo: 1 | 3 | 5 = 1): MatchResult[] => {
  const t = shuffle(teams);
  const matches: MatchResult[] = [];
  for (let i = 0; i < t.length - 1; i += 2) {
    matches.push({
      id: uid(),
      team1: t[i],
      team2: t[i + 1],
      score1: 0,
      score2: 0,
      round: "Swiss R1",
      bo,
    });
  }
  return matches;
};

/** Distribute teams into N groups using snake seeding */
export const distributeIntoGroups = (teams: string[], groupCount: number): string[][] => {
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  teams.forEach((team, idx) => {
    const round = Math.floor(idx / groupCount);
    const pos = idx % groupCount;
    const groupIdx = round % 2 === 0 ? pos : groupCount - 1 - pos;
    groups[groupIdx].push(team);
  });
  return groups;
};

/** Build a phase from format + teams */
export const buildPhase = (
  name: string,
  format: PhaseFormat,
  teams: string[],
  opts: { bo?: 1 | 3 | 5; groupCount?: number; advanceCount?: number } = {}
): TournamentPhase => {
  const bo = opts.bo ?? 3;
  const phase: TournamentPhase = {
    id: uid(),
    name,
    format,
    bo,
    teams: [...teams],
    advanceCount: opts.advanceCount,
    groupCount: opts.groupCount,
  };

  if (format === "single-elim") {
    phase.bracket = buildSingleElim(teams, bo);
  } else if (format === "double-elim") {
    phase.bracket = buildDoubleElim(teams, bo);
  } else if (format === "round-robin") {
    const groupCount = opts.groupCount ?? 1;
    const distributed = distributeIntoGroups(teams, groupCount);
    phase.groups = distributed.map<PhaseGroup>((groupTeams, i) => ({
      id: uid(),
      name: `Group ${String.fromCharCode(65 + i)}`,
      teams: groupTeams,
      matches: buildRoundRobin(groupTeams, bo),
    }));
  } else if (format === "gsl-groups") {
    const groupCount = opts.groupCount ?? Math.max(1, Math.floor(teams.length / 4));
    const distributed = distributeIntoGroups(teams, groupCount);
    phase.groups = distributed.map<PhaseGroup>((groupTeams, i) => ({
      id: uid(),
      name: `Group ${String.fromCharCode(65 + i)}`,
      teams: groupTeams,
      matches: buildGSLGroup(groupTeams, bo),
    }));
  } else if (format === "swiss") {
    phase.bracket = buildSwissRound1(teams, bo);
    phase.swissRounds = Math.ceil(Math.log2(Math.max(2, teams.length)));
  } else if (format === "showmatch") {
    phase.bracket = teams.length >= 2
      ? [{ id: uid(), team1: teams[0], team2: teams[1], score1: 0, score2: 0, round: "Showmatch", bo }]
      : [];
  }
  return phase;
};

/** Compute standings for a Round Robin / GSL group based on completed matches */
export interface GroupStanding {
  team: string;
  wins: number;
  losses: number;
  mapDiff: number;
}

export const computeGroupStandings = (group: PhaseGroup): GroupStanding[] => {
  const standings = new Map<string, GroupStanding>();
  group.teams.forEach(t => standings.set(t, { team: t, wins: 0, losses: 0, mapDiff: 0 }));
  group.matches.forEach(m => {
    if (!m.team1 || !m.team2 || m.team1 === "BYE" || m.team2 === "BYE") return;
    if (m.score1 === 0 && m.score2 === 0) return;
    const s1 = standings.get(m.team1);
    const s2 = standings.get(m.team2);
    if (!s1 || !s2) return;
    if (m.score1 > m.score2) { s1.wins++; s2.losses++; }
    else if (m.score2 > m.score1) { s2.wins++; s1.losses++; }
    s1.mapDiff += m.score1 - m.score2;
    s2.mapDiff += m.score2 - m.score1;
  });
  return Array.from(standings.values()).sort((a, b) =>
    b.wins - a.wins || b.mapDiff - a.mapDiff
  );
};

export const formatLabel = (f: PhaseFormat): string => ({
  "single-elim": "Single Elimination",
  "double-elim": "Double Elimination",
  "swiss": "Swiss System",
  "round-robin": "Round Robin",
  "gsl-groups": "GSL Groups",
  "showmatch": "Showmatch",
}[f]);

// ===== Stats aggregation =====

const toMatchPlayer = (p: MapPlayerStats, rounds: number, teamName: string): PlayerMatchStats => {
  const stats: PlayerMatchStats = {
    playerName: p.playerName,
    team: teamName,
    kills: p.kills,
    assists: p.assists,
    deaths: p.deaths,
    adr: p.adr,
    kast: p.kast,
    ud: p.ud,
    ef: p.ef,
    rounds,
  };
  stats.rating = p.rating ?? calculateRating(stats);
  return stats;
};

const aggregatePlayer = (perMap: PlayerMatchStats[]): PlayerMatchStats => {
  const totalRounds = perMap.reduce((s, m) => s + m.rounds, 0) || 1;
  const agg: PlayerMatchStats = {
    playerName: perMap[0].playerName,
    team: perMap[0].team,
    kills: perMap.reduce((s, m) => s + m.kills, 0),
    assists: perMap.reduce((s, m) => s + m.assists, 0),
    deaths: perMap.reduce((s, m) => s + m.deaths, 0),
    adr: Math.round(perMap.reduce((s, m) => s + m.adr * m.rounds, 0) / totalRounds),
    kast: Math.round(perMap.reduce((s, m) => s + m.kast * m.rounds, 0) / totalRounds),
    ud: perMap.reduce((s, m) => s + m.ud, 0),
    ef: perMap.reduce((s, m) => s + m.ef, 0),
    rounds: totalRounds,
  };
  agg.rating = calculateRating(agg);
  return agg;
};

const matchToStats = (m: MatchResult): MatchStats | null => {
  if (!m.maps || m.maps.length === 0) return null;
  const mapsWithStats = m.maps.filter(mp => mp.team1Players?.length || mp.team2Players?.length);
  if (mapsWithStats.length === 0) return null;

  const mapStatsList: MapStats[] = mapsWithStats.map((mp, idx) => {
    const totalRounds = (mp.score1 || 0) + (mp.score2 || 0);
    return {
      mapNumber: idx + 1,
      mapName: mp.map,
      team1Stats: (mp.team1Players || []).map(p => toMatchPlayer(p, totalRounds, m.team1)),
      team2Stats: (mp.team2Players || []).map(p => toMatchPlayer(p, totalRounds, m.team2)),
      team1RoundsWon: mp.score1 || 0,
      team2RoundsWon: mp.score2 || 0,
      totalRounds,
    };
  });

  const aggregateSide = (mapStats: MapStats[], side: "team1Stats" | "team2Stats"): PlayerMatchStats[] => {
    const byPlayer: Record<string, PlayerMatchStats[]> = {};
    mapStats.forEach(ms => {
      ms[side].forEach(p => {
        if (!byPlayer[p.playerName]) byPlayer[p.playerName] = [];
        byPlayer[p.playerName].push(p);
      });
    });
    return Object.values(byPlayer).map(aggregatePlayer);
  };

  return {
    matchId: m.id,
    team1Stats: aggregateSide(mapStatsList, "team1Stats"),
    team2Stats: aggregateSide(mapStatsList, "team2Stats"),
    maps: mapStatsList,
    bo: m.bo || 1,
  };
};

/** Walk a tournament's phases/groups/brackets and produce a MatchStats record map. */
export const collectMatchStatsFromTournaments = (
  tournaments: TournamentData[],
): Record<string, MatchStats> => {
  const out: Record<string, MatchStats> = {};
  for (const t of tournaments) {
    for (const phase of t.phases) {
      const allMatches: MatchResult[] = [
        ...(phase.bracket || []),
        ...(phase.groups?.flatMap(g => g.matches) || []),
      ];
      for (const m of allMatches) {
        const stats = matchToStats(m);
        if (stats) out[`${t.id}-${m.id}`] = stats;
      }
    }
  }
  return out;
};
