// ===== Simulation Engine =====
// Supports: Swiss, Groups+Knockout, Knockout, Major (3 Swiss stages + Playoffs)

export type TournamentFormat = "swiss+knockout" | "groups+knockout" | "knockout" | "major";

export interface Tournament {
  id: string;
  name: string;
  organizer: string;
  prizePool: string;
  startDate: string;
  endDate: string;
  status: "upcoming" | "live" | "completed";
  teams: number;
  location: string;
  tier: "S" | "A" | "B" | "C";
  participants: string[];
  description: string;
  format: TournamentFormat;
  formatDetails: string;
}

export interface Player {
  id: string;
  name: string;
  realName: string;
  team: string;
  country: string;
  rating: number;
  kills: number;
  deaths: number;
  maps: number;
  adr: number;
  kast: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: "match" | "tournament-start" | "tournament-end" | "qualifier";
  description: string;
}

// ===== Match & Stage Types =====

export interface MatchResult {
  team1: string;
  team2: string;
  score1: number;
  score2: number;
  winner: string;
  bo: number;
}

export interface SwissRound {
  roundNumber: number;
  matches: MatchResult[];
}

export interface SwissStanding {
  team: string;
  wins: number;
  losses: number;
  qualified: boolean;
  eliminated: boolean;
}

export interface SwissResult {
  rounds: SwissRound[];
  standings: SwissStanding[];
  qualified: string[];
  eliminated: string[];
}

export interface GroupResult {
  groupName: string;
  teams: string[];
  matches: MatchResult[];
  standings: GroupStanding[];
  qualified: string[];
}

export interface GroupStanding {
  team: string;
  wins: number;
  losses: number;
  roundDiff: number;
}

export interface KnockoutRound {
  name: string;
  matches: MatchResult[];
}

export interface KnockoutResult {
  rounds: KnockoutRound[];
  winner: string;
}

export interface MajorStage {
  name: string;
  type: "swiss" | "knockout";
  swiss?: SwissResult;
  knockout?: KnockoutResult;
  participants: string[];
}

export interface TournamentSimulation {
  tournamentId: string;
  format: TournamentFormat;
  swiss?: SwissResult;
  groups?: GroupResult[];
  knockout?: KnockoutResult;
  majorStages?: MajorStage[];
  winner: string;
  placements: TeamPlacement[];
}

// ===== Points System =====

export interface TeamPlacement {
  team: string;
  placement: number; // 1, 2, 3, 4, 5, ...
  points: number;
}

export interface SeasonTeamStanding {
  team: string;
  totalPoints: number;
  tournaments: number;
  wins: number;
  top4: number;
  bestPlacement: number;
  pointHistory: { tournamentId: string; tournamentName: string; placement: number; points: number }[];
}

const tierPointsMap: Record<string, Record<number, number>> = {
  S: { 1: 2000, 2: 1500, 3: 1100, 4: 800, 5: 500, 6: 500, 7: 350, 8: 350, 9: 200, 13: 100, 17: 50 },
  A: { 1: 800, 2: 600, 3: 400, 4: 300, 5: 200, 6: 200, 7: 150, 8: 150, 9: 75, 13: 40 },
  B: { 1: 300, 2: 200, 3: 150, 4: 100, 5: 75, 6: 75, 7: 50, 8: 50, 9: 25 },
  C: { 1: 100, 2: 75, 3: 50, 4: 40, 5: 25, 6: 25, 7: 15, 8: 15 },
  major: { 1: 3000, 2: 2200, 3: 1600, 4: 1200, 5: 800, 6: 800, 7: 600, 8: 600, 9: 300, 13: 150, 17: 75 },
};

export function getPointsForPlacement(tier: string, placement: number, isMajor: boolean): number {
  const table = isMajor ? tierPointsMap["major"] : tierPointsMap[tier];
  if (!table) return 0;
  const thresholds = Object.keys(table).map(Number).sort((a, b) => a - b);
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (placement >= thresholds[i]) return table[thresholds[i]];
  }
  return 0;
}

export function derivePlacements(sim: TournamentSimulation, tournament: Tournament): TeamPlacement[] {
  const isMajor = tournament.format === "major";
  const placements: TeamPlacement[] = [];

  if (sim.knockout) {
    const rounds = sim.knockout.rounds;
    // Winner = 1st, final loser = 2nd
    const finalMatch = rounds[rounds.length - 1]?.matches[0];
    if (finalMatch) {
      placements.push({ team: finalMatch.winner, placement: 1, points: 0 });
      const loser = finalMatch.winner === finalMatch.team1 ? finalMatch.team2 : finalMatch.team1;
      placements.push({ team: loser, placement: 2, points: 0 });
    }
    // Semi losers = 3-4
    if (rounds.length >= 2) {
      const semis = rounds[rounds.length - 2].matches;
      let place = 3;
      semis.forEach(m => {
        const loser = m.winner === m.team1 ? m.team2 : m.team1;
        if (!placements.find(p => p.team === loser)) {
          placements.push({ team: loser, placement: place++, points: 0 });
        }
      });
    }
    // QF losers = 5-8 etc.
    for (let r = rounds.length - 3; r >= 0; r--) {
      const startPlace = placements.length + 1;
      rounds[r].matches.forEach(m => {
        const loser = m.winner === m.team1 ? m.team2 : m.team1;
        if (loser !== "BYE" && !placements.find(p => p.team === loser)) {
          placements.push({ team: loser, placement: startPlace, points: 0 });
        }
      });
    }
  }

  // Add eliminated Swiss/Group teams at the end
  const allTeams = new Set(tournament.participants.slice(0, tournament.teams));
  const placed = new Set(placements.map(p => p.team));
  let nextPlace = placements.length + 1;

  if (sim.swiss) {
    sim.swiss.eliminated.forEach(t => {
      if (!placed.has(t)) {
        placements.push({ team: t, placement: nextPlace++, points: 0 });
        placed.add(t);
      }
    });
  }
  if (sim.groups) {
    sim.groups.forEach(g => {
      g.teams.forEach(t => {
        if (!placed.has(t)) {
          placements.push({ team: t, placement: nextPlace++, points: 0 });
          placed.add(t);
        }
      });
    });
  }
  if (sim.majorStages) {
    // Add teams eliminated in earlier stages
    for (let i = sim.majorStages.length - 1; i >= 0; i--) {
      const stage = sim.majorStages[i];
      if (stage.swiss) {
        stage.swiss.eliminated.forEach(t => {
          if (!placed.has(t)) {
            placements.push({ team: t, placement: nextPlace++, points: 0 });
            placed.add(t);
          }
        });
      }
    }
  }

  // Remaining teams
  allTeams.forEach(t => {
    if (!placed.has(t)) {
      placements.push({ team: t, placement: nextPlace++, points: 0 });
    }
  });

  // Assign points
  placements.forEach(p => {
    p.points = getPointsForPlacement(tournament.tier, p.placement, isMajor);
  });

  return placements;
}

