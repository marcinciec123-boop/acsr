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

/** Standard single-elim seeding positions for a bracket of given size.
 *  E.g. size=8 → [1,8,5,4,3,6,7,2] (1-indexed). Top seed always plays lowest available. */
const seedingOrder = (size: number): number[] => {
  let seeds: number[] = [1, 2];
  while (seeds.length < size) {
    const next: number[] = [];
    const total = seeds.length * 2 + 1;
    for (const s of seeds) { next.push(s); next.push(total - s); }
    seeds = next;
  }
  return seeds;
};

/** Build a single elimination bracket (with BYEs for non-pow2). Auto-advances BYE matches. */
export const buildSingleElim = (teams: string[], bo: 1 | 3 | 5 = 3): MatchResult[] => {
  const size = nextPow2(Math.max(2, teams.length));
  // Standard seeding: assign teams to bracket positions so top seeds face BYEs/lowest seeds.
  const order = seedingOrder(size); // 1-based seeds in bracket position order
  const seeded: (string | null)[] = order.map(seedNum => teams[seedNum - 1] ?? null);

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
      const winsNeeded = Math.ceil(bo / 2);
      // Auto-resolve BYE matchups in round 1
      let score1 = 0, score2 = 0;
      if (r === 0) {
        if (team1 !== "BYE" && team2 === "BYE") { score1 = winsNeeded; }
        else if (team2 !== "BYE" && team1 === "BYE") { score2 = winsNeeded; }
      }
      const match: MatchResult = {
        id,
        team1,
        team2,
        score1,
        score2,
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

  // Propagate BYE winners forward into round 2 (so seeds with BYE auto-advance)
  matches.forEach(m => {
    if (!m.winnerTo) return;
    if (m.score1 + m.score2 === 0) return;
    const winner = m.score1 > m.score2 ? m.team1 : m.team2;
    if (!winner || winner === "BYE") return;
    const tgt = matches.find(x => x.id === m.winnerTo);
    if (!tgt) return;
    if (!tgt.team1) tgt.team1 = winner;
    else if (!tgt.team2) tgt.team2 = winner;
  });

  return matches;
};

/** Double elim: upper bracket + lower bracket + grand final.
 *  Pattern (size = nextPow2 of teams):
 *    - UB rounds: log2(size). Last UB round is "Upper Final".
 *    - LB rounds: 2*(ubRounds-1). Pattern of matches per LB round:
 *        round 1: size/4 (losers of UB R1 paired)
 *        round 2: size/4 (winners of LB R1 vs losers of UB R2)
 *        round 3: size/8
 *        round 4: size/8
 *        ...
 *        last two: 1, 1
 */
export const buildDoubleElim = (teams: string[], bo: 1 | 3 | 5 = 3): MatchResult[] => {
  const ub = buildSingleElim(teams, bo).map(m => {
    // Re-label UB rounds: last one is "Upper Final"
    if (m.round === "Final") return { ...m, round: "Upper Final" };
    return m;
  });
  // Re-tag bracket slots from "UB-..." (already done in buildSingleElim).

  const size = nextPow2(Math.max(2, teams.length));
  const ubRounds = Math.log2(size);
  const lbRoundCount = Math.max(0, (ubRounds - 1) * 2);

  const lb: MatchResult[] = [];
  // Correct DE LB pattern: pairs of equal sizes that halve every 2 rounds.
  // size=8 → ubRounds=3, lbRounds=4, pattern: 2,2,1,1
  // size=16 → ubRounds=4, lbRounds=6, pattern: 4,4,2,2,1,1
  for (let r = 0; r < lbRoundCount; r++) {
    const halvings = Math.floor(r / 2); // 0,0,1,1,2,2...
    const matchesInRound = Math.max(1, size / Math.pow(2, 2 + halvings));
    const isLast = r === lbRoundCount - 1;
    const roundLabelLB = isLast
      ? "Lower Final"
      : r === lbRoundCount - 2
      ? "Lower Semifinal"
      : `Lower R${r + 1}`;
    for (let m = 0; m < matchesInRound; m++) {
      lb.push({
        id: uid(),
        team1: "",
        team2: "",
        score1: 0,
        score2: 0,
        bracketSlot: `LB-R${r + 1}-M${m + 1}`,
        round: roundLabelLB,
        bo,
      });
    }
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
 * IEM-style 8-team double-elimination group with full lower bracket.
 * Top 2 advance.
 *
 * Round structure (13 matches total):
 *   - UB R1 (Opening, 4 matches)         — losers fall to LB R1
 *   - LB R1 (Elimination R1, 2 matches)  — losers eliminated
 *   - UB SF (Winners' Match, 2 matches)  — losers fall to LB R2
 *   - LB R2 (Elimination R2, 2 matches)  — winners of LB R1 vs losers of UB SF
 *   - UB Final (Winners' Decider, 1)     — winner = 1st seed; loser to LB Final
 *   - LB R3 (Elimination R3, 1 match)    — winners of LB R2 face off
 *   - LB Final (Decider, 1)              — loser of UB Final vs winner of LB R3 → winner = 2nd seed
 */
export const buildGSLDoubleElimGroup = (teams: string[], bo: 1 | 3 | 5 = 3, advancePerGroup: number = 2): MatchResult[] => {
  const t = [...teams];
  while (t.length < 8) t.push("TBD");
  // Seed pairings (1v8, 2v7, 3v6, 4v5)
  const om = [
    [t[0], t[7]],
    [t[1], t[6]],
    [t[2], t[5]],
    [t[3], t[4]],
  ];
  const matches: MatchResult[] = [
    { id: uid(), team1: om[0][0], team2: om[0][1], score1: 0, score2: 0, bracketSlot: "IEM-UB-R1-M1", round: "Upper Bracket — Opening", bo },
    { id: uid(), team1: om[1][0], team2: om[1][1], score1: 0, score2: 0, bracketSlot: "IEM-UB-R1-M2", round: "Upper Bracket — Opening", bo },
    { id: uid(), team1: om[2][0], team2: om[2][1], score1: 0, score2: 0, bracketSlot: "IEM-UB-R1-M3", round: "Upper Bracket — Opening", bo },
    { id: uid(), team1: om[3][0], team2: om[3][1], score1: 0, score2: 0, bracketSlot: "IEM-UB-R1-M4", round: "Upper Bracket — Opening", bo },

    { id: uid(), team1: "", team2: "", score1: 0, score2: 0, bracketSlot: "IEM-LB-R1-M1", round: "Lower Bracket — Elimination R1", bo },
    { id: uid(), team1: "", team2: "", score1: 0, score2: 0, bracketSlot: "IEM-LB-R1-M2", round: "Lower Bracket — Elimination R1", bo },

    { id: uid(), team1: "", team2: "", score1: 0, score2: 0, bracketSlot: "IEM-UB-SF-M1", round: "Upper Bracket — Winners Match", bo },
    { id: uid(), team1: "", team2: "", score1: 0, score2: 0, bracketSlot: "IEM-UB-SF-M2", round: "Upper Bracket — Winners Match", bo },

    { id: uid(), team1: "", team2: "", score1: 0, score2: 0, bracketSlot: "IEM-LB-R2-M1", round: "Lower Bracket — Elimination R2", bo },
    { id: uid(), team1: "", team2: "", score1: 0, score2: 0, bracketSlot: "IEM-LB-R2-M2", round: "Lower Bracket — Elimination R2", bo },

    { id: uid(), team1: "", team2: "", score1: 0, score2: 0, bracketSlot: "IEM-UB-FINAL", round: "Upper Bracket — Decider (1st seed)", bo },

    { id: uid(), team1: "", team2: "", score1: 0, score2: 0, bracketSlot: "IEM-LB-R3", round: "Lower Bracket — Elimination R3", bo },
  ];
  // LB Final (decider for 2nd seed) only makes sense when exactly 2 advance.
  // If 3+ advance, both LB-Final participants would qualify anyway → skip the match.
  if (advancePerGroup <= 2) {
    matches.push({ id: uid(), team1: "", team2: "", score1: 0, score2: 0, bracketSlot: "IEM-LB-FINAL", round: "Lower Bracket — Decider (2nd seed)", bo });
  }
  return matches;
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

/** Rebuild a group's match list from its current teams + format. */
export const rebuildGroupMatches = (
  format: PhaseFormat,
  teams: string[],
  bo: 1 | 3 | 5,
  advancePerGroup: number = 2,
): MatchResult[] => {
  if (format === "round-robin") return buildRoundRobin(teams, bo);
  if (format === "gsl-groups") return buildGSLGroup(teams, bo);
  if (format === "gsl-de-groups") return buildGSLDoubleElimGroup(teams, bo, advancePerGroup);
  return [];
};

/** Build a phase from format + teams */
export const buildPhase = (
  name: string,
  format: PhaseFormat,
  teams: string[],
  opts: {
    bo?: 1 | 3 | 5;
    groupCount?: number;
    advanceCount?: number;
    /** "manual" leaves groups empty so user can drag/select teams in detail page. */
    groupAssignment?: "random" | "manual";
  } = {}
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

  const manual = opts.groupAssignment === "manual";

  if (format === "single-elim") {
    phase.bracket = buildSingleElim(teams, bo);
  } else if (format === "double-elim") {
    phase.bracket = buildDoubleElim(teams, bo);
  } else if (format === "round-robin") {
    const groupCount = opts.groupCount ?? 1;
    const distributed = manual
      ? Array.from({ length: groupCount }, () => [] as string[])
      : distributeIntoGroups(teams, groupCount);
    phase.groups = distributed.map<PhaseGroup>((groupTeams, i) => ({
      id: uid(),
      name: `Group ${String.fromCharCode(65 + i)}`,
      teams: groupTeams,
      matches: buildRoundRobin(groupTeams, bo),
    }));
  } else if (format === "gsl-groups") {
    const groupCount = opts.groupCount ?? Math.max(1, Math.floor(teams.length / 4));
    const distributed = manual
      ? Array.from({ length: groupCount }, () => [] as string[])
      : distributeIntoGroups(teams, groupCount);
    phase.groups = distributed.map<PhaseGroup>((groupTeams, i) => ({
      id: uid(),
      name: `Group ${String.fromCharCode(65 + i)}`,
      teams: groupTeams,
      matches: buildGSLGroup(groupTeams, bo),
    }));
  } else if (format === "gsl-de-groups") {
    const groupCount = opts.groupCount ?? Math.max(1, Math.floor(teams.length / 8));
    const distributed = manual
      ? Array.from({ length: groupCount }, () => [] as string[])
      : distributeIntoGroups(teams, groupCount);
    phase.groups = distributed.map<PhaseGroup>((groupTeams, i) => ({
      id: uid(),
      name: `Group ${String.fromCharCode(65 + i)}`,
      teams: groupTeams,
      matches: buildGSLDoubleElimGroup(groupTeams, bo),
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

/**
 * Auto-propagate winners/losers within an IEM-style 8-team DE group.
 * Mutates the match list in place by filling team1/team2 of downstream
 * matches based on bracketSlot wiring.
 */
export const propagateGSLDEGroup = (matches: MatchResult[]): MatchResult[] => {
  const by = (slot: string) => matches.find(m => m.bracketSlot === slot);
  const winnerOf = (slot: string): string => {
    const m = by(slot); if (!m) return "";
    if (!m.team1 || !m.team2) return "";
    if (m.team1 === "TBD" || m.team2 === "TBD") return "";
    if (m.score1 + m.score2 === 0) return "";
    if (m.score1 === m.score2) return "";
    return m.score1 > m.score2 ? m.team1 : m.team2;
  };
  const loserOf = (slot: string): string => {
    const m = by(slot); if (!m) return "";
    if (!m.team1 || !m.team2) return "";
    if (m.team1 === "TBD" || m.team2 === "TBD") return "";
    if (m.score1 + m.score2 === 0) return "";
    if (m.score1 === m.score2) return "";
    return m.score1 > m.score2 ? m.team2 : m.team1;
  };
  const setSlot = (slot: string, t1: string, t2: string) => {
    const m = by(slot); if (!m) return;
    // Always sync with upstream results. If upstream isn't decided yet (empty string),
    // we leave the existing team in place so user-entered manual data is preserved.
    let changed = false;
    if (t1 && m.team1 !== t1) { m.team1 = t1; changed = true; }
    if (t2 && m.team2 !== t2) { m.team2 = t2; changed = true; }
    // Reset scores if downstream pairings changed (stale results no longer apply)
    if (changed) {
      m.score1 = 0;
      m.score2 = 0;
    }
  };

  // LB R1: losers of OM1 vs OM2, OM3 vs OM4
  setSlot("IEM-LB-R1-M1", loserOf("IEM-UB-R1-M1"), loserOf("IEM-UB-R1-M2"));
  setSlot("IEM-LB-R1-M2", loserOf("IEM-UB-R1-M3"), loserOf("IEM-UB-R1-M4"));

  // UB SF: winners of OM1 vs OM2, OM3 vs OM4
  setSlot("IEM-UB-SF-M1", winnerOf("IEM-UB-R1-M1"), winnerOf("IEM-UB-R1-M2"));
  setSlot("IEM-UB-SF-M2", winnerOf("IEM-UB-R1-M3"), winnerOf("IEM-UB-R1-M4"));

  // LB R2 (cross-bracket): winner of LB R1 vs loser of UB SF (opposite side)
  setSlot("IEM-LB-R2-M1", winnerOf("IEM-LB-R1-M1"), loserOf("IEM-UB-SF-M2"));
  setSlot("IEM-LB-R2-M2", winnerOf("IEM-LB-R1-M2"), loserOf("IEM-UB-SF-M1"));

  // UB Final: winners of UB SFs (winner = 1st seed)
  setSlot("IEM-UB-FINAL", winnerOf("IEM-UB-SF-M1"), winnerOf("IEM-UB-SF-M2"));

  // LB R3: winners of both LB R2 matches
  setSlot("IEM-LB-R3", winnerOf("IEM-LB-R2-M1"), winnerOf("IEM-LB-R2-M2"));

  // LB Final: loser of UB Final vs winner of LB R3 (winner = 2nd seed)
  setSlot("IEM-LB-FINAL", loserOf("IEM-UB-FINAL"), winnerOf("IEM-LB-R3"));

  return matches;
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
  group.teams.forEach(t => {
    if (!t || t === "TBD" || t === "BYE") return;
    standings.set(t, { team: t, wins: 0, losses: 0, mapDiff: 0 });
  });
  // head-to-head wins record: h2h[A][B] = mecze A wygrane vs B
  const h2h: Record<string, Record<string, number>> = {};
  const bumpH2H = (a: string, b: string) => {
    if (!h2h[a]) h2h[a] = {};
    h2h[a][b] = (h2h[a][b] || 0) + 1;
  };
  group.matches.forEach(m => {
    if (!m.team1 || !m.team2) return;
    if (m.team1 === "BYE" || m.team2 === "BYE") return;
    if (m.team1 === "TBD" || m.team2 === "TBD") return;
    if (m.score1 === 0 && m.score2 === 0) return;
    if (m.score1 === m.score2) return; // brak rozstrzygnięcia (nie powinno wystąpić w CS)
    const s1 = standings.get(m.team1);
    const s2 = standings.get(m.team2);
    if (!s1 || !s2) return;
    if (m.score1 > m.score2) { s1.wins++; s2.losses++; bumpH2H(m.team1, m.team2); }
    else                     { s2.wins++; s1.losses++; bumpH2H(m.team2, m.team1); }
    s1.mapDiff += m.score1 - m.score2;
    s2.mapDiff += m.score2 - m.score1;
  });
  return Array.from(standings.values()).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    // Head-to-head: jeśli A wygrał z B, A wyżej
    const aOverB = h2h[a.team]?.[b.team] || 0;
    const bOverA = h2h[b.team]?.[a.team] || 0;
    if (aOverB !== bOverA) return bOverA - aOverB;
    if (b.mapDiff !== a.mapDiff) return b.mapDiff - a.mapDiff;
    return a.team.localeCompare(b.team);
  });
};

export const formatLabel = (f: PhaseFormat): string => ({
  "single-elim": "Single Elimination",
  "double-elim": "Double Elimination",
  "swiss": "Swiss System",
  "round-robin": "Round Robin",
  "gsl-groups": "GSL Groups",
  "gsl-de-groups": "IEM-style Groups (DE)",
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
