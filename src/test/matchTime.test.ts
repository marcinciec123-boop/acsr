import { describe, expect, it } from "vitest";
import { compareMatchesNewestFirst, getMatchTimestamp } from "@/lib/matchTime";

describe("match chronology", () => {
  it("puts the 18:00 match before the 11:00 match on the same day", () => {
    const matches = [
      { id: "early", scheduledAt: "2026-08-13T11:00" },
      { id: "late", scheduledAt: "2026-08-13T18:00" },
    ];

    expect(matches.sort(compareMatchesNewestFirst).map(match => match.id)).toEqual(["late", "early"]);
  });

  it("prefers scheduled time over playedAt", () => {
    expect(getMatchTimestamp({
      scheduledAt: "2026-08-13T18:00",
      playedAt: "2026-08-13T10:00",
    })).toBe(Date.parse("2026-08-13T18:00"));
  });
});