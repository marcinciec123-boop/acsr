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
  tier: "S" | "A" | "B";
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

export const tournaments: Tournament[] = [
  { id: "1", name: "IEM Katowice 2026", organizer: "ESL", prizePool: "$1,000,000", startDate: "2026-04-10", endDate: "2026-04-20", status: "upcoming", teams: 24, location: "Katowice, Poland", tier: "S" },
  { id: "2", name: "BLAST Premier Spring Finals", organizer: "BLAST", prizePool: "$425,000", startDate: "2026-04-05", endDate: "2026-04-09", status: "live", teams: 8, location: "Copenhagen, Denmark", tier: "S" },
  { id: "3", name: "ESL Pro League Season 23", organizer: "ESL", prizePool: "$850,000", startDate: "2026-03-15", endDate: "2026-03-28", status: "completed", teams: 32, location: "Malta", tier: "S" },
  { id: "4", name: "PGL Major Antwerp", organizer: "PGL", prizePool: "$1,250,000", startDate: "2026-05-05", endDate: "2026-05-22", status: "upcoming", teams: 24, location: "Antwerp, Belgium", tier: "S" },
  { id: "5", name: "FACEIT League Season 2", organizer: "FACEIT", prizePool: "$250,000", startDate: "2026-04-01", endDate: "2026-04-15", status: "live", teams: 16, location: "Online", tier: "A" },
  { id: "6", name: "Thunderpick World Championship", organizer: "Thunderpick", prizePool: "$1,000,000", startDate: "2026-05-10", endDate: "2026-05-20", status: "upcoming", teams: 16, location: "Istanbul, Turkey", tier: "A" },
  { id: "7", name: "CCT Season 3 Finals", organizer: "CCT", prizePool: "$150,000", startDate: "2026-03-20", endDate: "2026-03-25", status: "completed", teams: 8, location: "Online", tier: "B" },
  { id: "8", name: "BetBoom Dacha", organizer: "BetBoom", prizePool: "$200,000", startDate: "2026-04-12", endDate: "2026-04-18", status: "upcoming", teams: 12, location: "Belgrade, Serbia", tier: "B" },
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
];

export const calendarEvents: CalendarEvent[] = [
  { id: "1", title: "BLAST Premier Spring Finals", date: "2026-04-05", type: "tournament-start", description: "8 teams compete in Copenhagen" },
  { id: "2", title: "Vitality vs G2 - Semi Final", date: "2026-04-07", type: "match", description: "BO3 - BLAST Premier" },
  { id: "3", title: "BLAST Premier Grand Final", date: "2026-04-09", type: "match", description: "BO5 - Grand Final" },
  { id: "4", title: "IEM Katowice 2026", date: "2026-04-10", type: "tournament-start", description: "24 teams, $1M prize pool" },
  { id: "5", title: "IEM Katowice Play-In", date: "2026-04-11", type: "match", description: "Play-In stage begins" },
  { id: "6", title: "IEM Katowice Group Stage", date: "2026-04-14", type: "match", description: "Group stage begins" },
  { id: "7", title: "IEM Katowice Playoffs", date: "2026-04-18", type: "match", description: "Playoff bracket begins" },
  { id: "8", title: "IEM Katowice Grand Final", date: "2026-04-20", type: "match", description: "Grand Final - BO5" },
  { id: "9", title: "BetBoom Dacha", date: "2026-04-12", type: "tournament-start", description: "12 teams in Belgrade" },
  { id: "10", title: "PGL Major Qualifier", date: "2026-04-25", type: "qualifier", description: "Open Qualifier #1" },
  { id: "11", title: "PGL Major Antwerp", date: "2026-05-05", type: "tournament-start", description: "The Major begins!" },
  { id: "12", title: "PGL Major Grand Final", date: "2026-05-22", type: "match", description: "Grand Final - BO5 - $1.25M" },
];
