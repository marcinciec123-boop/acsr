import type { MatchResult, TournamentData } from "./types";
import { isMatchDecided, winsNeededFor } from "./matchStatus";
import { isPlaceholder } from "./teamHelpers";
import { propagateGSL4Group, propagateGSLDEGroup } from "./tournamentBuilder";

/**
 * Resync downstream bracket matches based on every source's current winner/loser.
 * Each downstream slot is "owned" by the upstream that feeds it (winnerTo / loserTo).
 * If upstream is decided → write its winner/loser into the slot it owns.
 * If upstream is undecided (no score / draw) → clear the owned slot + reset its scores.
 * This prevents the "stale team in semifinal after fixing the quarterfinal" bug.
 */
export const propagateBracket = (bracket: MatchResult[]): MatchResult[] => {
  // Build map: targetMatchId → array of { ownerSlot: "team1"|"team2", source }
  // We don't know which slot in the target each source feeds, so we assign them
  // deterministically: among all sources targeting one match, the first goes to
  // team1, the second to team2 (insertion-order stable).
  const winnerInputs: Record<string, MatchResult[]> = {};
  const loserInputs: Record<string, MatchResult[]> = {};
  bracket.forEach(src => {
    if (src.winnerTo) {
      if (!winnerInputs[src.winnerTo]) winnerInputs[src.winnerTo] = [];
      winnerInputs[src.winnerTo].push(src);
    }
    if (src.loserTo) {
      if (!loserInputs[src.loserTo]) loserInputs[src.loserTo] = [];
      loserInputs[src.loserTo].push(src);
    }
  });

  const decidedWinner = (m: MatchResult): string | null => {
    if (!m.team1 || !m.team2) return null;
    if (m.team1 === "BYE") return m.team2 && m.team2 !== "BYE" ? m.team2 : null;
    if (m.team2 === "BYE") return m.team1 !== "BYE" ? m.team1 : null;
    if (!isMatchDecided(m)) return null;
    return m.score1 > m.score2 ? m.team1 : m.team2;
  };
  const decidedLoser = (m: MatchResult): string | null => {
    if (!m.team1 || !m.team2) return null;
    if (m.team1 === "BYE" || m.team2 === "BYE") return null;
    if (!isMatchDecided(m)) return null;
    return m.score1 > m.score2 ? m.team2 : m.team1;
  };

  return bracket.map(target => {
    const wIn = winnerInputs[target.id] || [];
    const lIn = loserInputs[target.id] || [];
    // No upstream feed → leave as-is (manual seeding / first round)
    if (wIn.length === 0 && lIn.length === 0) return target;

    const slots: (string | "")[] = [];
    wIn.forEach(s => slots.push(decidedWinner(s) || ""));
    lIn.forEach(s => slots.push(decidedLoser(s) || ""));

    // Pad to 2 slots
    while (slots.length < 2) slots.push("");

    const next = { ...target };
    const newT1 = slots[0];
    const newT2 = slots[1];
    // Only mutate if changed; if changed, reset scores
    if (next.team1 !== newT1 || next.team2 !== newT2) {
      next.team1 = newT1;
      next.team2 = newT2;
      next.score1 = 0;
      next.score2 = 0;
      next.maps = undefined;
      next.veto = undefined;
      next.playedAt = undefined;
      next.resultConfirmed = false;
      next.confirmedAt = undefined;
      next.pointsWinner = undefined;
      next.pointsLoser = undefined;
    }
    return next;
  });
};


/** Repeat propagation until nothing changes (a fix in R1 may cascade through R2, R3...). */
export const propagateBracketFully = (bracket: MatchResult[]): MatchResult[] => {
  let curr = bracket;
  for (let i = 0; i < 10; i++) {
    const next = propagateBracket(curr);
    if (JSON.stringify(next) === JSON.stringify(curr)) break;
    curr = next;
  }
  return curr;
};

/** Unplayed match against a disbanded club → walkover win for the real opponent. */
const walkoverMatch = (m: MatchResult, gone: Set<string>, bo: number): MatchResult => {
  const out1 = gone.has(m.team1), out2 = gone.has(m.team2);
  if (out1 === out2) return m; // neither, or both disbanded
  if (isPlaceholder(out1 ? m.team2 : m.team1)) return m; // opponent not known yet
  if (isMatchDecided(m, m.bo ?? bo)) return m;
  const need = winsNeededFor(m.bo ?? bo);
  return {
    ...m,
    score1: out1 ? 0 : need,
    score2: out1 ? need : 0,
    maps: undefined,
    veto: undefined,
    walkover: true,
  };
};

/**
 * Live tournament: every unplayed match of a disbanded club is a walkover, and the
 * winner moves on immediately (repeated until the bracket settles).
 */
export function applyWalkovers(t: TournamentData, disbanded: string[]): TournamentData {
  const gone = new Set(disbanded.filter(Boolean));
  if (!gone.size) return t;
  let curr = t;
  for (let i = 0; i < 10; i++) {
    let changed = false;
    const phases = curr.phases.map(p => {
      const wo = (ms: MatchResult[]) => ms.map(m => {
        const n = walkoverMatch(m, gone, p.bo);
        if (n !== m) changed = true;
        return n;
      });
      const groups = p.groups?.map(g => {
        let ms = wo(g.matches);
        if (!p.mergedGroups && p.format === "gsl-de-groups") ms = propagateGSLDEGroup(ms.map(m => ({ ...m })));
        else if (!p.mergedGroups && p.format === "gsl-groups") ms = propagateGSL4Group(ms.map(m => ({ ...m })));
        return { ...g, matches: ms };
      });
      const bracket = p.bracket ? propagateBracketFully(wo(p.bracket)) : p.bracket;
      return { ...p, ...(groups && { groups }), ...(bracket && { bracket }) };
    });
    if (!changed) break;
    curr = { ...curr, phases };
  }
  return curr;
}
