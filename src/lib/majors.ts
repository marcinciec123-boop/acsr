// ===== Major tournaments =====
//
// A tournament whose name contains "Major" is treated as the most prestigious
// event of the season: it carries the biggest weight in year-end awards and
// gets a dedicated badge / glowing trophy in achievement cabinets.

/** Qualifiers / regional eliminations are NOT Majors, even if "Major" is in the name. */
const QUALIFIER_RE =
  /\b(kwalifikacj\w*|qualifier\w*|quals?\b|eliminacj\w*|elimination\w*|rmr\b|open\s+qual\w*|closed\s+qual\w*|last\s+chance)\b/i;

export const isQualifierName = (name?: string | null): boolean =>
  !!name && QUALIFIER_RE.test(name);

export const isMajorName = (name?: string | null): boolean =>
  !!name && /\bmajor\b/i.test(name) && !isQualifierName(name);

export const isMajorTournament = (tournament?: { name?: string | null; kind?: string | null } | null): boolean =>
  !!tournament && tournament.kind !== "qualifier" && isMajorName(tournament.name);

/** Extra multiplier applied on top of the tier weight for Major events. */
export const MAJOR_WEIGHT = 2.2;

export interface HistoricMajor {
  id: string;
  year: number;
  name: string;
  /** Team name as it was back then. */
  team: string;
  /** Current name of that organisation (for cabinet matching). */
  currentTeam: string;
  /** Only players that exist in the database. */
  roster: string[];
}

export const historicMajors: HistoricMajor[] = [
  {
    id: "historic-major-2020",
    year: 2020,
    name: "CS Major 2020",
    team: "Frenzied",
    currentTeam: "Team Falcons",
    roster: ["bubble", "apEX", "gla1ve", "dupreeh"],
  },
];

export const historicMajorsForTeam = (teamName?: string): HistoricMajor[] =>
  !teamName ? [] : historicMajors.filter(m => m.team === teamName || m.currentTeam === teamName);

export const historicMajorsForPlayer = (playerName?: string): HistoricMajor[] =>
  !playerName ? [] : historicMajors.filter(m => m.roster.includes(playerName));
