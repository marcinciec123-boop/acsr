import { describe, expect, it } from "vitest";
import { buildTrendSeries, isPlayableLocalDate } from "@/lib/rankingHistory";

describe("wykres historii rankingu", () => {
  it("trzyma wartość do dnia przed kolejną migawką", () => {
    const out = buildTrendSeries([
      { date: "2025-09-03", points: 225, rank: 52 },
      { date: "2025-10-30", points: 400, rank: 35 },
      { date: "2026-02-08", points: 400, rank: 35 },
    ]);
    expect(out.map(p => [p.date, p.rank])).toEqual([
      ["2025-09-03", 52],
      ["2025-10-29", 52],
      ["2025-10-30", 35],
      ["2026-02-08", 35],
    ]);
  });

  it("zawężony zakres zaczyna się wartością obowiązującą w tym dniu", () => {
    const out = buildTrendSeries([
      { date: "2025-01-01", points: 100, rank: 20 },
      { date: "2025-10-30", points: 300, rank: 10 },
    ], "2025-06-01");
    expect(out[0]).toMatchObject({ date: "2025-06-01", rank: 20 });
  });

  it("pomija lokalne wpisy z epoki arkuszy", () => {
    expect(isPlayableLocalDate("2024-03-31", "2025-10-30", "2026-02-08")).toBe(false);
    expect(isPlayableLocalDate("2025-11-30", "2025-10-30", "2026-02-08")).toBe(false);
    expect(isPlayableLocalDate("2026-01-27", "2025-10-30", "2026-02-08")).toBe(true);
    expect(isPlayableLocalDate("2026-03-01", "2025-10-30", "2026-02-08")).toBe(false);
  });
});