export function calculateSeasonStandings(
  tournaments: Tournament[],
  simResults: Record<string, TournamentSimulation>
): SeasonTeamStanding[] {
  const standings: Record<string, SeasonTeamStanding> = {};

  for (const t of tournaments) {
    const sim = simResults[t.id];
    if (!sim) continue;

    sim.placements.forEach(p => {
      if (!standings[p.team]) {
        standings[p.team] = {
          team: p.team,
          totalPoints: 0,
          tournaments: 0,
          wins: 0,
          top4: 0,
          bestPlacement: 999,
          pointHistory: [],
        };
      }
      const s = standings[p.team];
      s.totalPoints += p.points;
      s.tournaments++;
      if (p.placement === 1) s.wins++;
      if (p.placement <= 4) s.top4++;
      if (p.placement < s.bestPlacement) s.bestPlacement = p.placement;
      s.pointHistory.push({
        tournamentId: t.id,
        tournamentName: t.name,
        placement: p.placement,
        points: p.points,
      });
    });
  }

  return Object.values(standings).sort((a, b) => b.totalPoints - a.totalPoints);
}

// ===== Simulation Logic =====

function simulateMatch(team1: string, team2: string, bo: number): MatchResult {
  const winsNeeded = Math.ceil(bo / 2);
  let s1 = 0, s2 = 0;
  while (s1 < winsNeeded && s2 < winsNeeded) {
    if (Math.random() < 0.52) s1++;
    else s2++;
  }
  return { team1, team2, score1: s1, score2: s2, winner: s1 > s2 ? team1 : team2, bo };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function simulateSwiss(teams: string[], winsToQualify = 3, lossesToEliminate = 3): SwissResult {
  const standings: SwissStanding[] = teams.map((t) => ({
    team: t, wins: 0, losses: 0, qualified: false, eliminated: false,
  }));
  const rounds: SwissRound[] = [];

  for (let roundNum = 1; roundNum <= winsToQualify + lossesToEliminate - 1; roundNum++) {
    const active = standings.filter((s) => !s.qualified && !s.eliminated);
    if (active.length < 2) break;

    const byRecord: Record<string, SwissStanding[]> = {};
    active.forEach((s) => {
      const key = `${s.wins}-${s.losses}`;
      if (!byRecord[key]) byRecord[key] = [];
      byRecord[key].push(s);
    });

    const matches: MatchResult[] = [];
    const paired = new Set<string>();
    const records = Object.keys(byRecord).sort((a, b) => {
      const [aw] = a.split("-").map(Number);
      const [bw] = b.split("-").map(Number);
      return bw - aw;
    });

    let unpaired: SwissStanding[] = [];

    for (const record of records) {
      const pool = shuffle([...unpaired, ...byRecord[record]]);
      unpaired = [];

      for (let i = 0; i < pool.length - 1; i += 2) {
        if (paired.has(pool[i].team) || paired.has(pool[i + 1].team)) {
          if (!paired.has(pool[i].team)) unpaired.push(pool[i]);
          if (!paired.has(pool[i + 1].team)) unpaired.push(pool[i + 1]);
          continue;
        }

        const isDecider = pool[i].wins === winsToQualify - 1 || pool[i].losses === lossesToEliminate - 1;
        const bo = isDecider ? 3 : 1;
        const result = simulateMatch(pool[i].team, pool[i + 1].team, bo);
        matches.push(result);
        paired.add(pool[i].team);
        paired.add(pool[i + 1].team);

        const winnerStanding = standings.find((s) => s.team === result.winner)!;
        const loserTeam = result.winner === result.team1 ? result.team2 : result.team1;
        const loserStanding = standings.find((s) => s.team === loserTeam)!;

        winnerStanding.wins++;
        loserStanding.losses++;

        if (winnerStanding.wins >= winsToQualify) winnerStanding.qualified = true;
        if (loserStanding.losses >= lossesToEliminate) loserStanding.eliminated = true;
      }

      if (pool.length % 2 === 1 && !paired.has(pool[pool.length - 1].team)) {
        unpaired.push(pool[pool.length - 1]);
      }
    }

    if (matches.length > 0) {
      rounds.push({ roundNumber: roundNum, matches });
    }

    const remaining = standings.filter((s) => !s.qualified && !s.eliminated);
    if (remaining.length < 2) break;
  }

  return {
    rounds,
    standings: standings.sort((a, b) => b.wins - a.wins || a.losses - b.losses),
    qualified: standings.filter((s) => s.qualified).map((s) => s.team),
    eliminated: standings.filter((s) => s.eliminated).map((s) => s.team),
  };
}

export function simulateGroups(teams: string[], groupCount: number, advancePerGroup: number): GroupResult[] {
  const shuffled = shuffle(teams);
  const perGroup = Math.ceil(shuffled.length / groupCount);
  const groups: GroupResult[] = [];

  for (let g = 0; g < groupCount; g++) {
    const groupTeams = shuffled.slice(g * perGroup, (g + 1) * perGroup);
    const groupName = String.fromCharCode(65 + g);
    const matches: MatchResult[] = [];

    for (let i = 0; i < groupTeams.length; i++) {
      for (let j = i + 1; j < groupTeams.length; j++) {
        matches.push(simulateMatch(groupTeams[i], groupTeams[j], 1));
      }
    }

    const standingsMap: Record<string, GroupStanding> = {};
    groupTeams.forEach((t) => {
      standingsMap[t] = { team: t, wins: 0, losses: 0, roundDiff: 0 };
    });

    matches.forEach((m) => {
      standingsMap[m.winner].wins++;
      const loser = m.winner === m.team1 ? m.team2 : m.team1;
      standingsMap[loser].losses++;
      standingsMap[m.team1].roundDiff += m.score1 - m.score2;
      standingsMap[m.team2].roundDiff += m.score2 - m.score1;
    });

    const sorted = Object.values(standingsMap).sort((a, b) => b.wins - a.wins || b.roundDiff - a.roundDiff);
    const qualified = sorted.slice(0, advancePerGroup).map((s) => s.team);

    groups.push({ groupName, teams: groupTeams, matches, standings: sorted, qualified });
  }

  return groups;
}

export function simulateKnockout(teams: string[], startBo = 3): KnockoutResult {
  const rounds: KnockoutRound[] = [];
  let currentTeams = [...teams];

  let size = 2;
  while (size < currentTeams.length) size *= 2;
  while (currentTeams.length < size) currentTeams.push("BYE");

  const totalRounds = Math.log2(size);
  const roundNameMap: Record<number, string> = {};

  for (let r = 1; r <= totalRounds; r++) {
    const remaining = size / Math.pow(2, r - 1);
    if (remaining === 2) roundNameMap[r] = "Grand Final";
    else if (remaining === 4) roundNameMap[r] = "Półfinały";
    else if (remaining === 8) roundNameMap[r] = "Ćwierćfinały";
    else if (remaining === 16) roundNameMap[r] = "1/8 Finału";
    else roundNameMap[r] = `Runda ${r}`;
  }

  for (let r = 1; r <= totalRounds; r++) {
    const matches: MatchResult[] = [];
    const bo = r === totalRounds ? 5 : r >= totalRounds - 1 ? 3 : startBo;

    for (let i = 0; i < currentTeams.length; i += 2) {
      const t1 = currentTeams[i];
      const t2 = currentTeams[i + 1] || "BYE";

      if (t2 === "BYE") {
        matches.push({ team1: t1, team2: "BYE", score1: 2, score2: 0, winner: t1, bo });
      } else {
        matches.push(simulateMatch(t1, t2, bo));
      }
    }

    rounds.push({ name: roundNameMap[r] || `Runda ${r}`, matches });
    currentTeams = matches.map((m) => m.winner);
  }

  return { rounds, winner: currentTeams[0] };
}

export function simulateTournament(tournament: Tournament): TournamentSimulation {
  const teams = tournament.participants.slice(0, tournament.teams);
  let sim: TournamentSimulation;

  if (tournament.format === "knockout") {
    const knockout = simulateKnockout(teams);
    sim = { tournamentId: tournament.id, format: "knockout", knockout, winner: knockout.winner, placements: [] };
  } else if (tournament.format === "swiss+knockout") {
    const swiss = simulateSwiss(teams, 3, 3);
    const knockout = simulateKnockout(swiss.qualified.slice(0, 8));
    sim = { tournamentId: tournament.id, format: "swiss+knockout", swiss, knockout, winner: knockout.winner, placements: [] };
  } else if (tournament.format === "groups+knockout") {
    const groupCount = teams.length <= 8 ? 2 : teams.length <= 16 ? 4 : 4;
    const advancePerGroup = 2;
    const groups = simulateGroups(teams, groupCount, advancePerGroup);
    const advancedTeams = groups.flatMap((g) => g.qualified);
    const knockout = simulateKnockout(advancedTeams);
    sim = { tournamentId: tournament.id, format: "groups+knockout", groups, knockout, winner: knockout.winner, placements: [] };
  } else if (tournament.format === "major") {
    const allTeams = shuffle(teams);
    const challengerTeams = allTeams.slice(8, 24).length >= 16 ? allTeams.slice(8, 24) : allTeams.slice(Math.max(0, allTeams.length - 16));
    const stage1Swiss = simulateSwiss(challengerTeams.slice(0, 16), 3, 3);
    const legendTeams = [...allTeams.slice(0, 8), ...stage1Swiss.qualified.slice(0, 8)];
    const stage2Swiss = simulateSwiss(legendTeams, 3, 3);
    const playoffTeams = stage2Swiss.qualified.slice(0, 8);
    const playoffs = simulateKnockout(playoffTeams, 3);

    const majorStages: MajorStage[] = [
      { name: "Stage 1: Challengers", type: "swiss", swiss: stage1Swiss, participants: challengerTeams.slice(0, 16) },
      { name: "Stage 2: Legends", type: "swiss", swiss: stage2Swiss, participants: legendTeams },
      { name: "Stage 3: Champions (Playoffs)", type: "knockout", knockout: playoffs, participants: playoffTeams },
    ];

    sim = { tournamentId: tournament.id, format: "major", majorStages, winner: playoffs.winner, placements: [] };
  } else {
    const knockout = simulateKnockout(teams);
    sim = { tournamentId: tournament.id, format: "knockout", knockout, winner: knockout.winner, placements: [] };
  }

  sim.placements = derivePlacements(sim, tournament);
  return sim;
}

// ===== Team Pools =====
const tierSTeams = ["Vitality", "G2", "NAVI", "FaZe", "Spirit", "MOUZ", "Cloud9", "Astralis", "Heroic", "Liquid", "Complexity", "ENCE"];
const tierATeams = ["BIG", "Eternal Fire", "FURIA", "paiN", "Apeks", "GamerLegion", "Monte", "SAW", "9INE", "OG", "Into The Breach", "Imperial"];
const tierBTeams = ["Rare Atom", "Lynn Vision", "TheMongolz", "Grayhound", "Rooster", "TYLOO", "FlyQuest", "Nouns", "BOSS", "KOI", "Falcons", "Permitta"];
const tierCTeams = ["Sampi", "Passion UA", "ECSTATIC", "Zero Tenacity", "Sprout", "ex-Enterprise", "ALTERNATE aTTaX", "Endpoint", "Nexus", "forZe", "Insilio", "Aurora"];

// ===== Tournament Data — Full 2026 Season =====
export const initialTournaments: Tournament[] = [
  // JANUARY
  { id: "1", name: "BLAST Premier Spring Groups", organizer: "BLAST", prizePool: "$300,000", startDate: "2026-01-05", endDate: "2026-01-18", status: "upcoming", teams: 12, location: "Copenhagen, Denmark", tier: "S", participants: [...tierSTeams], description: "Season opener — 12 top teams in groups.", format: "groups+knockout", formatDetails: "3 grupy po 4 → playoffs (top 2 z grupy)" },
  { id: "2", name: "IEM Cologne Qualifier", organizer: "ESL", prizePool: "$50,000", startDate: "2026-01-10", endDate: "2026-01-14", status: "upcoming", teams: 16, location: "Online", tier: "B", participants: [...tierBTeams.slice(0, 8), ...tierCTeams.slice(0, 8)], description: "Open qualifier for IEM Cologne.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "3", name: "CCT Season 4 Europe", organizer: "CCT", prizePool: "$75,000", startDate: "2026-01-15", endDate: "2026-01-22", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(0, 8), description: "Regional EU circuit for rising teams.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "4", name: "ESL Challenger League S1", organizer: "ESL", prizePool: "$100,000", startDate: "2026-01-20", endDate: "2026-02-01", status: "upcoming", teams: 16, location: "Online", tier: "B", participants: [...tierBTeams], description: "Challenger league — promotion to Pro League.", format: "swiss+knockout", formatDetails: "Swiss BO1/BO3 → top 8 playoffs" },
  { id: "j5", name: "Pinnacle Cup #1", organizer: "Pinnacle", prizePool: "$20,000", startDate: "2026-01-25", endDate: "2026-01-28", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(4, 12), description: "Monthly Pinnacle cup.", format: "knockout", formatDetails: "Single elimination BO3" },

  // FEBRUARY
  { id: "5", name: "IEM Katowice 2026", organizer: "ESL", prizePool: "$1,000,000", startDate: "2026-02-03", endDate: "2026-02-16", status: "upcoming", teams: 16, location: "Katowice, Poland", tier: "S", participants: [...tierSTeams, ...tierATeams.slice(0, 4)], description: "Legendary venue, $1M on the line.", format: "swiss+knockout", formatDetails: "Swiss (16 drużyn) → top 8 playoffs BO3/BO5" },
  { id: "6", name: "FACEIT League Season 1", organizer: "FACEIT", prizePool: "$250,000", startDate: "2026-02-10", endDate: "2026-02-22", status: "upcoming", teams: 16, location: "Online", tier: "A", participants: [...tierATeams.slice(0, 8), ...tierBTeams.slice(0, 8)], description: "Online league with LAN finals spot.", format: "groups+knockout", formatDetails: "4 grupy po 4 → playoffs (top 2)" },
  { id: "7", name: "YaLLa Compass Dubai", organizer: "YaLLa", prizePool: "$40,000", startDate: "2026-02-14", endDate: "2026-02-18", status: "upcoming", teams: 8, location: "Dubai, UAE", tier: "C", participants: tierCTeams.slice(2, 10), description: "Middle East showcase.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "8", name: "Thunderpick WC Qualifier", organizer: "Thunderpick", prizePool: "$30,000", startDate: "2026-02-20", endDate: "2026-02-24", status: "upcoming", teams: 8, location: "Online", tier: "B", participants: tierBTeams.slice(0, 8), description: "Last chance qualifier.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "f1", name: "RES Regional Series EU #1", organizer: "RES", prizePool: "$15,000", startDate: "2026-02-25", endDate: "2026-02-28", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(0, 8), description: "EU regional series.", format: "knockout", formatDetails: "Single elimination BO3" },

  // MARCH
  { id: "9", name: "ESL Pro League Season 23", organizer: "ESL", prizePool: "$850,000", startDate: "2026-03-02", endDate: "2026-03-22", status: "upcoming", teams: 24, location: "Malta", tier: "S", participants: [...tierSTeams, ...tierATeams], description: "24 teams, $850K prize pool.", format: "groups+knockout", formatDetails: "4 grupy po 6 (BO1 round-robin) → top 2 playoffs BO3/BO5" },
  { id: "10", name: "CCT Season 4 Finals", organizer: "CCT", prizePool: "$150,000", startDate: "2026-03-08", endDate: "2026-03-14", status: "upcoming", teams: 8, location: "Online", tier: "B", participants: tierBTeams.slice(0, 8), description: "CCT circuit finals.", format: "knockout", formatDetails: "Single elimination BO3, finał BO5" },
  { id: "11", name: "Elisa Masters Espoo", organizer: "Elisa", prizePool: "$200,000", startDate: "2026-03-15", endDate: "2026-03-20", status: "upcoming", teams: 8, location: "Espoo, Finland", tier: "A", participants: tierATeams.slice(0, 8), description: "Nordic tournament.", format: "groups+knockout", formatDetails: "2 grupy po 4 → playoffs" },
  { id: "12", name: "ESEA Advanced S48", organizer: "ESEA", prizePool: "$25,000", startDate: "2026-03-18", endDate: "2026-03-28", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(0, 8), description: "ESEA for semi-pro teams.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "m1", name: "Pinnacle Cup #2", organizer: "Pinnacle", prizePool: "$20,000", startDate: "2026-03-25", endDate: "2026-03-28", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(2, 10), description: "Monthly cup.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "m2", name: "Skyesports Championship", organizer: "Skyesports", prizePool: "$60,000", startDate: "2026-03-28", endDate: "2026-03-31", status: "upcoming", teams: 8, location: "Mumbai, India", tier: "B", participants: [...tierBTeams.slice(4, 12)], description: "Asian CS showcase.", format: "knockout", formatDetails: "Single elimination BO3" },

  // APRIL
  { id: "13", name: "BLAST Premier Spring Finals", organizer: "BLAST", prizePool: "$425,000", startDate: "2026-04-01", endDate: "2026-04-06", status: "upcoming", teams: 8, location: "Copenhagen, Denmark", tier: "S", participants: tierSTeams.slice(0, 8), description: "Top 8 clash for the title.", format: "knockout", formatDetails: "Single elimination BO3, Grand Final BO5" },
  { id: "14", name: "BetBoom Dacha Belgrade", organizer: "BetBoom", prizePool: "$200,000", startDate: "2026-04-08", endDate: "2026-04-14", status: "upcoming", teams: 12, location: "Belgrade, Serbia", tier: "A", participants: tierATeams, description: "CIS-flavored tournament.", format: "groups+knockout", formatDetails: "3 grupy po 4 → top 2 playoffs" },
  { id: "15", name: "GamerLegion Invitational", organizer: "GamerLegion", prizePool: "$50,000", startDate: "2026-04-10", endDate: "2026-04-15", status: "upcoming", teams: 8, location: "Berlin, Germany", tier: "B", participants: tierBTeams.slice(0, 8), description: "Rising European teams.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "16", name: "LOOT.BET Season 8", organizer: "LOOT.BET", prizePool: "$15,000", startDate: "2026-04-12", endDate: "2026-04-18", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(0, 8), description: "Online league for lower-ranked teams.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "17", name: "IEM Dallas 2026", organizer: "ESL", prizePool: "$500,000", startDate: "2026-04-20", endDate: "2026-04-28", status: "upcoming", teams: 16, location: "Dallas, USA", tier: "S", participants: [...tierSTeams.slice(0, 12), ...tierATeams.slice(0, 4)], description: "North American IEM stop.", format: "swiss+knockout", formatDetails: "Swiss → top 8 playoffs BO3/BO5" },
  { id: "a1", name: "Dust2.dk Masters", organizer: "Dust2.dk", prizePool: "$35,000", startDate: "2026-04-25", endDate: "2026-04-28", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(0, 8), description: "Danish org cup.", format: "knockout", formatDetails: "Single elimination BO3" },

  // MAY — MAJOR
  { id: "18", name: "PGL Major Antwerp", organizer: "PGL", prizePool: "$1,250,000", startDate: "2026-05-05", endDate: "2026-05-25", status: "upcoming", teams: 24, location: "Antwerp, Belgium", tier: "S", participants: [...tierSTeams, ...tierATeams.slice(0, 12)], description: "THE MAJOR — $1.25M. Challengers → Legends → Champions.", format: "major", formatDetails: "Stage 1: Challengers (Swiss 16→8) • Stage 2: Legends (Swiss 16→8) • Stage 3: Champions Playoffs (8-team knockout BO3/BO5)" },
  { id: "ma1", name: "RMR Europe A", organizer: "PGL", prizePool: "$75,000", startDate: "2026-05-01", endDate: "2026-05-03", status: "upcoming", teams: 16, location: "Online", tier: "A", participants: [...tierATeams.slice(0, 8), ...tierBTeams.slice(0, 8)], description: "European RMR for Major qualification.", format: "swiss+knockout", formatDetails: "Swiss → top 8" },
  { id: "ma2", name: "RMR Americas", organizer: "PGL", prizePool: "$50,000", startDate: "2026-05-01", endDate: "2026-05-03", status: "upcoming", teams: 8, location: "Online", tier: "B", participants: tierBTeams.slice(0, 8), description: "Americas RMR.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "19", name: "Thunderpick World Championship", organizer: "Thunderpick", prizePool: "$1,000,000", startDate: "2026-05-28", endDate: "2026-06-08", status: "upcoming", teams: 16, location: "Istanbul, Turkey", tier: "S", participants: [...tierSTeams.slice(0, 10), ...tierATeams.slice(0, 6)], description: "$1M championship.", format: "swiss+knockout", formatDetails: "Swiss → top 8 playoffs" },

  // JUNE
  { id: "20", name: "BLAST Premier Spring Showdown", organizer: "BLAST", prizePool: "$162,500", startDate: "2026-06-08", endDate: "2026-06-14", status: "upcoming", teams: 8, location: "Online", tier: "A", participants: tierATeams.slice(0, 8), description: "BLAST showdown.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "21", name: "FACEIT League Season 2", organizer: "FACEIT", prizePool: "$250,000", startDate: "2026-06-15", endDate: "2026-06-28", status: "upcoming", teams: 16, location: "Online", tier: "A", participants: [...tierATeams.slice(0, 8), ...tierBTeams.slice(0, 8)], description: "Second FACEIT League season.", format: "groups+knockout", formatDetails: "4 grupy po 4 → playoffs" },
  { id: "22", name: "WePlay Academy League S7", organizer: "WePlay", prizePool: "$30,000", startDate: "2026-06-10", endDate: "2026-06-20", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(4, 12), description: "Academy-level competition.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "23", name: "ESL Challenger League S2", organizer: "ESL", prizePool: "$100,000", startDate: "2026-06-20", endDate: "2026-07-05", status: "upcoming", teams: 16, location: "Online", tier: "B", participants: tierBTeams, description: "Challenger League season 2.", format: "swiss+knockout", formatDetails: "Swiss → top 8 playoffs" },
  { id: "j1", name: "CCT South America", organizer: "CCT", prizePool: "$45,000", startDate: "2026-06-22", endDate: "2026-06-26", status: "upcoming", teams: 8, location: "São Paulo, Brazil", tier: "C", participants: tierCTeams.slice(0, 8), description: "South American circuit.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "j2", name: "Pinnacle Cup #3", organizer: "Pinnacle", prizePool: "$20,000", startDate: "2026-06-28", endDate: "2026-06-30", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(2, 10), description: "Monthly cup.", format: "knockout", formatDetails: "Single elimination BO3" },

  // JULY
  { id: "24", name: "IEM Cologne 2026", organizer: "ESL", prizePool: "$1,000,000", startDate: "2026-07-06", endDate: "2026-07-20", status: "upcoming", teams: 16, location: "Cologne, Germany", tier: "S", participants: [...tierSTeams, ...tierATeams.slice(0, 4)], description: "Cathedral of CS — $1M.", format: "swiss+knockout", formatDetails: "Swiss (16) → top 8 playoffs BO3/BO5" },
  { id: "jl1", name: "Roobet Cup", organizer: "Roobet", prizePool: "$250,000", startDate: "2026-07-10", endDate: "2026-07-16", status: "upcoming", teams: 8, location: "Online", tier: "A", participants: tierATeams.slice(0, 8), description: "High-stakes online cup.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "jl2", name: "Gamers8 Riyadh", organizer: "Saudi Esports", prizePool: "$400,000", startDate: "2026-07-20", endDate: "2026-07-28", status: "upcoming", teams: 12, location: "Riyadh, Saudi Arabia", tier: "A", participants: [...tierATeams.slice(0, 6), ...tierSTeams.slice(6, 12)], description: "Saudi esports festival.", format: "groups+knockout", formatDetails: "3 grupy po 4 → playoffs" },
  { id: "jl3", name: "CCT North Europe", organizer: "CCT", prizePool: "$30,000", startDate: "2026-07-22", endDate: "2026-07-26", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(0, 8), description: "Nordic regional.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "jl4", name: "DreamHack Open Valencia", organizer: "DreamHack", prizePool: "$60,000", startDate: "2026-07-28", endDate: "2026-07-31", status: "upcoming", teams: 8, location: "Valencia, Spain", tier: "B", participants: tierBTeams.slice(0, 8), description: "DreamHack LAN.", format: "knockout", formatDetails: "Single elimination BO3" },

  // AUGUST
  { id: "25", name: "BLAST Premier Fall Groups", organizer: "BLAST", prizePool: "$300,000", startDate: "2026-08-01", endDate: "2026-08-14", status: "upcoming", teams: 12, location: "Copenhagen, Denmark", tier: "S", participants: tierSTeams, description: "Fall season begins.", format: "groups+knockout", formatDetails: "3 grupy po 4 → playoffs" },
  { id: "au1", name: "ESL Challenger League S3", organizer: "ESL", prizePool: "$100,000", startDate: "2026-08-05", endDate: "2026-08-18", status: "upcoming", teams: 16, location: "Online", tier: "B", participants: [...tierBTeams, ...tierCTeams.slice(0, 4)], description: "Challenger League season 3.", format: "swiss+knockout", formatDetails: "Swiss → top 8 playoffs" },
  { id: "au2", name: "FACEIT League Season 3", organizer: "FACEIT", prizePool: "$250,000", startDate: "2026-08-10", endDate: "2026-08-22", status: "upcoming", teams: 16, location: "Online", tier: "A", participants: [...tierATeams.slice(0, 8), ...tierBTeams.slice(0, 8)], description: "Third FACEIT League.", format: "groups+knockout", formatDetails: "4 grupy po 4 → playoffs" },
  { id: "au3", name: "WePlay Academy League S8", organizer: "WePlay", prizePool: "$30,000", startDate: "2026-08-15", endDate: "2026-08-22", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(0, 8), description: "Academy League.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "au4", name: "Pinnacle Cup #4", organizer: "Pinnacle", prizePool: "$20,000", startDate: "2026-08-25", endDate: "2026-08-28", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(4, 12), description: "Monthly cup.", format: "knockout", formatDetails: "Single elimination BO3" },

  // SEPTEMBER
  { id: "26", name: "ESL Pro League Season 24", organizer: "ESL", prizePool: "$850,000", startDate: "2026-09-01", endDate: "2026-09-22", status: "upcoming", teams: 24, location: "Malta", tier: "S", participants: [...tierSTeams, ...tierATeams], description: "Season 24.", format: "groups+knockout", formatDetails: "4 grupy po 6 → top 2 playoffs" },
  { id: "s1", name: "BetBoom Dacha Moscow", organizer: "BetBoom", prizePool: "$150,000", startDate: "2026-09-08", endDate: "2026-09-14", status: "upcoming", teams: 8, location: "Moscow, Russia", tier: "A", participants: tierATeams.slice(0, 8), description: "CIS autumn event.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "s2", name: "DreamHack Open Atlanta", organizer: "DreamHack", prizePool: "$75,000", startDate: "2026-09-18", endDate: "2026-09-22", status: "upcoming", teams: 8, location: "Atlanta, USA", tier: "B", participants: tierBTeams.slice(0, 8), description: "DreamHack NA stop.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "s3", name: "ESEA Advanced S49", organizer: "ESEA", prizePool: "$25,000", startDate: "2026-09-20", endDate: "2026-09-28", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(0, 8), description: "ESEA Advanced.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "s4", name: "CCT Season 5 Europe", organizer: "CCT", prizePool: "$60,000", startDate: "2026-09-25", endDate: "2026-09-30", status: "upcoming", teams: 8, location: "Online", tier: "B", participants: tierBTeams.slice(4, 12), description: "CCT circuit.", format: "knockout", formatDetails: "Single elimination BO3" },

  // OCTOBER
  { id: "27", name: "BLAST Premier World Final", organizer: "BLAST", prizePool: "$1,000,000", startDate: "2026-10-15", endDate: "2026-10-27", status: "upcoming", teams: 8, location: "Abu Dhabi, UAE", tier: "S", participants: tierSTeams.slice(0, 8), description: "BLAST World Final — best of the best.", format: "knockout", formatDetails: "Single elimination BO3, Grand Final BO5" },
  { id: "o1", name: "RMR Europe B", organizer: "PGL", prizePool: "$75,000", startDate: "2026-10-01", endDate: "2026-10-05", status: "upcoming", teams: 16, location: "Online", tier: "A", participants: [...tierATeams.slice(0, 8), ...tierBTeams.slice(0, 8)], description: "Second European RMR.", format: "swiss+knockout", formatDetails: "Swiss → top 8" },
  { id: "o2", name: "RMR Asia", organizer: "PGL", prizePool: "$40,000", startDate: "2026-10-01", endDate: "2026-10-04", status: "upcoming", teams: 8, location: "Shanghai, China", tier: "B", participants: tierBTeams.slice(0, 8), description: "Asian RMR.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "o3", name: "Elisa Masters Helsinki", organizer: "Elisa", prizePool: "$200,000", startDate: "2026-10-08", endDate: "2026-10-14", status: "upcoming", teams: 8, location: "Helsinki, Finland", tier: "A", participants: tierATeams.slice(0, 8), description: "Nordic LAN event.", format: "groups+knockout", formatDetails: "2 grupy po 4 → playoffs" },
  { id: "o4", name: "Pinnacle Cup #5", organizer: "Pinnacle", prizePool: "$20,000", startDate: "2026-10-20", endDate: "2026-10-23", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(0, 8), description: "Monthly cup.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "o5", name: "BLAST Premier Fall Showdown", organizer: "BLAST", prizePool: "$162,500", startDate: "2026-10-28", endDate: "2026-10-31", status: "upcoming", teams: 8, location: "Online", tier: "A", participants: tierATeams.slice(0, 8), description: "BLAST fall showdown.", format: "knockout", formatDetails: "Single elimination BO3" },

  // NOVEMBER — FALL MAJOR
  { id: "28", name: "PGL Major Copenhagen", organizer: "PGL", prizePool: "$1,250,000", startDate: "2026-11-03", endDate: "2026-11-24", status: "upcoming", teams: 24, location: "Copenhagen, Denmark", tier: "S", participants: [...tierSTeams, ...tierATeams.slice(0, 12)], description: "Fall Major — $1.25M.", format: "major", formatDetails: "Challengers Swiss → Legends Swiss → Champions Playoffs" },
  { id: "n1", name: "DreamHack Open Winter", organizer: "DreamHack", prizePool: "$100,000", startDate: "2026-11-10", endDate: "2026-11-14", status: "upcoming", teams: 8, location: "Jönköping, Sweden", tier: "B", participants: tierBTeams.slice(0, 8), description: "DreamHack classic event.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "n2", name: "LOOT.BET Season 9", organizer: "LOOT.BET", prizePool: "$15,000", startDate: "2026-11-15", endDate: "2026-11-20", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(0, 8), description: "Online league.", format: "knockout", formatDetails: "Single elimination BO3" },

  // DECEMBER
  { id: "d1", name: "BLAST Premier Fall Finals", organizer: "BLAST", prizePool: "$425,000", startDate: "2026-12-01", endDate: "2026-12-06", status: "upcoming", teams: 8, location: "Copenhagen, Denmark", tier: "S", participants: tierSTeams.slice(0, 8), description: "BLAST Fall Finals.", format: "knockout", formatDetails: "Single elimination BO3, Grand Final BO5" },
  { id: "d2", name: "IEM Chengdu", organizer: "ESL", prizePool: "$500,000", startDate: "2026-12-08", endDate: "2026-12-15", status: "upcoming", teams: 16, location: "Chengdu, China", tier: "S", participants: [...tierSTeams.slice(0, 10), ...tierATeams.slice(0, 6)], description: "Asian IEM stop.", format: "swiss+knockout", formatDetails: "Swiss → top 8 playoffs" },
  { id: "d3", name: "CCT Season 5 Finals", organizer: "CCT", prizePool: "$100,000", startDate: "2026-12-10", endDate: "2026-12-14", status: "upcoming", teams: 8, location: "Online", tier: "B", participants: tierBTeams.slice(0, 8), description: "CCT year-end finals.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "d4", name: "Pinnacle Cup Grand Final", organizer: "Pinnacle", prizePool: "$40,000", startDate: "2026-12-18", endDate: "2026-12-20", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(0, 8), description: "Year-end Pinnacle showdown.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "d5", name: "WePlay Invitational", organizer: "WePlay", prizePool: "$150,000", startDate: "2026-12-20", endDate: "2026-12-23", status: "upcoming", teams: 8, location: "Kyiv, Ukraine", tier: "A", participants: tierATeams.slice(0, 8), description: "Year-end exhibition.", format: "knockout", formatDetails: "Single elimination BO3" },
];

export const players: Player[] = [
  { id: "1", name: "ZywOo", realName: "Mathieu Herbaut", team: "Vitality", country: "🇫🇷", rating: 1.32, kills: 4521, deaths: 3120, maps: 287, adr: 87.3, kast: 73.2 },
  { id: "2", name: "m0NESY", realName: "Ilya Osipov", team: "G2", country: "🇷🇺", rating: 1.28, kills: 3890, deaths: 2980, maps: 245, adr: 84.1, kast: 71.8 },
  { id: "3", name: "NiKo", realName: "Nikola Kovač", team: "G2", country: "🇧🇦", rating: 1.21, kills: 5210, deaths: 3890, maps: 342, adr: 81.5, kast: 72.4 },
  { id: "4", name: "s1mple", realName: "Oleksandr Kostyliev", team: "NAVI", country: "🇺🇦", rating: 1.25, kills: 6102, deaths: 4230, maps: 420, adr: 82.9, kast: 71.1 },
  { id: "5", name: "sh1ro", realName: "Dmitry Sokolov", team: "Cloud9", country: "🇷🇺", rating: 1.19, kills: 3450, deaths: 2780, maps: 231, adr: 78.2, kast: 70.9 },
  { id: "6", name: "donk", realName: "Danil Kryshkovets", team: "Spirit", country: "🇷🇺", rating: 1.27, kills: 2890, deaths: 2140, maps: 189, adr: 86.7, kast: 74.1 },
  { id: "7", name: "ropz", realName: "Robin Kool", team: "FaZe", country: "🇪🇪", rating: 1.16, kills: 4102, deaths: 3340, maps: 298, adr: 77.8, kast: 73.5 },
  { id: "8", name: "device", realName: "Nicolai Reedtz", team: "Astralis", country: "🇩🇰", rating: 1.14, kills: 5890, deaths: 4520, maps: 401, adr: 76.4, kast: 72.8 },
  { id: "9", name: "frozen", realName: "David Čerňanský", team: "MOUZ", country: "🇸🇰", rating: 1.17, kills: 3210, deaths: 2690, maps: 220, adr: 79.1, kast: 70.2 },
  { id: "10", name: "broky", realName: "Helvijs Saukants", team: "FaZe", country: "🇱🇻", rating: 1.13, kills: 3780, deaths: 3120, maps: 267, adr: 75.9, kast: 71.6 },
  { id: "11", name: "jL", realName: "Justinas Lekavicius", team: "Spirit", country: "🇱🇹", rating: 1.15, kills: 2450, deaths: 2100, maps: 168, adr: 78.5, kast: 69.8 },
  { id: "12", name: "xertioN", realName: "Dorian Berman", team: "BIG", country: "🇩🇪", rating: 1.12, kills: 1890, deaths: 1650, maps: 132, adr: 76.2, kast: 68.4 },
  { id: "13", name: "w0nderful", realName: "Andrii Holiian", team: "NAVI", country: "🇺🇦", rating: 1.11, kills: 2100, deaths: 1870, maps: 150, adr: 75.8, kast: 70.1 },
  { id: "14", name: "Jimpphat", realName: "Jimi Salo", team: "MOUZ", country: "🇫🇮", rating: 1.10, kills: 1980, deaths: 1790, maps: 140, adr: 74.3, kast: 69.5 },
  { id: "15", name: "Calyx", realName: "Buğra Arkın", team: "Eternal Fire", country: "🇹🇷", rating: 1.09, kills: 2340, deaths: 2150, maps: 175, adr: 73.7, kast: 68.9 },
];

export const calendarEvents: CalendarEvent[] = [
  { id: "1", title: "BLAST Premier Spring Groups", date: "2026-01-05", type: "tournament-start", description: "Season opener" },
  { id: "2", title: "IEM Katowice 2026", date: "2026-02-03", type: "tournament-start", description: "$1M prize pool" },
  { id: "3", title: "ESL Pro League S23", date: "2026-03-02", type: "tournament-start", description: "24 teams in Malta" },
  { id: "4", title: "BLAST Premier Spring Finals", date: "2026-04-01", type: "tournament-start", description: "Top 8 in Copenhagen" },
  { id: "5", title: "IEM Dallas 2026", date: "2026-04-20", type: "tournament-start", description: "16 teams in Dallas" },
  { id: "6", title: "PGL Major Antwerp", date: "2026-05-05", type: "tournament-start", description: "THE MAJOR — $1.25M" },
  { id: "7", title: "IEM Cologne 2026", date: "2026-07-06", type: "tournament-start", description: "Cathedral of CS" },
  { id: "8", title: "BLAST Premier Fall Groups", date: "2026-08-01", type: "tournament-start", description: "Fall season begins" },
  { id: "9", title: "PGL Major Copenhagen", date: "2026-11-03", type: "tournament-start", description: "Fall Major — $1.25M" },
  { id: "10", title: "BLAST Premier Fall Finals", date: "2026-12-01", type: "tournament-start", description: "Fall Finals" },
  { id: "11", title: "IEM Chengdu", date: "2026-12-08", type: "tournament-start", description: "Asian IEM stop" },
];
