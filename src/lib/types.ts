// ===== App Data Types =====

export interface TeamData {
  name: string;
  points: number;
  country: string;
  region: string;
  roster: string[];
  /** Reprezentacja narodowa (mistrzostwa świata) — nie liczy się do klubowego rankingu. */
  isNational?: boolean;
}

export interface MapPlayerStats {
  playerName: string;
  team: string; // team name this player belongs to ("team1" or actual team name)
  kills: number;
  assists: number;
  deaths: number;
  adr: number;     // average damage per round
  kast: number;    // KAST% (0-100)
  ud: number;      // utility damage
  ef: number;      // enemies flashed
  rating?: number; // computed
}

export interface MatchMap {
  /** Map name e.g. "Mirage", "Inferno" */
  map: string;
  score1: number;  // rounds team1
  score2: number;  // rounds team2
  team1Players?: MapPlayerStats[]; // 5 players
  team2Players?: MapPlayerStats[]; // 5 players
}

export interface MatchResult {
  id: string;
  team1: string;
  team2: string;
  score1: number;
  score2: number;
  /** Per-map breakdown: rounds + player stats (Bo1: 1 entry, Bo3: up to 3, Bo5: up to 5) */
  maps?: MatchMap[];
  /** Bracket position metadata (used by SE/DE/GSL phases) */
  bracketSlot?: string; // e.g. "UB-R1-M1", "LB-R2-M3", "GA-WM" (group A winners match)
  /** Round label for display, e.g. "Quarterfinals", "Round 1" */
  round?: string;
  /** For bracket auto-progression: where winner advances to (matchId) */
  winnerTo?: string;
  /** Where loser advances (DE only) */
  loserTo?: string;
  bo?: 1 | 3 | 5; // best-of
  /** Punkty rankingowe przyznawane zwycięzcy po zatwierdzeniu meczu */
  pointsWinner?: number;
  /** Punkty rankingowe odejmowane przegranemu po zatwierdzeniu meczu */
  pointsLoser?: number;
  /** Czy wynik meczu został zatwierdzony i punkty zaaplikowane do rankingu */
  resultConfirmed?: boolean;
  /** ISO timestamp ustawiany kiedy mecz uzyskuje finalny wynik (do chronologicznego sortowania historii). */
  playedAt?: string;
}

export type PhaseFormat =
  | "single-elim"
  | "double-elim"
  | "swiss"
  | "round-robin"
  | "gsl-groups"
  | "gsl-de-groups"
  | "showmatch";

export interface PhaseGroup {
  id: string;
  name: string; // "Group A"
  teams: string[]; // seeded order
  matches: MatchResult[]; // for RR/GSL
}

export interface TournamentPhase {
  id: string;
  name: string; // e.g. "Group Stage", "Playoffs"
  format: PhaseFormat;
  bo: 1 | 3 | 5;
  /** Teams entering this phase (resolved from prev phase or initial seeding) */
  teams: string[];
  /** For groups (RR / GSL): list of groups */
  groups?: PhaseGroup[];
  /** For bracket formats (SE/DE): flat match list with bracketSlot */
  bracket?: MatchResult[];
  /** How many teams advance from this phase */
  advanceCount?: number;
  /** Number of groups for groups format */
  groupCount?: number;
  /** Swiss rounds (computed from teams length if absent) */
  swissRounds?: number;
  /** Region tag (dla kwalifikacji regionalnych: "EU", "US", "ASIA"...) */
  region?: string;
}

export type TournamentKind = "main" | "qualifier" | "worlds";

export interface QualifierConfig {
  /** "global" = jedna pula, "regional" = osobne sloty per region */
  scope: "global" | "regional";
  /** Wybrane regiony (dla scope=regional). Dla global puste lub ["GLOBAL"]. */
  regions: string[];
  /** Sloty awansu — klucz: region (lub "GLOBAL"), wartość: liczba miejsc */
  slotsPerRegion: Record<string, number>;
  /** ID turnieju głównego, do którego awansują zwycięzcy (opcjonalne) */
  linkedTournamentId?: string;
  /** Drużyny już awansowane (zapobiega podwójnemu awansowi) */
  promotedTeams?: string[];
}

export interface TournamentData {
  id: string;
  name: string;
  organizer: string;
  prizePool: string;
  startDate: string;
  endDate: string;
  location: string;
  tier: "S" | "A" | "B" | "C";
  teams: number;
  /** High level format label (auto-derived from phases) */
  format: string;
  status: "upcoming" | "live" | "completed";
  participants: string[]; // seeded team list
  /** New: ordered list of phases */
  phases: TournamentPhase[];
  /** Legacy flat match list — kept for backward compatibility */
  matches?: MatchResult[];
  placements: { team: string; placement: number; points: number }[];
  /** Ostateczne wyniki zatwierdzone przez użytkownika i przeniesione do profili/rankingu */
  resultsConfirmed?: boolean;
  finalizedAt?: string;
  /** Czy to turniej główny czy kwalifikacja */
  kind?: TournamentKind;
  /** Konfiguracja kwalifikacji (gdy kind === "qualifier") */
  qualifierConfig?: QualifierConfig;
  /** Region przypisany do meczu — używane do grupowania zwycięzców (opcjonalne, na poziomie fazy) */
  /** Ręczny przydział punktów za miejsca — klucz to placement (1-indexed jako string).
   *  Brak klucza = użyj domyślnej wartości dla tieru. */
  customPoints?: Record<string, number>;
}

export interface Transfer {
  id: string;
  player: string;
  oldTeam: string;
  newTeam: string;
  date: string;
}

export interface NewsPost {
  id: string;
  content: string;
  imageId?: string; // references IndexedDB image
  date: string;
  pinned?: boolean;
  category?: string;
}

export interface RankingAdjustment {
  id: string;
  team: string;
  points: number;
  reason: string;
  date: string;
}
