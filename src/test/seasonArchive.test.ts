import { describe, expect, it } from "vitest";
import { joinShards, shardList } from "@/lib/diskStore";

const list = [
  { id: "c", startDate: "2027-02-01", name: "New" },
  { id: "a", startDate: "2025-05-01", name: "Old" },
  { id: "b", startDate: "2026-03-01", name: "Mid" },
  { id: "d", name: "NoDate" },
];

describe("season archive shards", () => {
  it("splits tournaments into one file per year and restores the exact list", () => {
    const shards = shardList(JSON.stringify(list))!;
    expect(Object.keys(shards).sort()).toEqual(["2025", "2026", "2027", "order", "undated"]);
    expect(JSON.parse(joinShards(shards)!)).toEqual(list);
  });
  it("editing a current tournament leaves past-year files unchanged", () => {
    const before = shardList(JSON.stringify(list))!;
    const after = shardList(JSON.stringify(list.map(t => t.id === "c" ? { ...t, name: "Edited" } : t)))!;
    expect(after["2025"]).toBe(before["2025"]);
    expect(after["2026"]).toBe(before["2026"]);
    expect(after["2027"]).not.toBe(before["2027"]);
  });
});
