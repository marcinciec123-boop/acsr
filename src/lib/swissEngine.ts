// Swiss System engine (Liquipedia / Major-style)
// Target: first to N wins advances, first to N losses is eliminated.
// Default N = 3 (16-team, 3-0 / 3-1 / 3-2 advance; 0-3 / 1-3 / 2-3 eliminated).
//
// Provides:
// - parsing match history from a phase's flat bracket array
// - per-team standing with W-L, RD, Buchholz tiebreak
// - pairing for the next round (high/mid/low groups, no rematch)
// - team status: "playing" | "advanced" | "eliminated" | "decider"
//
// Round labels follow the convention "Swiss R<N>" so old data stays compatible.

import type { MatchResult } from "./types";

export interface SwissTeamStanding {
  team: string;
  /** Map (game) wins across all played matches in this Swiss stage. */
  wins: number;
  losses: number;
  /** Round difference across played maps (sumScore - sumOpp) */
  roundDiff: number;
  /** Sum of opponents' wins (Buchholz) */
  buchholz: number;
  /** Initial seed (1-based). Used as final tie-breaker. */
  seed: number;
  /** Status given the win-cap. */
  status: "playing" | "advanced" | "eliminated";
  /** Per-round opponent + result info for table rendering. */
  history: SwissHistoryEntry[];
  /** Opponents this team already faced (for rematch prevention). */
  pastOpponents: Set<string>;
}

export interface SwissHistoryEntry {
  round: number; // 1-based
  opponent: string | null;
  /** "W" | "L" | "" (not played yet / pending) */
  result: "W" | "L" | "";
  score: string; // e.g. "2:0", "1:2"
  /** Whether this match WAS an advancement/elimination (best-of-3) match. */
  decisive: boolean;
}

export interface SwissStageData {
  /** Sorted standings (best to worst). */
  standings: SwissTeamStanding[];
  /** All matches grouped by round number. */
  rounds: SwissRoundData[];
  /** Highest round number with any matches (1-based). */
  currentRound: number;
  /** Wins required to advance (= losses to be eliminated). */
  winCap: number;
  /** True when every team is either advanced or eliminated. */
  finished: boolean;
}

export interface SwissRoundData {
  round: number;
  matches: MatchResult[];
}

const ROUND_RE = /Swiss\s*R\s*(\d+)/i;

const parseRound = (m: MatchResult): number => {
  const match = (m.round || "").match(ROUND_RE);
  return match ? parseInt(match[1], 10) : 1;
};

export const swissRoundLabel = (n: number): string => `Swiss R${n}`;

/** Returns all matches with a normalized round number. */
export function getSwissRounds(bracket: MatchResult[]): SwissRoundData[] {
  const byRound = new Map<number, MatchResult[]>();
  bracket.forEach(m => {
    const r = parseRound(m);
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r)!.push(m);
  });
  return Array.from(byRound.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([round, matches]) => ({ round, matches }));
}

