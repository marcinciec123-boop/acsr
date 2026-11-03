import { describe, it, expect } from "vitest";
import { adaptCost, defaultMonthlyRunning, defaultMonthlyStaff } from "@/lib/teamFinances";
import { seededRandom } from "@/lib/contracts";

describe("stawki finansowe organizacji", () => {
  it.each([
    [1, 65_000, 55_000], [5, 65_000, 55_000],
    [6, 48_000, 42_000], [10, 48_000, 42_000],
    [11, 30_000, 26_000], [20, 30_000, 26_000],
    [21, 18_000, 16_000], [30, 18_000, 16_000],
    [31, 9_000, 10_000], [60, 9_000, 10_000],
    [61, 4_000, 5_000], [150, 4_000, 5_000],
  ])("pozycja %i ma bazę personelu %i i operacji %i", (rank, staff, running) => {
    const team = "Finance Test Club";
    const staffMultiplier = 0.65 + seededRandom(`${team}:staff`) * 0.8;
    const runningMultiplier = 0.6 + seededRandom(`${team}:run`) * 0.9;
    expect(defaultMonthlyStaff(rank, team)).toBe(Math.round(staff * staffMultiplier / 500) * 500);
    expect(defaultMonthlyRunning(rank, team)).toBe(Math.round(running * runningMultiplier / 500) * 500);
  });
});

describe("stopniowa adaptacja kosztów", () => {
  it("wzrost kosztów po awansie jest stopniowy (15% luki)", () => {
    expect(adaptCost(10_000, 30_000)).toBe(13_000);
  });
  it("cięcia po spadku są szybsze (25% luki)", () => {
    expect(adaptCost(30_000, 10_000)).toBe(25_000);
  });
});
