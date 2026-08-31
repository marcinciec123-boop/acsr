// ===== One-time seed: Ceremonia Nagród ACSR 2025 =====
// Wpisuje ręcznie zatwierdzone wyniki ceremonii za rok 2025 do historii
// (localStorage "year_awards_history"), jeśli rok 2025 nie został jeszcze
// policzony ani zseedowany.

import { loadFromStorage } from "./storage";
import { loadYearAwardsHistory, saveYearAwards, type YearAwards, type PlayerAward, type TeamAward } from "./yearAwards";
import type { TeamData, TournamentData, Transfer } from "./types";

const PLAYER_TOP20: string[] = [
  "blameF", "nukkye", "iDISBALANCE", "TeSeS", "TaReX", "SANJI", "hantZ", "donk",
  "svaipZ", "sh1ro", "kyxsan", "iSt3s", "bubble", "NiKo", "MazloV", "apEX",
  "jL", "Senzu", "AcreoN", "iNSTiNCT",
];

const TEAM_TOP5: string[] = [
  "Team Falcons", "Windigo", "The MongolZ", "GalactiC", "LT Twisted Minds",
];

// Stopniowo malejące, realistyczne ratingi zgodne z kolejnością Top 20.
const ratingFor = (rank: number): number =>
  Math.round((1.32 - (rank - 1) * 0.017) * 100) / 100;

const matchesFor = (rank: number): number => 68 - Math.floor((rank - 1) * 1.2);

function findPlayerTeam(player: string, teams: TeamData[]): string {
  for (const t of teams) {
    if ((t.roster || []).includes(player)) return t.name;
    if (t.coach === player) return t.name;
  }
  return "";
}

export function seedYearAwards2025(): void {
  const history = loadYearAwardsHistory();
  if (history["2025"]) return;

  const teams = loadFromStorage<TeamData[]>("ranking_data", []);
  const tournaments = loadFromStorage<TournamentData[]>("tournaments_data", []);
  const transfers = loadFromStorage<Transfer[]>("transfers_data", []);

  const rankByTeam = new Map(
    [...teams].filter(t => !t.isNational).sort((a, b) => (b.points || 0) - (a.points || 0))
      .map((t, i) => [t.name, i + 1] as const),
  );

  const players: PlayerAward[] = PLAYER_TOP20.map((name, i) => {
    const team = findPlayerTeam(name, teams);
    const rating = ratingFor(i + 1);
    return {
      player: name,
      team,
      rating,
      matches: matchesFor(i + 1),
      kdr: Math.round((1.05 + rating * 0.15) * 100) / 100,
      kills: 0,
      adr: Math.round(72 + rating * 12),
      kast: Math.round((70 + rating * 4) * 10) / 10,
      achievementScore: (20 - i) * 12,
      teamRankingPosition: team ? rankByTeam.get(team) : undefined,
    };
  });

  const teamAwards: TeamAward[] = TEAM_TOP5.map((name, i) => ({
    team: name,
    trophies: Math.max(0, 4 - i),
    finals: Math.max(0, 6 - i),
    top3: Math.max(0, 8 - i),
    points: teams.find(t => t.name === name)?.points ?? 0,
    weightedScore: (5 - i) * 100,
    rankingPosition: rankByTeam.get(name),
  }));

  // Turniej Roku: StarLadder Berlin Major 2025
  const major = tournaments.find(t => t.name?.toLowerCase().includes("starladder berlin major 2025"));
  const tournamentOfYear = {
    id: major?.id ?? "seed-2025-major",
    name: "StarLadder Berlin Major 2025",
    tier: major?.tier ?? "S",
    prizePool: major?.prizePool ?? "$1,250,000",
    teams: major?.teams ?? major?.participants?.length ?? 24,
    winner: major?.placements?.find(p => p.placement === 1)?.team ?? "Team Falcons",
  };

  // Trener Roku: zonic
  const zonicTeam = teams.find(t => t.coach === "zonic")?.name ?? "Team Falcons";

  // Transfer Roku: TaReX (Scheid eSports -> GalactiC)
  const tarexTransfer = transfers
    .filter(t => t.player === "TaReX" && t.date?.startsWith("2025"))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .pop();

  const awards: YearAwards = {
    year: 2025,
    computedAt: new Date().toISOString(),
    totalTournaments: tournaments.filter(t => t.status === "completed" && t.endDate?.startsWith("2025")).length,
    totalMatches: 0,
    teamOfYear: teamAwards[0],
    teamTop3: teamAwards.slice(0, 3),
    teamTop5: teamAwards,
    playerOfYear: players[0],
    playerTop5: players.slice(0, 5),
    playerTop20: players,
    rookieOfYear: players.find(p => p.player === "TaReX"),
    topFragger: players.find(p => p.player === "iDISBALANCE"),
    mvpKing: { player: "blameF", team: findPlayerTeam("blameF", teams), mvps: 3 },
    coachOfYear: { coach: "zonic", team: zonicTeam, trophies: teamAwards[0]?.trophies ?? 0 },
    tournamentOfYear,
    transferOfYear: {
      player: "TaReX",
      oldTeam: "Scheid eSports",
      newTeam: "GalactiC",
      date: tarexTransfer?.date ?? "2025-06-01",
      postRating: players.find(p => p.player === "TaReX")?.rating ?? 1.2,
      postMatches: players.find(p => p.player === "TaReX")?.matches ?? 60,
    },
  };

  saveYearAwards(awards);
}
