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
}

// ===== Simulation Logic =====

function simulateMatch(team1: string, team2: string, bo: number): MatchResult {
  // Simple random with slight home advantage for first-listed team
  const winsNeeded = Math.ceil(bo / 2);
  let s1 = 0, s2 = 0;
  while (s1 < winsNeeded && s2 < winsNeeded) {
    if (Math.random() < 0.52) s1++;
    else s2++;
  }
  return {
    team1, team2,
    score1: s1, score2: s2,
    winner: s1 > s2 ? team1 : team2,
    bo,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Swiss system: teams play until they reach 3 wins (qualified) or 3 losses (eliminated)
export function simulateSwiss(teams: string[], winsToQualify = 3, lossesToEliminate = 3): SwissResult {
  const standings: SwissStanding[] = teams.map((t) => ({
    team: t, wins: 0, losses: 0, qualified: false, eliminated: false,
  }));
  const rounds: SwissRound[] = [];

  for (let roundNum = 1; roundNum <= winsToQualify + lossesToEliminate - 1; roundNum++) {
    const active = standings.filter((s) => !s.qualified && !s.eliminated);
    if (active.length < 2) break;

    // Group by W-L record and pair within groups
    const byRecord: Record<string, SwissStanding[]> = {};
    active.forEach((s) => {
      const key = `${s.wins}-${s.losses}`;
      if (!byRecord[key]) byRecord[key] = [];
      byRecord[key].push(s);
    });

    const matches: MatchResult[] = [];
    const paired = new Set<string>();

    // Sort records by wins desc
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

        // BO1 for early rounds, BO3 for elimination/qualification matches
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

    // Check if done
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

// Group stage
export function simulateGroups(teams: string[], groupCount: number, advancePerGroup: number): GroupResult[] {
  const shuffled = shuffle(teams);
  const perGroup = Math.ceil(shuffled.length / groupCount);
  const groups: GroupResult[] = [];

  for (let g = 0; g < groupCount; g++) {
    const groupTeams = shuffled.slice(g * perGroup, (g + 1) * perGroup);
    const groupName = String.fromCharCode(65 + g); // A, B, C...
    const matches: MatchResult[] = [];

    // Round-robin BO1
    for (let i = 0; i < groupTeams.length; i++) {
      for (let j = i + 1; j < groupTeams.length; j++) {
        matches.push(simulateMatch(groupTeams[i], groupTeams[j], 1));
      }
    }

    // Calculate standings
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

// Single-elimination knockout
export function simulateKnockout(teams: string[], startBo = 3): KnockoutResult {
  const rounds: KnockoutRound[] = [];
  let currentTeams = [...teams];

  // Pad to power of 2
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

// Full tournament simulation
export function simulateTournament(tournament: Tournament): TournamentSimulation {
  const teams = tournament.participants.slice(0, tournament.teams);

  if (tournament.format === "knockout") {
    const knockout = simulateKnockout(teams);
    return { tournamentId: tournament.id, format: "knockout", knockout, winner: knockout.winner };
  }

  if (tournament.format === "swiss+knockout") {
    const swiss = simulateSwiss(teams, 3, 3);
    const knockout = simulateKnockout(swiss.qualified.slice(0, 8));
    return { tournamentId: tournament.id, format: "swiss+knockout", swiss, knockout, winner: knockout.winner };
  }

  if (tournament.format === "groups+knockout") {
    const groupCount = teams.length <= 8 ? 2 : teams.length <= 16 ? 4 : 4;
    const advancePerGroup = 2;
    const groups = simulateGroups(teams, groupCount, advancePerGroup);
    const advancedTeams = groups.flatMap((g) => g.qualified);
    const knockout = simulateKnockout(advancedTeams);
    return { tournamentId: tournament.id, format: "groups+knockout", groups, knockout, winner: knockout.winner };
  }

  if (tournament.format === "major") {
    // Major: Stage 1 (Challengers Swiss 16→8), Stage 2 (Legends Swiss 16→8), Stage 3 (Champions Swiss 16→8), Playoffs (8-team knockout)
    const allTeams = shuffle(teams);

    // Stage 1: Challengers - bottom 16 teams
    const challengerTeams = allTeams.slice(8, 24).length >= 16 ? allTeams.slice(8, 24) : allTeams.slice(Math.max(0, allTeams.length - 16));
    const stage1Swiss = simulateSwiss(challengerTeams.slice(0, 16), 3, 3);

    // Stage 2: Legends - top 8 + 8 qualified from Challengers
    const legendTeams = [...allTeams.slice(0, 8), ...stage1Swiss.qualified.slice(0, 8)];
    const stage2Swiss = simulateSwiss(legendTeams, 3, 3);

    // Stage 3: Champions - 8 advancing from Legends
    // In real Majors it's just playoffs at this point, but we can do a final Swiss if there are enough teams
    // Actually, the standard Major format is: Challengers Swiss → Legends Swiss → Champions (Playoffs knockout)
    const playoffTeams = stage2Swiss.qualified.slice(0, 8);
    const playoffs = simulateKnockout(playoffTeams, 3);

    const majorStages: MajorStage[] = [
      {
        name: "Stage 1: Challengers",
        type: "swiss",
        swiss: stage1Swiss,
        participants: challengerTeams.slice(0, 16),
      },
      {
        name: "Stage 2: Legends",
        type: "swiss",
        swiss: stage2Swiss,
        participants: legendTeams,
      },
      {
        name: "Stage 3: Champions (Playoffs)",
        type: "knockout",
        knockout: playoffs,
        participants: playoffTeams,
      },
    ];

    return { tournamentId: tournament.id, format: "major", majorStages, winner: playoffs.winner };
  }

  // Fallback
  const knockout = simulateKnockout(teams);
  return { tournamentId: tournament.id, format: "knockout", knockout, winner: knockout.winner };
}

// ===== Team Pools =====
const tierSTeams = ["Vitality", "G2", "NAVI", "FaZe", "Spirit", "MOUZ", "Cloud9", "Astralis", "Heroic", "Liquid", "Complexity", "ENCE"];
const tierATeams = ["BIG", "Eternal Fire", "FURIA", "paiN", "Apeks", "GamerLegion", "Monte", "SAW", "9INE", "OG", "Into The Breach", "Imperial"];
const tierBTeams = ["Rare Atom", "Lynn Vision", "TheMongolz", "Grayhound", "Rooster", "TYLOO", "FlyQuest", "Nouns", "BOSS", "KOI", "Falcons", "Permitta"];
const tierCTeams = ["Sampi", "Passion UA", "ECSTATIC", "Zero Tenacity", "Sprout", "ex-Enterprise", "ALTERNATE aTTaX", "Endpoint", "Nexus", "forZe", "Insilio", "Aurora"];

// ===== Tournament Data =====
export const initialTournaments: Tournament[] = [
  // JANUARY
  { id: "1", name: "BLAST Premier Spring Groups", organizer: "BLAST", prizePool: "$300,000", startDate: "2026-01-05", endDate: "2026-01-18", status: "upcoming", teams: 12, location: "Copenhagen, Denmark", tier: "S", participants: [...tierSTeams], description: "Season opener — 12 top teams in groups.", format: "groups+knockout", formatDetails: "3 grupy po 4 → playoffs (top 2 z grupy)" },
  { id: "2", name: "IEM Cologne Qualifier", organizer: "ESL", prizePool: "$50,000", startDate: "2026-01-10", endDate: "2026-01-14", status: "upcoming", teams: 16, location: "Online", tier: "B", participants: [...tierBTeams.slice(0, 8), ...tierCTeams.slice(0, 8)], description: "Open qualifier for IEM Cologne.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "3", name: "CCT Season 4 Europe", organizer: "CCT", prizePool: "$75,000", startDate: "2026-01-15", endDate: "2026-01-22", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(0, 8), description: "Regional EU circuit for rising teams.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "4", name: "ESL Challenger League S1", organizer: "ESL", prizePool: "$100,000", startDate: "2026-01-20", endDate: "2026-02-01", status: "upcoming", teams: 16, location: "Online", tier: "B", participants: [...tierBTeams], description: "Challenger league — promotion to Pro League.", format: "swiss+knockout", formatDetails: "Swiss BO1/BO3 → top 8 playoffs" },

  // FEBRUARY
  { id: "5", name: "IEM Katowice 2026", organizer: "ESL", prizePool: "$1,000,000", startDate: "2026-02-03", endDate: "2026-02-16", status: "upcoming", teams: 16, location: "Katowice, Poland", tier: "S", participants: [...tierSTeams, ...tierATeams.slice(0, 4)], description: "Legendary venue, $1M on the line.", format: "swiss+knockout", formatDetails: "Swiss (16 drużyn) → top 8 playoffs BO3/BO5" },
  { id: "6", name: "FACEIT League Season 1", organizer: "FACEIT", prizePool: "$250,000", startDate: "2026-02-10", endDate: "2026-02-22", status: "upcoming", teams: 16, location: "Online", tier: "A", participants: [...tierATeams.slice(0, 8), ...tierBTeams.slice(0, 8)], description: "Online league with LAN finals spot.", format: "groups+knockout", formatDetails: "4 grupy po 4 → playoffs (top 2)" },
  { id: "7", name: "YaLLa Compass Dubai", organizer: "YaLLa", prizePool: "$40,000", startDate: "2026-02-14", endDate: "2026-02-18", status: "upcoming", teams: 8, location: "Dubai, UAE", tier: "C", participants: tierCTeams.slice(2, 10), description: "Middle East showcase.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "8", name: "Thunderpick WC Qualifier", organizer: "Thunderpick", prizePool: "$30,000", startDate: "2026-02-20", endDate: "2026-02-24", status: "upcoming", teams: 8, location: "Online", tier: "B", participants: tierBTeams.slice(0, 8), description: "Last chance qualifier.", format: "knockout", formatDetails: "Single elimination BO3" },

  // MARCH
  { id: "9", name: "ESL Pro League Season 23", organizer: "ESL", prizePool: "$850,000", startDate: "2026-03-02", endDate: "2026-03-22", status: "upcoming", teams: 24, location: "Malta", tier: "S", participants: [...tierSTeams, ...tierATeams], description: "24 teams, $850K prize pool.", format: "groups+knockout", formatDetails: "4 grupy po 6 (BO1 round-robin) → top 2 playoffs BO3/BO5" },
  { id: "10", name: "CCT Season 4 Finals", organizer: "CCT", prizePool: "$150,000", startDate: "2026-03-08", endDate: "2026-03-14", status: "upcoming", teams: 8, location: "Online", tier: "B", participants: tierBTeams.slice(0, 8), description: "CCT circuit finals.", format: "knockout", formatDetails: "Single elimination BO3, finał BO5" },
  { id: "11", name: "Elisa Masters Espoo", organizer: "Elisa", prizePool: "$200,000", startDate: "2026-03-15", endDate: "2026-03-20", status: "upcoming", teams: 8, location: "Espoo, Finland", tier: "A", participants: tierATeams.slice(0, 8), description: "Nordic tournament.", format: "groups+knockout", formatDetails: "2 grupy po 4 → playoffs" },
  { id: "12", name: "ESEA Advanced S48", organizer: "ESEA", prizePool: "$25,000", startDate: "2026-03-18", endDate: "2026-03-28", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(0, 8), description: "ESEA for semi-pro teams.", format: "knockout", formatDetails: "Single elimination BO3" },

  // APRIL
  { id: "13", name: "BLAST Premier Spring Finals", organizer: "BLAST", prizePool: "$425,000", startDate: "2026-04-01", endDate: "2026-04-06", status: "upcoming", teams: 8, location: "Copenhagen, Denmark", tier: "S", participants: tierSTeams.slice(0, 8), description: "Top 8 clash for the title.", format: "knockout", formatDetails: "Single elimination BO3, Grand Final BO5" },
  { id: "14", name: "BetBoom Dacha Belgrade", organizer: "BetBoom", prizePool: "$200,000", startDate: "2026-04-08", endDate: "2026-04-14", status: "upcoming", teams: 12, location: "Belgrade, Serbia", tier: "A", participants: tierATeams, description: "CIS-flavored tournament.", format: "groups+knockout", formatDetails: "3 grupy po 4 → top 2 playoffs" },
  { id: "15", name: "GamerLegion Invitational", organizer: "GamerLegion", prizePool: "$50,000", startDate: "2026-04-10", endDate: "2026-04-15", status: "upcoming", teams: 8, location: "Berlin, Germany", tier: "B", participants: tierBTeams.slice(0, 8), description: "Rising European teams.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "16", name: "LOOT.BET Season 8", organizer: "LOOT.BET", prizePool: "$15,000", startDate: "2026-04-12", endDate: "2026-04-18", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(0, 8), description: "Online league for lower-ranked teams.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "17", name: "IEM Dallas 2026", organizer: "ESL", prizePool: "$500,000", startDate: "2026-04-20", endDate: "2026-04-28", status: "upcoming", teams: 16, location: "Dallas, USA", tier: "S", participants: [...tierSTeams.slice(0, 12), ...tierATeams.slice(0, 4)], description: "North American IEM stop.", format: "swiss+knockout", formatDetails: "Swiss → top 8 playoffs BO3/BO5" },

  // MAY — MAJOR
  { id: "18", name: "PGL Major Antwerp", organizer: "PGL", prizePool: "$1,250,000", startDate: "2026-05-05", endDate: "2026-05-25", status: "upcoming", teams: 24, location: "Antwerp, Belgium", tier: "S", participants: [...tierSTeams, ...tierATeams.slice(0, 12)], description: "THE MAJOR — $1.25M. Challengers → Legends → Champions.", format: "major", formatDetails: "Stage 1: Challengers (Swiss 16→8) • Stage 2: Legends (Swiss 16→8) • Stage 3: Champions Playoffs (8-team knockout BO3/BO5)" },
  { id: "19", name: "Thunderpick World Championship", organizer: "Thunderpick", prizePool: "$1,000,000", startDate: "2026-05-28", endDate: "2026-06-08", status: "upcoming", teams: 16, location: "Istanbul, Turkey", tier: "S", participants: [...tierSTeams.slice(0, 10), ...tierATeams.slice(0, 6)], description: "$1M championship.", format: "swiss+knockout", formatDetails: "Swiss → top 8 playoffs" },

  // JUNE
  { id: "20", name: "BLAST Premier Spring Showdown", organizer: "BLAST", prizePool: "$162,500", startDate: "2026-06-08", endDate: "2026-06-14", status: "upcoming", teams: 8, location: "Online", tier: "A", participants: tierATeams.slice(0, 8), description: "BLAST showdown.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "21", name: "FACEIT League Season 2", organizer: "FACEIT", prizePool: "$250,000", startDate: "2026-06-15", endDate: "2026-06-28", status: "upcoming", teams: 16, location: "Online", tier: "A", participants: [...tierATeams.slice(0, 8), ...tierBTeams.slice(0, 8)], description: "Second FACEIT League season.", format: "groups+knockout", formatDetails: "4 grupy po 4 → playoffs" },
  { id: "22", name: "WePlay Academy League S7", organizer: "WePlay", prizePool: "$30,000", startDate: "2026-06-10", endDate: "2026-06-20", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(4, 12), description: "Academy-level competition.", format: "knockout", formatDetails: "Single elimination BO3" },
  { id: "23", name: "ESL Challenger League S2", organizer: "ESL", prizePool: "$100,000", startDate: "2026-06-20", endDate: "2026-07-05", status: "upcoming", teams: 16, location: "Online", tier: "B", participants: tierBTeams, description: "Challenger League season 2.", format: "swiss+knockout", formatDetails: "Swiss → top 8 playoffs" },

  // JULY+
  { id: "24", name: "IEM Cologne 2026", organizer: "ESL", prizePool: "$1,000,000", startDate: "2026-07-06", endDate: "2026-07-20", status: "upcoming", teams: 16, location: "Cologne, Germany", tier: "S", participants: [...tierSTeams, ...tierATeams.slice(0, 4)], description: "Cathedral of CS — $1M.", format: "swiss+knockout", formatDetails: "Swiss (16) → top 8 playoffs BO3/BO5" },
  { id: "25", name: "BLAST Premier Fall Groups", organizer: "BLAST", prizePool: "$300,000", startDate: "2026-08-01", endDate: "2026-08-14", status: "upcoming", teams: 12, location: "Copenhagen, Denmark", tier: "S", participants: tierSTeams, description: "Fall season begins.", format: "groups+knockout", formatDetails: "3 grupy po 4 → playoffs" },
  { id: "26", name: "ESL Pro League Season 24", organizer: "ESL", prizePool: "$850,000", startDate: "2026-09-01", endDate: "2026-09-22", status: "upcoming", teams: 24, location: "Malta", tier: "S", participants: [...tierSTeams, ...tierATeams], description: "Season 24.", format: "groups+knockout", formatDetails: "4 grupy po 6 → top 2 playoffs" },

  // Second Major
  { id: "27", name: "BLAST Premier World Final", organizer: "BLAST", prizePool: "$1,000,000", startDate: "2026-10-15", endDate: "2026-10-27", status: "upcoming", teams: 8, location: "Abu Dhabi, UAE", tier: "S", participants: tierSTeams.slice(0, 8), description: "BLAST World Final — best of the best.", format: "knockout", formatDetails: "Single elimination BO3, Grand Final BO5" },
  { id: "28", name: "PGL Major Copenhagen", organizer: "PGL", prizePool: "$1,250,000", startDate: "2026-11-03", endDate: "2026-11-24", status: "upcoming", teams: 24, location: "Copenhagen, Denmark", tier: "S", participants: [...tierSTeams, ...tierATeams.slice(0, 12)], description: "Fall Major — $1.25M.", format: "major", formatDetails: "Challengers Swiss → Legends Swiss → Champions Playoffs" },
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
];