/** Compute full Swiss stage data from phase teams + bracket. */
export function computeSwissStage(
  phaseTeams: string[],
  bracket: MatchResult[],
  opts: { winCap?: number; priorMeetings?: Set<string> } = {},
): SwissStageData {
  const winCap = opts.winCap ?? 3;
  const priorMeetings = opts.priorMeetings;
  const rounds = getSwissRounds(bracket);
  const currentRound = rounds.length ? rounds[rounds.length - 1].round : 0;

  // Initial standings keyed by team name; preserve initial seed order from phaseTeams.
  const map = new Map<string, SwissTeamStanding>();
  phaseTeams.forEach((team, i) => {
    if (!team) return;
    map.set(team, {
      team,
      wins: 0,
      losses: 0,
      roundDiff: 0,
      buchholz: 0,
      seed: i + 1,
      status: "playing",
      history: [],
      pastOpponents: new Set(),
    });
  });

  // Ensure teams that appear in bracket but not in phaseTeams (manual edits) are tracked too.
  bracket.forEach(m => {
    [m.team1, m.team2].forEach(name => {
      if (name && !map.has(name)) {
        map.set(name, {
          team: name,
          wins: 0,
          losses: 0,
          roundDiff: 0,
          buchholz: 0,
          seed: map.size + 1,
          status: "playing",
          history: [],
          pastOpponents: new Set(),
        });
      }
    });
  });

  // Walk rounds in order
  rounds.forEach(({ round, matches }) => {
    matches.forEach(m => {
      const t1 = m.team1;
      const t2 = m.team2;
      const a = t1 ? map.get(t1) : null;
      const b = t2 ? map.get(t2) : null;
      const played = (m.score1 + m.score2) > 0;
      const winner = played ? (m.score1 > m.score2 ? t1 : t2) : "";

      if (a) {
        if (b) a.pastOpponents.add(b.team);
        a.history.push({
          round,
          opponent: b ? b.team : null,
          result: played ? (winner === t1 ? "W" : "L") : "",
          score: played ? `${m.score1}:${m.score2}` : "",
          decisive: false, // computed below
        });
        if (played) {
          if (winner === t1) a.wins += 1; else a.losses += 1;
          a.roundDiff += (m.score1 - m.score2);
        }
      }
      if (b) {
        if (a) b.pastOpponents.add(a.team);
        b.history.push({
          round,
          opponent: a ? a.team : null,
          result: played ? (winner === t2 ? "W" : "L") : "",
          score: played ? `${m.score2}:${m.score1}` : "",
          decisive: false,
        });
        if (played) {
          if (winner === t2) b.wins += 1; else b.losses += 1;
          b.roundDiff += (m.score2 - m.score1);
        }
      }
    });
  });

  // Cross-phase rematch avoidance: register opponents from prior phases so
  // pairing in next round treats them as already played.
  if (priorMeetings && priorMeetings.size > 0) {
    const teamList = Array.from(map.keys());
    for (let i = 0; i < teamList.length; i++) {
      for (let j = i + 1; j < teamList.length; j++) {
        const a = teamList[i], b = teamList[j];
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        if (priorMeetings.has(key)) {
          map.get(a)!.pastOpponents.add(b);
          map.get(b)!.pastOpponents.add(a);
        }
      }
    }
  }

  // Mark status (advanced/eliminated) once thresholds are reached.
  map.forEach(s => {
    if (s.wins >= winCap) s.status = "advanced";
    else if (s.losses >= winCap) s.status = "eliminated";
  });

  // Mark history entries that were decisive matches retroactively
  // (a match was decisive if AFTER it the team became advanced/eliminated)
  map.forEach(s => {
    let w = 0, l = 0;
    s.history.forEach(h => {
      if (h.result === "W") w += 1;
      else if (h.result === "L") l += 1;
      // If this match brought player to win-cap or loss-cap, it was decisive.
      if (h.result && (w === winCap || l === winCap)) h.decisive = true;
    });
  });

  // Buchholz: sum of opponents' wins (only count opponents we actually played).
  map.forEach(s => {
    let bu = 0;
    s.pastOpponents.forEach(opp => {
      const o = map.get(opp);
      if (o) bu += o.wins;
    });
    s.buchholz = bu;
  });

  const standings = Array.from(map.values()).sort((a, b) => {
    // 1. status: advanced > playing > eliminated
    const statusRank = (st: SwissTeamStanding["status"]) =>
      st === "advanced" ? 0 : st === "playing" ? 1 : 2;
    const sd = statusRank(a.status) - statusRank(b.status);
    if (sd !== 0) return sd;
    // 2. wins desc
    if (b.wins !== a.wins) return b.wins - a.wins;
    // 3. losses asc
    if (a.losses !== b.losses) return a.losses - b.losses;
    // 4. Buchholz desc
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    // 5. round difference desc
    if (b.roundDiff !== a.roundDiff) return b.roundDiff - a.roundDiff;
    // 6. seed asc
    return a.seed - b.seed;
  });

  const finished = standings.length > 0 && standings.every(s => s.status !== "playing");

  return { standings, rounds, currentRound, winCap, finished };
}

/** Pair teams for the next Swiss round.
 * Algorithm:
 *   1) Group active (still "playing") teams by their (W-L) bucket.
 *   2) Within each bucket, sort by Buchholz desc then seed asc.
 *   3) Pair top vs bottom inside the bucket, avoiding rematches if possible.
 *   4) If a bucket has odd size, float lowest-ranked team to the next bucket down.
 *   5) Mark bucket matches as best-of-3 if they're elimination/advancement matches
 *      (winning would reach winCap, OR losing would reach winCap).
 */
