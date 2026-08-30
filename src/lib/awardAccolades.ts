// ===== Accolades derived from year-end ceremonies =====
// Turns the stored "Ceremonia Nagród ACSR" history into short badges like
// "#4 gracz roku 2025" shown in player/team profiles.

import { loadYearAwardsHistory } from "./yearAwards";

export interface Accolade {
  year: number;
  /** Ranking position, when the accolade comes from a Top list. */
  rank?: number;
  label: string;
  /** 1 = best (gold), 2/3 = podium, 0 = special award. */
  tone: "gold" | "silver" | "bronze" | "special" | "default";
}

const toneForRank = (rank: number): Accolade["tone"] =>
  rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "default";

const byYearDesc = (a: Accolade, b: Accolade) => b.year - a.year || (a.rank ?? 99) - (b.rank ?? 99);

export function getPlayerAccolades(playerName: string): Accolade[] {
  if (!playerName) return [];
  const history = loadYearAwardsHistory();
  const out: Accolade[] = [];

  for (const key of Object.keys(history)) {
    const a = history[key];
    if (!a) continue;
    const year = a.year ?? Number(key);

    const list = (a.playerTop20?.length ? a.playerTop20 : a.playerTop5) || [];
    const idx = list.findIndex(p => p.player === playerName);
    if (idx >= 0) {
      const rank = idx + 1;
      out.push({
        year,
        rank,
        label: rank === 1 ? `Gracz Roku ${year}` : `#${rank} gracz roku ${year}`,
        tone: toneForRank(rank),
      });
    }

    if (a.rookieOfYear?.player === playerName) out.push({ year, label: `Odkrycie Roku ${year}`, tone: "special" });
    if (a.topFragger?.player === playerName) out.push({ year, label: `Top Fragger ${year}`, tone: "special" });
    if (a.mvpKing?.player === playerName) out.push({ year, label: `Król MVP ${year}`, tone: "special" });
    if (a.transferOfYear?.player === playerName) out.push({ year, label: `Transfer Roku ${year}`, tone: "special" });
    if (a.coachOfYear?.coach === playerName) out.push({ year, label: `Trener Roku ${year}`, tone: "special" });
  }

  return out.sort(byYearDesc);
}

export function getTeamAccolades(teamName: string): Accolade[] {
  if (!teamName) return [];
  const history = loadYearAwardsHistory();
  const out: Accolade[] = [];

  for (const key of Object.keys(history)) {
    const a = history[key];
    if (!a) continue;
    const year = a.year ?? Number(key);

    const list = (a.teamTop5?.length ? a.teamTop5 : a.teamTop3) || [];
    const idx = list.findIndex(t => t.team === teamName);
    if (idx >= 0) {
      const rank = idx + 1;
      out.push({
        year,
        rank,
        label: rank === 1 ? `Drużyna Roku ${year}` : `#${rank} drużyna roku ${year}`,
        tone: toneForRank(rank),
      });
    }

    if (a.playerOfYear?.team === teamName) {
      out.push({ year, label: `Gracz Roku ${year}: ${a.playerOfYear.player}`, tone: "special" });
    }
    if (a.coachOfYear?.team === teamName) {
      out.push({ year, label: `Trener Roku ${year}: ${a.coachOfYear.coach}`, tone: "special" });
    }
  }

  return out.sort(byYearDesc);
}

export const accoladeClass = (tone: Accolade["tone"]): string => {
  switch (tone) {
    case "gold":
      return "border-[hsl(var(--gold))]/60 bg-gradient-to-r from-[hsl(var(--gold))]/20 to-transparent text-foreground shadow-[0_0_14px_hsl(var(--gold)/0.25)]";
    case "silver":
      return "border-[hsl(var(--silver))]/50 bg-[hsl(var(--silver))]/10 text-foreground";
    case "bronze":
      return "border-[hsl(var(--bronze))]/50 bg-[hsl(var(--bronze))]/10 text-foreground";
    case "special":
      return "border-primary/40 bg-primary/10 text-primary";
    default:
      return "border-border bg-secondary/40 text-muted-foreground";
  }
};
