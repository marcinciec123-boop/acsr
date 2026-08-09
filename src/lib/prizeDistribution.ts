// Prize distribution helper — converts a tournament's total prize pool into
// per-placement prize money using a standard top-heavy percentage split.
// The exact real-world split varies by event; this returns a plausible
// approximation good enough for a fantasy CS:GO hub.

export function parsePrizePool(pool: string | undefined): number {
  if (!pool) return 0;
  // "$1,000,000" | "1 000 000 USD" | "€425,000"
  const digits = pool.replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

/** Percentages sum to ~100 for each teamsCount tier. */
function splitPercents(teamsCount: number): number[] {
  if (teamsCount >= 20) {
    // 24/32-team majors
    return [
      40, 20, 10, 10,   // 1, 2, 3-4
      3.5, 3.5, 3.5, 3.5, // 5-8
      1.5, 1.5, 1.5, 1.5, // 9-12
      0.75, 0.75, 0.75, 0.75, // 13-16
    ];
  }
  if (teamsCount >= 12) {
    // 12/16-team events
    return [
      38, 20, 11, 11,   // 1, 2, 3-4
      4, 4, 4, 4,       // 5-8
      1, 1, 1, 1,       // 9-12
      0.5, 0.5, 0.5, 0.5, // 13-16
    ];
  }
  // 8-team events
  return [
    40, 22, 13, 13,     // 1, 2, 3-4
    3, 3, 3, 3,         // 5-8
  ];
}

/** Returns a map: placement (1-based) → prize amount (integer). */
export function distributePrizePool(
  totalPool: number,
  teamsCount: number,
): Record<number, number> {
  const out: Record<number, number> = {};
  if (!totalPool || !teamsCount) return out;
  const pct = splitPercents(teamsCount);
  for (let i = 0; i < Math.min(pct.length, teamsCount); i++) {
    out[i + 1] = Math.round((totalPool * pct[i]) / 100);
  }
  return out;
}

export function formatMoney(n: number): string {
  if (!n) return "—";
  return "$" + n.toLocaleString("en-US");
}

/** Share of a team's prize money that goes to the organisation (not players). */
export const ORG_CUT = 0.25;

/**
 * Resolve prize money per placement for a tournament: manual overrides
 * (customPrizes) take priority, otherwise the standard split of its own pool.
 * Qualifiers always use their OWN prize pool — never the main event's.
 */
export function resolveTournamentPrizes(t: {
  prizePool?: string;
  customPrizes?: Record<string, number>;
  participants?: string[];
  teams?: number;
}): Record<number, number> {
  const base = distributePrizePool(
    parsePrizePool(t.prizePool),
    t.participants?.length || t.teams || 8,
  );
  const custom = t.customPrizes;
  if (custom && Object.keys(custom).length) {
    const out: Record<number, number> = { ...base };
    for (const [k, v] of Object.entries(custom)) {
      const place = parseInt(k, 10);
      if (!Number.isNaN(place) && v !== null && v !== undefined) out[place] = v;
    }
    return out;
  }
  return base;
}
