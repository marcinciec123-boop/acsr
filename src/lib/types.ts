// ===== App Data Types =====

export interface TeamData {
  name: string;
  points: number;
  country: string;
  region: string;
  roster: string[];
}

export interface MatchResult {
  id: string;
  team1: string;
  team2: string;
  score1: number;
  score2: number;
  maps?: { map: string; score1: number; score2: number }[];
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
  format: string;
  status: "upcoming" | "live" | "completed";
  participants: string[];
  matches: MatchResult[];
  placements: { team: string; placement: number; points: number }[];
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