export interface NextRoundPlan {
  round: number;
  pairings: { team1: string; team2: string; bo: 1 | 3 | 5; group: string; decisive: boolean }[];
  /** Teams that have no opponent (odd participants count). */
  byes: string[];
  /** Reason if generation isn't possible. */
  error?: string;
}

export function planNextSwissRound(
  stage: SwissStageData,
  opts: { defaultBo?: 1 | 3 | 5; decisiveBo?: 1 | 3 | 5 } = {},
): NextRoundPlan {
  const defaultBo = opts.defaultBo ?? 1;
  const decisiveBo = opts.decisiveBo ?? 3;
  const round = stage.currentRound + 1;

  // Active teams = still playing AND have completed all their previous rounds (no pending matches).
  const active = stage.standings.filter(s => s.status === "playing");
  if (active.length < 2) {
    return { round, pairings: [], byes: active.map(a => a.team), error: "Za mało aktywnych drużyn" };
  }
  // Block if previous round has unfinished matches
  const prevRound = stage.rounds[stage.rounds.length - 1];
  if (prevRound) {
    const unfinished = prevRound.matches.some(m => !m.team1 || !m.team2 || (m.score1 + m.score2) === 0);
    if (unfinished) {
      return { round, pairings: [], byes: [], error: "Poprzednia runda nie jest zakończona" };
    }
  }

  // Bucket by (wins-losses) string e.g. "2-1"
  const buckets = new Map<string, SwissTeamStanding[]>();
  active.forEach(s => {
    const k = `${s.wins}-${s.losses}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(s);
  });

  // Order buckets from best to worst record (more wins, fewer losses first)
  const orderedKeys = Array.from(buckets.keys()).sort((a, b) => {
    const [aw, al] = a.split("-").map(Number);
    const [bw, bl] = b.split("-").map(Number);
    if (bw !== aw) return bw - aw;
    return al - bl;
  });

  const pairings: NextRoundPlan["pairings"] = [];
  const byes: string[] = [];
  let floater: SwissTeamStanding | null = null;

  for (const key of orderedKeys) {
    const bucket = buckets.get(key)!;
    if (floater) { bucket.push(floater); floater = null; }
    // Sort within bucket
    bucket.sort((a, b) =>
      b.buchholz - a.buchholz || b.roundDiff - a.roundDiff || a.seed - b.seed
    );
    if (bucket.length % 2 === 1) {
      // Float lowest team to next bucket
      floater = bucket.pop()!;
    }
    // Pair using top-vs-bottom with rematch avoidance.
    const localPairs = pairBucket(bucket);
    const [w, l] = key.split("-").map(Number);
    const decisive = (w + 1 >= stage.winCap) || (l + 1 >= stage.winCap);
    const bo = decisive ? decisiveBo : defaultBo;
    const groupLabel = bucketLabel(key, stage.winCap);
    localPairs.forEach(([t1, t2]) => {
      pairings.push({ team1: t1.team, team2: t2.team, bo, group: groupLabel, decisive });
    });
  }

  if (floater) byes.push(floater.team);

  return { round, pairings, byes };
}

/** Greedy pairing top-vs-bottom that avoids rematches when possible.
 *  Tries swapping if the natural pairing would be a rematch. */
function pairBucket(sorted: SwissTeamStanding[]): [SwissTeamStanding, SwissTeamStanding][] {
  const pairs: [SwissTeamStanding, SwissTeamStanding][] = [];
  const remaining = [...sorted];
  while (remaining.length >= 2) {
    const top = remaining.shift()!;
    // pick the lowest seed not already faced; if all faced, accept rematch.
    let oppIdx = remaining.length - 1;
    for (let i = remaining.length - 1; i >= 0; i--) {
      if (!top.pastOpponents.has(remaining[i].team)) { oppIdx = i; break; }
    }
    const opp = remaining.splice(oppIdx, 1)[0];
    pairs.push([top, opp]);
  }
  return pairs;
}

function bucketLabel(key: string, winCap: number): string {
  const [w, l] = key.split("-").map(Number);
  if (w === winCap - 1 && l === winCap - 1) return "Decider";
  if (w === winCap - 1) return "Advancement";
  if (l === winCap - 1) return "Elimination";
  if (w > l) return "High";
  if (w < l) return "Low";
  return "Mid";
}
