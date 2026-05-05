// Collect "who already played whom" across earlier phases of a tournament.
// Used to:
//  - prevent Swiss from re-pairing teams that met in groups (or earlier Swiss/bracket)
//  - reorder playoff seeds so first round avoids immediate rematches
import type { TournamentPhase, MatchResult } from "./types";

const isReal = (s: string | undefined): s is string =>
  !!s && s !== "BYE" && s !== "TBD" && !s.startsWith("TBD");

export const pairKey = (a: string, b: string) =>
  a < b ? `${a}|${b}` : `${b}|${a}`;

const collectFromMatches = (matches: MatchResult[], out: Set<string>) => {
  matches.forEach(m => {
    if (!isReal(m.team1) || !isReal(m.team2)) return;
    // Count even unplayed pairings — they were scheduled together, which is enough
    // to consider them "already met" for rematch avoidance.
    out.add(pairKey(m.team1, m.team2));
  });
};

/** Set of "A|B" keys for every pair that already played (or was scheduled) in
 *  any phase strictly BEFORE `currentPhaseId`. If `currentPhaseId` is omitted,
 *  scans every phase. */
export function collectPriorMeetings(
  phases: TournamentPhase[],
  currentPhaseId?: string,
): Set<string> {
  const out = new Set<string>();
  for (const p of phases) {
    if (currentPhaseId && p.id === currentPhaseId) break;
    if (p.bracket) collectFromMatches(p.bracket, out);
    if (p.groups) p.groups.forEach(g => collectFromMatches(g.matches, out));
  }
  return out;
}

/** Reorder a seeded team array so that first-round pairings (idx 0v1, 2v3, ...)
 *  avoid `priorMeetings` rematches when possible. Tries cheap swaps within the
 *  bottom half of each pair; falls back to original order if no improvement. */
export function reorderSeedsToAvoidRematches(
  teams: string[],
  priorMeetings: Set<string>,
): string[] {
  if (priorMeetings.size === 0) return teams;
  const seeds = [...teams];
  const isMatch = (a: string, b: string) =>
    isReal(a) && isReal(b) && priorMeetings.has(pairKey(a, b));

  for (let i = 0; i < seeds.length; i += 2) {
    const a = seeds[i];
    const b = seeds[i + 1];
    if (!a || !b) continue;
    if (!isMatch(a, b)) continue;
    // Try swapping b with another team in a later pair's slot 2 (preserving top seeds).
    let swapped = false;
    for (let j = i + 2; j < seeds.length; j += 2) {
      const candidate = seeds[j + 1];
      if (!candidate) continue;
      // Swap is good if it removes the rematch and doesn't create a new one
      if (
        !isMatch(a, candidate) &&
        !isMatch(seeds[j], b)
      ) {
        seeds[i + 1] = candidate;
        seeds[j + 1] = b;
        swapped = true;
        break;
      }
    }
    // If still a rematch, try swapping with slot 1 of a later pair
    if (!swapped) {
      for (let j = i + 2; j < seeds.length; j += 2) {
        const candidate = seeds[j];
        if (!candidate) continue;
        if (
          !isMatch(a, candidate) &&
          !isMatch(b, seeds[j + 1])
        ) {
          seeds[i + 1] = candidate;
          seeds[j] = b;
          break;
        }
      }
    }
  }
  return seeds;
}
