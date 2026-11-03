import { describe, it, expect } from "vitest";
import { adaptCost } from "@/lib/teamFinances";

describe("stopniowa adaptacja kosztów", () => {
  it("wzrost kosztów po awansie jest stopniowy (15% luki)", () => {
    expect(adaptCost(10_000, 30_000)).toBe(13_000);
  });
  it("cięcia po spadku są szybsze (25% luki)", () => {
    expect(adaptCost(30_000, 10_000)).toBe(25_000);
  });
});
