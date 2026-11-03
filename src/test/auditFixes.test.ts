import { describe, it, expect, vi } from "vitest";
import { createWriteQueue } from "@/lib/diskStore";
import { normalizeGSLDoubleElimGroup, propagateGSL4Group } from "@/lib/tournamentBuilder";
import type { MatchResult } from "@/lib/types";

const m = (slot: string, team1: string, team2: string, score1 = 0, score2 = 0, extra: Partial<MatchResult> = {}): MatchResult =>
  ({ id: slot, bracketSlot: slot, team1, team2, score1, score2, bo: 1, round: slot, ...extra } as MatchResult);

describe("audit fixes", () => {
  it("a failed disk write is retried instead of lost", async () => {
    let fail = true;
    const write = vi.fn(async () => { if (fail) throw new Error("disk full"); });
    const q = createWriteQueue(write, async () => {}, 10_000);
    q.set("k", "v");
    await q.flush();
    expect(q.size()).toBe(1);
    fail = false;
    await q.flush();
    expect(q.size()).toBe(0);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("new pairing in a GSL group drops the old maps", () => {
    const maps = [{ map: "Mirage", score1: 13, score2: 5 }] as MatchResult["maps"];
    const out = propagateGSL4Group([
      m("GSL-OM1", "B", "A", 13, 2), m("GSL-OM2", "C", "D", 13, 4),
      m("GSL-WM", "A", "C", 13, 5, { maps, resultConfirmed: true }),
      m("GSL-LM", "", ""), m("GSL-DM", "", ""),
    ]);
    const wm = out.find(x => x.bracketSlot === "GSL-WM")!;
    expect(wm.team1).toBe("B");
    expect(wm.maps).toBeUndefined();
    expect(wm.resultConfirmed).toBe(false);
  });

  it("played legacy decider match is never removed", () => {
    const out = normalizeGSLDoubleElimGroup([m("IEM-LB-FINAL", "A", "B", 13, 9)], 2);
    expect(out.some(x => x.bracketSlot === "IEM-LB-FINAL")).toBe(true);
  });
});
