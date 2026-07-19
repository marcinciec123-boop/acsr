// ===== Year-end awards ("Złota Piłka CS") =====
//
// Computes annual awards from tournaments_data + transfers + ranking_data
// snapshots for a given fictional-calendar year. Triggered when the world
// clock reaches Dec 31 of that year.

import type { TournamentData, Transfer, TeamData, MatchResult, MapPlayerStats } from "./types";
import { loadFromStorage, saveToStorage } from "./storage";
import { calculateRating } from "./playerStats";

export interface AwardCandidate<T = string> { value: T; score: number; extra?: string }

export interface TeamAward {
  team: string;
  trophies: number;
  finals: number;
  top3: number;
  points: number;
}
export interface PlayerAward {
  player: string;
  team: string;
  rating: number;
  matches: number;
  kdr: number;
  kills: number;
  adr: number;
}
export interface TournamentAward {
  id: string;
  name: string;
  tier: string;
  prizePool: string;
  teams: number;
  winner: string;
}
export interface TransferAward {
  player: string;
  oldTeam: string;
  newTeam: string;
  date: string;
  postRating: number;
  postMatches: number;
}
export interface CoachAward { coach: string; team: string; trophies: number }

export interface YearAwards {
  year: number;
  computedAt: string;
  totalTournaments: number;
  totalMatches: number;
  teamOfYear?: TeamAward;
  teamTop3: TeamAward[];
  playerOfYear?: PlayerAward;
  playerTop5: PlayerAward[];
  rookieOfYear?: PlayerAward;
  topFragger?: PlayerAward;
  mvpKing?: { player: string; team: string; mvps: number };
  coachOfYear?: CoachAward;
  tournamentOfYear?: TournamentAward;
  transferOfYear?: TransferAward;
}

const HISTORY_KEY = "year_awards_history";
const SHOWN_KEY = "year_awards_shown";

export function loadYearAwardsHistory(): Record<string, YearAwards> {
  return loadFromStorage<Record<string, YearAwards>>(HISTORY_KEY, {});
}
export function saveYearAwards(a: YearAwards): void {
  const h = loadYearAwardsHistory();
  h[String(a.year)] = a;
  saveToStorage(HISTORY_KEY, h);
}
export function getShownYears(): number[] {
  return loadFromStorage<number[]>(SHOWN_KEY, []);
}
export function markYearShown(year: number): void {
  const set = new Set(getShownYears());
  set.add(year);
  saveToStorage(SHOWN_KEY, Array.from(set));
}

const inYear = (iso: string | undefined | null, year: number): boolean => {
  if (!iso) return false;
  return iso.slice(0, 4) === String(year);
};

