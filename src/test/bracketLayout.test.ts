import { describe, expect, it } from "vitest";
import { computeBracketLayout } from "@/lib/bracketLayout";
import type { MatchResult } from "@/lib/types";

const match = (id: string, winnerTo?: string): MatchResult => ({
  id,
  team1: "A",
  team2: "B",
  score1: 0,
  score2: 0,
  winnerTo,
});

describe("computeBracketLayout", () => {
  it("keeps a 2→2 drop-in round aligned before merging 2→1", () => {
    const layout = computeBracketLayout([
      { matches: [match("a", "c"), match("b", "d")] },
      { matches: [match("c", "e"), match("d", "e")] },
      { matches: [match("e")] },
    ], 64, 16);

    expect(layout.centers[1]).toEqual(layout.centers[0]);
    expect(layout.centers[2][0]).toBe((layout.centers[1][0] + layout.centers[1][1]) / 2);
    expect(layout.connectors).toHaveLength(4);
  });

  it("preserves an empty positional slot without shifting the remaining match", () => {
    const layout = computeBracketLayout([
      { matches: [match("a", "c"), null, match("b", "c")] },
      { matches: [match("c")] },
    ], 64, 16);

    expect(layout.centers[0][2] - layout.centers[0][0]).toBe(160);
    expect(layout.centers[1][0]).toBe((layout.centers[0][0] + layout.centers[0][2]) / 2);
    expect(layout.connectors).toHaveLength(2);
  });

  it("falls back to a stable 3→2→1 flow when imported matches have no links", () => {
    const layout = computeBracketLayout([
      { matches: [match("a"), match("b"), match("c")] },
      { matches: [match("d"), match("e")] },
      { matches: [match("f")] },
    ], 64, 16);

    expect(layout.centers[1][1]).toBeGreaterThan(layout.centers[1][0]);
    expect(layout.centers[2][0]).toBe((layout.centers[1][0] + layout.centers[1][1]) / 2);
    expect(layout.connectors).toHaveLength(5);
  });
});