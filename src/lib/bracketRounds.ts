import type { MatchResult } from "./types";

export type BracketSide = "upper" | "lower" | "other";

/** Visual round key: "1ST ROUND M2" and "1ST ROUND" are the same column. */
export const roundKey = (round?: string) =>
  (round || "Match").trim()
    .replace(/\s+[—-]?\s*M(?:atch)?\s*\d+$/i, "")
    .replace(/\s+#\d+$/i, "")
    .trim() || "Match";

export const isDeciderRound = (name: string) => /decider|decyder|rozstrzyg/i.test(name);
export const isGrandFinalRound = (name: string, slot = "") =>
  slot === "GF" || /grand\s*final|wielki\s*fina/i.test(name);
export const isThirdPlaceRound = (name: string) => /3rd\s*place|third\s*place|bronze/i.test(name);

const LOWER_NAME = /\blower\b|\blb\b|losers|dolna/i;
const UPPER_NAME = /\bupper\b|\bub\b|winners|górna|gorna/i;

/** Side of a single match: slot first, round name as fallback. */
export const matchSide = (m: Pick<MatchResult, "bracketSlot" | "round">): BracketSide => {
  const slot = m.bracketSlot || "";
  if (/^(IEM-)?LB-/i.test(slot)) return "lower";
  if (/^(IEM-)?UB-/i.test(slot) || slot === "GF") return "upper";
  const name = m.round || "";
  if (LOWER_NAME.test(name)) return "lower";
  if (UPPER_NAME.test(name) || isGrandFinalRound(name)) return "upper";
  return "other";
};

/** Side of a round column: all matches must agree, otherwise "other". */
export const roundSide = (matches: MatchResult[]): BracketSide => {
  if (!matches.length) return "other";
  const first = matchSide(matches[0]);
  return matches.every(m => matchSide(m) === first) ? first : "other";
};

/**
 * Column order within one side: regular rounds keep their stored order,
 * deciders go after them, the Grand Final is always last.
 */
export const orderRounds = (names: string[], grouped: Record<string, MatchResult[]>) => {
  const rank = (n: string) => {
    if (isGrandFinalRound(n, grouped[n]?.[0]?.bracketSlot)) return 2;
    if (isDeciderRound(n)) return 1;
    return 0;
  };
  return names
    .map((n, i) => ({ n, i, r: rank(n) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(x => x.n);
};

const groupBlocks = (bracket: MatchResult[]) => {
  const keys: string[] = [];
  bracket.forEach(m => { const k = roundKey(m.round); if (!keys.includes(k)) keys.push(k); });
  return keys;
};

/**
 * Add an empty match to a round. Existing round: slot "<side>-R<n>-M<next>" and inserted
 * right after the round's last match. New round: placed after the last round of the same
 * side (before deciders / Grand Final) so it shows up where it belongs, not at the bottom.
 */
export const addMatchToRound = (
  bracket: MatchResult[],
  round: string,
  base: Omit<MatchResult, "round" | "bracketSlot">,
  side?: BracketSide,
): MatchResult[] => {
  const key = roundKey(round);
  const existing = bracket.filter(m => roundKey(m.round) === key);
  const resolvedSide: BracketSide = existing.length
    ? roundSide(existing)
    : side ?? matchSide({ round, bracketSlot: "" });
  const prefix = resolvedSide === "lower" ? "LB" : resolvedSide === "upper" ? "UB" : "";

  let slot: string | undefined;
  const firstSlot = existing.find(m => m.bracketSlot)?.bracketSlot || "";
  const slotMatch = /^(.*-R?[\w]+)-M(\d+)$/i.exec(firstSlot);
  if (slotMatch) {
    const maxM = Math.max(0, ...existing.map(m => {
      const mm = /-M(\d+)$/i.exec(m.bracketSlot || "");
      return mm ? parseInt(mm[1], 10) : 0;
    }));
    slot = `${slotMatch[1]}-M${maxM + 1}`;
  } else if (!existing.length && prefix) {
    const sideRounds = new Set(
      bracket.filter(m => matchSide(m) === resolvedSide).map(m => {
        const mm = new RegExp(`^${prefix}-R(\\d+)-`, "i").exec(m.bracketSlot || "");
        return mm ? parseInt(mm[1], 10) : 0;
      }),
    );
    slot = `${prefix}-R${Math.max(0, ...sideRounds) + 1}-M1`;
  } else if (!existing.length && !prefix) {
    slot = undefined;
  }

  const match: MatchResult = { ...base, round, ...(slot ? { bracketSlot: slot } : {}) } as MatchResult;
  const next = [...bracket];

  if (existing.length) {
    const lastIdx = next.map(m => roundKey(m.round)).lastIndexOf(key);
    next.splice(lastIdx + 1, 0, match);
    return next;
  }

  // New round: after last regular round of the same side.
  const isDecider = isDeciderRound(round);
  let insertAt = -1;
  next.forEach((m, i) => {
    if (resolvedSide !== "other" && matchSide(m) !== resolvedSide) return;
    const k = roundKey(m.round);
    if (isGrandFinalRound(k, m.bracketSlot) || isThirdPlaceRound(k)) return;
    if (!isDecider && isDeciderRound(k)) return;
    insertAt = i;
  });
  next.splice(insertAt + 1, 0, match);
  return next;
};

/** Swap a round with its neighbour on the same side (keeps every match of both rounds together). */
export const moveRound = (bracket: MatchResult[], round: string, dir: -1 | 1): MatchResult[] => {
  const keys = groupBlocks(bracket);
  const byKey: Record<string, MatchResult[]> = {};
  bracket.forEach(m => { const k = roundKey(m.round); (byKey[k] ||= []).push(m); });
  const key = roundKey(round);
  const side = roundSide(byKey[key] || []);
  const sameSide = keys.filter(k => roundSide(byKey[k]) === side && !isThirdPlaceRound(k));
  const pos = sameSide.indexOf(key);
  const target = sameSide[pos + dir];
  if (pos === -1 || !target) return bracket;
  const ia = keys.indexOf(key);
  const ib = keys.indexOf(target);
  [keys[ia], keys[ib]] = [keys[ib], keys[ia]];

  // Renumber UB/LB round indexes so slot geometry follows the new order.
  const prefix = side === "lower" ? "LB" : side === "upper" ? "UB" : null;
  const newOrder = keys.filter(k => roundSide(byKey[k]) === side && !isThirdPlaceRound(k));
  const renum = (m: MatchResult): MatchResult => {
    if (!prefix) return m;
    const mm = new RegExp(`^${prefix}-R\\d+-(M\\d+)$`, "i").exec(m.bracketSlot || "");
    if (!mm) return m;
    const idx = newOrder.indexOf(roundKey(m.round));
    return { ...m, bracketSlot: `${prefix}-R${idx + 1}-${mm[1]}` };
  };
  return keys.flatMap(k => byKey[k].map(m => (roundKey(m.round) === key || roundKey(m.round) === target) ? renum(m) : m));
};