const parsePrize = (s: string | undefined): number => {
  if (!s) return 0;
  const n = Number(String(s).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export function computeYearAwards(year: number): YearAwards {
  const tournaments = loadFromStorage<TournamentData[]>("tournaments_data", []);
  const transfers = loadFromStorage<Transfer[]>("transfers_data", []);
  const teams = loadFromStorage<TeamData[]>("ranking_data", []);

  const yearTournaments = tournaments.filter(
    t => t.status === "completed" && inYear(t.endDate, year) && !t.name?.toLowerCase().includes("kwalifikacj"),
  );

  // ===== Team of the Year =====
  const teamStats = new Map<string, TeamAward>();
  const bumpTeam = (name: string, placement: number, points: number) => {
    const e = teamStats.get(name) || { team: name, trophies: 0, finals: 0, top3: 0, points: 0 };
    if (placement === 1) e.trophies++;
    if (placement <= 2) e.finals++;
    if (placement <= 3) e.top3++;
    e.points += points;
    teamStats.set(name, e);
  };
  for (const t of yearTournaments) {
    for (const p of t.placements || []) {
      bumpTeam(p.team, p.placement, p.points || 0);
    }
  }
  const teamRanked = Array.from(teamStats.values()).sort(
    (a, b) => b.trophies - a.trophies || b.finals - a.finals || b.top3 - a.top3 || b.points - a.points,
  );
  const teamOfYear = teamRanked[0];
  const teamTop3 = teamRanked.slice(0, 3);

  // ===== Player stats for the year (single pass) =====
  interface PAcc {
    team: string;
    kills: number; deaths: number; assists: number;
    ud: number; ef: number;
    adrW: number; kastW: number; rounds: number;
    matchRatings: number[];
    hadTransfer: boolean;
  }
  const players = new Map<string, PAcc>();
  let totalMatches = 0;

  for (const t of yearTournaments) {
    const allMatches: MatchResult[] = [];
    for (const phase of t.phases || []) {
      if (phase.bracket) allMatches.push(...phase.bracket);
      if (phase.groups) for (const g of phase.groups) allMatches.push(...g.matches);
    }
    if (t.matches) allMatches.push(...t.matches);

    for (const match of allMatches) {
      if (!match.maps) continue;
      const acc = new Map<string, { isT1: boolean; k: number; d: number; a: number; ud: number; ef: number; adrW: number; kastW: number; r: number }>();
      const pushSide = (list: MapPlayerStats[] | undefined, isT1: boolean, rounds: number) => {
        if (!list) return;
        for (const p of list) {
          let a = acc.get(p.playerName);
          if (!a) { a = { isT1, k: 0, d: 0, a: 0, ud: 0, ef: 0, adrW: 0, kastW: 0, r: 0 }; acc.set(p.playerName, a); }
          a.k += p.kills; a.d += p.deaths; a.a += p.assists;
          a.ud += p.ud; a.ef += p.ef;
          a.adrW += p.adr * rounds; a.kastW += p.kast * rounds; a.r += rounds;
        }
      };
      for (const m of match.maps) {
        const rounds = (m.score1 || 0) + (m.score2 || 0);
        if (rounds <= 0) continue;
        pushSide(m.team1Players, true, rounds);
        pushSide(m.team2Players, false, rounds);
      }
      let matchCounted = false;
      for (const [name, a] of acc) {
        if (a.r === 0) continue;
        const team = a.isT1 ? match.team1 : match.team2;
        const rating = calculateRating({
          playerName: name, team,
          kills: a.k, deaths: a.d, assists: a.a,
          adr: Math.round(a.adrW / a.r),
          kast: Math.round(a.kastW / a.r),
          ud: a.ud, ef: a.ef, rounds: a.r,
        });
        let pe = players.get(name);
        if (!pe) {
          pe = { team, kills: 0, deaths: 0, assists: 0, ud: 0, ef: 0, adrW: 0, kastW: 0, rounds: 0, matchRatings: [], hadTransfer: false };
          players.set(name, pe);
        }
        pe.team = team;
        pe.kills += a.k; pe.deaths += a.d; pe.assists += a.a;
        pe.ud += a.ud; pe.ef += a.ef;
        pe.adrW += a.adrW; pe.kastW += a.kastW; pe.rounds += a.r;
        pe.matchRatings.push(rating);
        matchCounted = true;
      }
      if (matchCounted) totalMatches++;
    }
  }

  // Mark transfers within the year
  for (const tr of transfers) {
    if (!inYear(tr.date, year)) continue;
    const pe = players.get(tr.player);
    if (pe) pe.hadTransfer = true;
  }

  const buildPlayer = (name: string, e: PAcc): PlayerAward => ({
    player: name,
    team: e.team,
    matches: e.matchRatings.length,
    rating: e.matchRatings.length
      ? Math.round((e.matchRatings.reduce((s, r) => s + r, 0) / e.matchRatings.length) * 100) / 100
      : 0,
    kdr: e.deaths > 0 ? Math.round((e.kills / e.deaths) * 100) / 100 : e.kills,
    kills: e.kills,
    adr: e.rounds > 0 ? Math.round(e.adrW / e.rounds) : 0,
  });

  const playersArr = Array.from(players.entries()).map(([n, e]) => ({ p: buildPlayer(n, e), hadTransfer: e.hadTransfer }));

  const eligible = playersArr.filter(x => x.p.matches >= 20).sort((a, b) => b.p.rating - a.p.rating);
  const playerTop5 = eligible.slice(0, 5).map(x => x.p);
  const playerOfYear = eligible[0]?.p;

  const rookiePool = playersArr
    .filter(x => x.p.matches >= 5 && x.p.matches < 20)
    .sort((a, b) => b.p.rating - a.p.rating);
  const rookieOfYear = rookiePool[0]?.p;

  const fragger = [...playersArr].sort((a, b) => b.p.kills - a.p.kills)[0]?.p;

  // MVP king
  const mvpCount = new Map<string, { team: string; mvps: number }>();
  for (const t of yearTournaments) {
    const mvp = t.awards?.mvp;
    if (!mvp) continue;
    const e = mvpCount.get(mvp) || { team: t.awards?.mvpTeam || "", mvps: 0 };
    e.mvps++;
    if (t.awards?.mvpTeam) e.team = t.awards.mvpTeam;
    mvpCount.set(mvp, e);
  }
  const mvpRanked = Array.from(mvpCount.entries())
    .map(([player, v]) => ({ player, ...v }))
    .sort((a, b) => b.mvps - a.mvps);
  const mvpKing = mvpRanked[0];

  // Coach of the Year: coach of team of the year (fallback: coach of top team by trophies whose team has a coach)
  let coachOfYear: CoachAward | undefined;
  for (const cand of teamRanked) {
    const tm = teams.find(x => x.name === cand.team);
    if (tm?.coach) {
      coachOfYear = { coach: tm.coach, team: cand.team, trophies: cand.trophies };
      break;
    }
  }

  // Tournament of the Year: prefer highest tier (S>A>B>C), then largest prize pool, then most teams
  const tierRank: Record<string, number> = { S: 4, A: 3, B: 2, C: 1 };
  const tournamentRanked = [...yearTournaments].sort((a, b) => {
    const ta = tierRank[a.tier] || 0, tb = tierRank[b.tier] || 0;
    if (ta !== tb) return tb - ta;
    const pa = parsePrize(a.prizePool), pb = parsePrize(b.prizePool);
    if (pa !== pb) return pb - pa;
    return (b.teams || 0) - (a.teams || 0);
  });
  const bestT = tournamentRanked[0];
  const tournamentOfYear = bestT ? {
    id: bestT.id, name: bestT.name, tier: bestT.tier, prizePool: bestT.prizePool,
    teams: bestT.teams || bestT.participants?.length || 0,
    winner: bestT.placements?.find(p => p.placement === 1)?.team || "—",
  } : undefined;

  // Transfer of the Year: highest year rating among players who transferred this year
  const transferPool = playersArr
    .filter(x => x.hadTransfer && x.p.matches >= 10)
    .sort((a, b) => b.p.rating - a.p.rating);
  let transferOfYear: TransferAward | undefined;
  if (transferPool[0]) {
    const winnerName = transferPool[0].p.player;
    // Pick latest transfer of that player in year
    const trs = transfers
      .filter(t => t.player === winnerName && inYear(t.date, year))
      .sort((a, b) => a.date.localeCompare(b.date));
    const last = trs[trs.length - 1];
    if (last) {
      transferOfYear = {
        player: winnerName,
        oldTeam: last.oldTeam,
        newTeam: last.newTeam,
        date: last.date,
        postRating: transferPool[0].p.rating,
        postMatches: transferPool[0].p.matches,
      };
    }
  }

  return {
    year,
    computedAt: new Date().toISOString(),
    totalTournaments: yearTournaments.length,
    totalMatches,
    teamOfYear,
    teamTop3,
    playerOfYear,
    playerTop5,
    rookieOfYear,
    topFragger: fragger,
    mvpKing,
    coachOfYear,
    tournamentOfYear,
    transferOfYear,
  };
}
