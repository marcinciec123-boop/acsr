import { describe, it, expect } from "vitest";
import { addMatchToRound, moveRound, orderRounds, roundSide } from "./bracketRounds";
import type { MatchResult } from "./types";

const m = (id: string, round: string, bracketSlot?: string): MatchResult =>
  ({ id, team1: "", team2: "", score1: 0, score2: 0, bo: 3, round, ...(bracketSlot ? { bracketSlot } : {}) }) as MatchResult;
const base = (id: string) => ({ id, team1: "", team2: "", score1: 0, score2: 0, bo: 3 }) as Omit<MatchResult, "round" | "bracketSlot">;

const de = [
  m("u1", "UB R1", "UB-R1-M1"), m("u2", "UB R1", "UB-R1-M2"),
  m("u3", "UB Final", "UB-R2-M1"),
  m("l1", "LB R1", "LB-R1-M1"),
  m("gf", "Grand Final", "GF"),
];

describe("bracketRounds", () => {
  it("adds a match inside its round with the next slot, not at the bottom", () => {
    const out = addMatchToRound(de, "UB R1", base("x"));
    expect(out.map(x => x.id)).toEqual(["u1", "u2", "x", "u3", "l1", "gf"]);
    expect(out[2].bracketSlot).toBe("UB-R1-M3");
  });

  it("new lower round lands after the last lower round with an LB slot", () => {
    const out = addMatchToRound(de, "LB R2", base("x"), "lower");
    expect(out.map(x => x.id)).toEqual(["u1", "u2", "u3", "l1", "x", "gf"]);
    expect(out[4].bracketSlot).toBe("LB-R2-M1");
  });

  it("upper decider is placed in the upper row before the Grand Final", () => {
    const out = addMatchToRound(de, "Upper Bracket Decider", base("d"));
    const d = out.find(x => x.id === "d")!;
    expect(roundSide([d])).toBe("upper");
    const grouped = { "UB R1": [], "Upper Bracket Decider": [d], "Grand Final": [de[4]], "UB Final": [] } as Record<string, MatchResult[]>;
    expect(orderRounds(["Grand Final", "Upper Bracket Decider", "UB R1", "UB Final"], grouped))
      .toEqual(["UB R1", "UB Final", "Upper Bracket Decider", "Grand Final"]);
  });

  it("lower decider stays in the lower row", () => {
    expect(roundSide([m("d", "Lower Bracket Decider")])).toBe("lower");
  });

  it("moving a round swaps whole rounds and their slot numbers", () => {
    const out = moveRound(de, "UB Final", -1);
    expect(out.map(x => x.id)).toEqual(["u3", "u1", "u2", "l1", "gf"]);
    expect(out[0].bracketSlot).toBe("UB-R1-M1");
    expect(out[1].bracketSlot).toBe("UB-R2-M1");
  });

  it("does not move a round across to the other side", () => {
    expect(moveRound(de, "LB R1", -1)).toBe(de);
  });
});

import { isThirdPlaceRound as isThird } from "./bracketRounds";
describe("third place names", () => {
  it("recognizes Polish and English names", () => {
    expect(isThird("Mecz o 3. miejsce")).toBe(true);
    expect(isThird("Bronze Match")).toBe(true);
    expect(isThird("Semifinal")).toBe(false);
  });
});
