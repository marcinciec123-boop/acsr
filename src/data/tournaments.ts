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

export interface BracketMatch {
  id: string;
  round: number;
  team1: string;
  team2: string;
  score1: number | null;
  score2: number | null;
  winner: string | null;
  matchNumber: number;
}

// Team pools by tier
const tierSTeams = ["Vitality", "G2", "NAVI", "FaZe", "Spirit", "MOUZ", "Cloud9", "Astralis", "Heroic", "Liquid", "Complexity", "ENCE"];
const tierATeams = ["BIG", "Eternal Fire", "FURIA", "paiN", "Apeks", "GamerLegion", "Monte", "SAW", "9INE", "OG", "Into The Breach", "Imperial"];
const tierBTeams = ["Rare Atom", "Lynn Vision", "TheMongolz", "Grayhound", "Rooster", "TYLOO", "FlyQuest", "Nouns", "BOSS", "KOI", "Falcons", "Permitta"];
const tierCTeams = ["Sampi", "Passion UA", "ECSTATIC", "Zero Tenacity", "Sprout", "ex-Enterprise", "ALTERNATE aTTaX", "Endpoint", "Nexus", "forZe", "Insilio", "Aurora"];

function pickTeams(pool: string[], count: number): string[] {
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// Full 2026 season starting January 1st — sequential order
export const tournaments: Tournament[] = [
  // JANUARY
  { id: "1", name: "BLAST Premier Spring Groups", organizer: "BLAST", prizePool: "$300,000", startDate: "2026-01-05", endDate: "2026-01-18", status: "completed", teams: 12, location: "Copenhagen, Denmark", tier: "S", participants: [...tierSTeams], description: "Season opener with 12 top teams battling in groups." },
  { id: "2", name: "IEM Cologne Qualifier", organizer: "ESL", prizePool: "$50,000", startDate: "2026-01-10", endDate: "2026-01-14", status: "completed", teams: 16, location: "Online", tier: "B", participants: [...tierBTeams.slice(0, 8), ...tierCTeams.slice(0, 8)], description: "Open qualifier for IEM Cologne spots." },
  { id: "3", name: "CCT Season 4 Europe", organizer: "CCT", prizePool: "$75,000", startDate: "2026-01-15", endDate: "2026-01-22", status: "completed", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(0, 8), description: "Regional European circuit for rising teams." },
  { id: "4", name: "ESL Challenger League S1", organizer: "ESL", prizePool: "$100,000", startDate: "2026-01-20", endDate: "2026-02-01", status: "completed", teams: 16, location: "Online", tier: "B", participants: [...tierBTeams], description: "Challenger league with promotion to Pro League." },

  // FEBRUARY
  { id: "5", name: "IEM Katowice 2026", organizer: "ESL", prizePool: "$1,000,000", startDate: "2026-02-03", endDate: "2026-02-16", status: "completed", teams: 24, location: "Katowice, Poland", tier: "S", participants: [...tierSTeams, ...tierATeams.slice(0, 12)], description: "Legendary venue, 24 teams, $1M on the line." },
  { id: "6", name: "FACEIT League Season 1", organizer: "FACEIT", prizePool: "$250,000", startDate: "2026-02-10", endDate: "2026-02-22", status: "completed", teams: 16, location: "Online", tier: "A", participants: [...tierATeams.slice(0, 8), ...tierBTeams.slice(0, 8)], description: "Online league with LAN finals spot." },
  { id: "7", name: "YaLLa Compass Dubai", organizer: "YaLLa", prizePool: "$40,000", startDate: "2026-02-14", endDate: "2026-02-18", status: "completed", teams: 8, location: "Dubai, UAE", tier: "C", participants: tierCTeams.slice(2, 10), description: "Middle East showcase tournament." },
  { id: "8", name: "Thunderpick World Championship Qualifier", organizer: "Thunderpick", prizePool: "$30,000", startDate: "2026-02-20", endDate: "2026-02-24", status: "completed", teams: 12, location: "Online", tier: "B", participants: tierBTeams, description: "Last chance qualifier for the World Championship." },

  // MARCH
  { id: "9", name: "ESL Pro League Season 23", organizer: "ESL", prizePool: "$850,000", startDate: "2026-03-02", endDate: "2026-03-22", status: "completed", teams: 32, location: "Malta", tier: "S", participants: [...tierSTeams, ...tierATeams, ...tierBTeams.slice(0, 8)], description: "Massive 32-team league with $850K prize pool." },
  { id: "10", name: "CCT Season 4 Finals", organizer: "CCT", prizePool: "$150,000", startDate: "2026-03-08", endDate: "2026-03-14", status: "completed", teams: 8, location: "Online", tier: "B", participants: tierBTeams.slice(0, 8), description: "CCT circuit finals." },
  { id: "11", name: "Elisa Masters Espoo", organizer: "Elisa", prizePool: "$200,000", startDate: "2026-03-15", endDate: "2026-03-20", status: "completed", teams: 8, location: "Espoo, Finland", tier: "A", participants: tierATeams.slice(0, 8), description: "Nordic tournament with top-tier production." },
  { id: "12", name: "ESEA Advanced Season 48", organizer: "ESEA", prizePool: "$25,000", startDate: "2026-03-18", endDate: "2026-03-28", status: "completed", teams: 16, location: "Online", tier: "C", participants: tierCTeams, description: "ESEA league for amateur/semi-pro teams." },

  // APRIL
  { id: "13", name: "BLAST Premier Spring Finals", organizer: "BLAST", prizePool: "$425,000", startDate: "2026-04-01", endDate: "2026-04-06", status: "live", teams: 8, location: "Copenhagen, Denmark", tier: "S", participants: tierSTeams.slice(0, 8), description: "Top 8 from Spring Groups clash for the title." },
  { id: "14", name: "BetBoom Dacha Belgrade", organizer: "BetBoom", prizePool: "$200,000", startDate: "2026-04-08", endDate: "2026-04-14", status: "upcoming", teams: 12, location: "Belgrade, Serbia", tier: "A", participants: tierATeams, description: "CIS-flavored tournament in Belgrade." },
  { id: "15", name: "GamerLegion Invitational", organizer: "GamerLegion", prizePool: "$50,000", startDate: "2026-04-10", endDate: "2026-04-15", status: "upcoming", teams: 8, location: "Berlin, Germany", tier: "B", participants: tierBTeams.slice(0, 8), description: "Invitational with rising European teams." },
  { id: "16", name: "LOOT.BET Season 8", organizer: "LOOT.BET", prizePool: "$15,000", startDate: "2026-04-12", endDate: "2026-04-18", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(0, 8), description: "Online league for lower-ranked teams." },
  { id: "17", name: "IEM Dallas 2026", organizer: "ESL", prizePool: "$500,000", startDate: "2026-04-20", endDate: "2026-04-28", status: "upcoming", teams: 16, location: "Dallas, USA", tier: "S", participants: [...tierSTeams.slice(0, 12), ...tierATeams.slice(0, 4)], description: "North American stop on the IEM circuit." },

  // MAY
  { id: "18", name: "PGL Major Antwerp - Open Qualifier", organizer: "PGL", prizePool: "$0", startDate: "2026-05-01", endDate: "2026-05-05", status: "upcoming", teams: 16, location: "Online", tier: "C", participants: [...tierCTeams, ...tierBTeams.slice(8, 12)], description: "Last chance to qualify for the Major." },
  { id: "19", name: "PGL Major Antwerp - RMR", organizer: "PGL", prizePool: "$100,000", startDate: "2026-05-08", endDate: "2026-05-14", status: "upcoming", teams: 16, location: "Antwerp, Belgium", tier: "A", participants: [...tierATeams, ...tierBTeams.slice(0, 4)], description: "Regional Major Ranking tournament." },
  { id: "20", name: "PGL Major Antwerp", organizer: "PGL", prizePool: "$1,250,000", startDate: "2026-05-18", endDate: "2026-06-01", status: "upcoming", teams: 24, location: "Antwerp, Belgium", tier: "S", participants: [...tierSTeams, ...tierATeams.slice(0, 12)], description: "The pinnacle of CS:GO. $1.25M Major." },
  { id: "21", name: "Thunderpick World Championship", organizer: "Thunderpick", prizePool: "$1,000,000", startDate: "2026-05-25", endDate: "2026-06-05", status: "upcoming", teams: 16, location: "Istanbul, Turkey", tier: "S", participants: [...tierSTeams.slice(0, 10), ...tierATeams.slice(0, 6)], description: "$1M championship in Istanbul." },

  // JUNE
  { id: "22", name: "BLAST Premier Spring Showdown", organizer: "BLAST", prizePool: "$162,500", startDate: "2026-06-08", endDate: "2026-06-14", status: "upcoming", teams: 8, location: "Online", tier: "A", participants: tierATeams.slice(0, 8), description: "BLAST showdown for remaining Spring spots." },
  { id: "23", name: "FACEIT League Season 2", organizer: "FACEIT", prizePool: "$250,000", startDate: "2026-06-15", endDate: "2026-06-28", status: "upcoming", teams: 16, location: "Online", tier: "A", participants: [...tierATeams.slice(0, 8), ...tierBTeams.slice(0, 8)], description: "Second season of the FACEIT League." },
  { id: "24", name: "WePlay Academy League S7", organizer: "WePlay", prizePool: "$30,000", startDate: "2026-06-10", endDate: "2026-06-20", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: tierCTeams.slice(4, 12), description: "Academy-level competition for developing rosters." },
  { id: "25", name: "ESL Challenger League S2", organizer: "ESL", prizePool: "$100,000", startDate: "2026-06-20", endDate: "2026-07-05", status: "upcoming", teams: 16, location: "Online", tier: "B", participants: tierBTeams, description: "Second season of the Challenger League." },

  // JULY+
  { id: "26", name: "IEM Cologne 2026", organizer: "ESL", prizePool: "$1,000,000", startDate: "2026-07-06", endDate: "2026-07-20", status: "upcoming", teams: 24, location: "Cologne, Germany", tier: "S", participants: [...tierSTeams, ...tierATeams.slice(0, 12)], description: "Cathedral of Counter-Strike. $1M." },
  { id: "27", name: "BLAST Premier Fall Groups", organizer: "BLAST", prizePool: "$300,000", startDate: "2026-08-01", endDate: "2026-08-14", status: "upcoming", teams: 12, location: "Copenhagen, Denmark", tier: "S", participants: tierSTeams, description: "Fall season begins with group stage." },
  { id: "28", name: "ESL Pro League Season 24", organizer: "ESL", prizePool: "$850,000", startDate: "2026-09-01", endDate: "2026-09-22", status: "upcoming", teams: 32, location: "Malta", tier: "S", participants: [...tierSTeams, ...tierATeams, ...tierBTeams.slice(0, 8)], description: "Season 24 of the flagship ESL league." },
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
  { id: "1", title: "BLAST Premier Spring Groups", date: "2026-01-05", type: "tournament-start", description: "Season opener — 12 teams in Copenhagen" },
  { id: "2", title: "IEM Cologne Qualifier", date: "2026-01-10", type: "qualifier", description: "Online qualifier for IEM Cologne" },
  { id: "3", title: "IEM Katowice 2026", date: "2026-02-03", type: "tournament-start", description: "24 teams, $1M prize pool" },
  { id: "4", title: "ESL Pro League S23", date: "2026-03-02", type: "tournament-start", description: "32 teams in Malta" },
  { id: "5", title: "BLAST Premier Spring Finals", date: "2026-04-01", type: "tournament-start", description: "Top 8 in Copenhagen" },
  { id: "6", title: "Vitality vs G2 - Semi Final", date: "2026-04-04", type: "match", description: "BO3 — BLAST Premier" },
  { id: "7", title: "BLAST Premier Grand Final", date: "2026-04-06", type: "match", description: "BO5 — Grand Final" },
  { id: "8", title: "IEM Dallas 2026", date: "2026-04-20", type: "tournament-start", description: "16 teams in Dallas" },
  { id: "9", title: "PGL Major Open Qualifier", date: "2026-05-01", type: "qualifier", description: "Last chance to qualify" },
  { id: "10", title: "PGL Major RMR", date: "2026-05-08", type: "tournament-start", description: "Regional Major Ranking" },
  { id: "11", title: "PGL Major Antwerp", date: "2026-05-18", type: "tournament-start", description: "The Major — $1.25M" },
  { id: "12", title: "PGL Major Grand Final", date: "2026-06-01", type: "match", description: "Grand Final — BO5" },
  { id: "13", title: "IEM Cologne 2026", date: "2026-07-06", type: "tournament-start", description: "Cathedral of CS — $1M" },
  { id: "14", title: "BLAST Premier Fall Groups", date: "2026-08-01", type: "tournament-start", description: "Fall season begins" },
];

// Generate bracket for a tournament
export function generateBracket(tournament: Tournament): BracketMatch[] {
  const teams = tournament.participants.slice(0, tournament.teams);
  const isCompleted = tournament.status === "completed";
  const isLive = tournament.status === "live";

  // Use power-of-2 bracket
  let bracketSize = 4;
  if (teams.length > 4) bracketSize = 8;
  if (teams.length > 8) bracketSize = 16;
  if (teams.length > 16) bracketSize = 32;

  const bracketTeams = teams.slice(0, bracketSize);
  const matches: BracketMatch[] = [];
  let matchNum = 1;
  const totalRounds = Math.log2(bracketSize);

  // Round 1
  for (let i = 0; i < bracketTeams.length; i += 2) {
    const t1 = bracketTeams[i];
    const t2 = bracketTeams[i + 1] || "BYE";

    let score1: number | null = null;
    let score2: number | null = null;
    let winner: string | null = null;

    if (isCompleted || (isLive && matchNum <= bracketSize / 2 - 1)) {
      score1 = Math.floor(Math.random() * 3);
      score2 = score1 === 2 ? Math.floor(Math.random() * 2) : 2;
      if (t2 === "BYE") { score1 = 2; score2 = 0; }
      winner = score1 > score2 ? t1 : t2;
    }

    matches.push({ id: `m${matchNum}`, round: 1, team1: t1, team2: t2, score1, score2, winner, matchNumber: matchNum });
    matchNum++;
  }

  // Subsequent rounds
  for (let round = 2; round <= totalRounds; round++) {
    const prevRoundMatches = matches.filter((m) => m.round === round - 1);
    for (let i = 0; i < prevRoundMatches.length; i += 2) {
      const prev1 = prevRoundMatches[i];
      const prev2 = prevRoundMatches[i + 1];

      const t1 = prev1?.winner || "TBD";
      const t2 = prev2?.winner || "TBD";

      let score1: number | null = null;
      let score2: number | null = null;
      let winner: string | null = null;

      const playedMatchesInRound = round === totalRounds ? (isCompleted ? 1 : 0) : (isCompleted ? 999 : (isLive ? 1 : 0));

      if (t1 !== "TBD" && t2 !== "TBD" && (matchNum - bracketSize / 2) <= playedMatchesInRound) {
        if (isCompleted || isLive) {
          score1 = Math.floor(Math.random() * 3);
          score2 = score1 === 2 ? Math.floor(Math.random() * 2) : 2;
          winner = score1 > score2 ? t1 : t2;
        }
      }

      matches.push({ id: `m${matchNum}`, round, team1: t1, team2: t2, score1, score2, winner, matchNumber: matchNum });
      matchNum++;
    }
  }

  return matches;
}
