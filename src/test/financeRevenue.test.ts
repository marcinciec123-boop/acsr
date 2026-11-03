import { describe, expect, it } from "vitest";
import { mediaRightsFor, sponsorBonusFor, stickerMoneyFor } from "@/lib/teamFinances";

describe("event revenue", () => {
  it("every Tier S/A participant gets TV money, lower tiers none", () => {
    expect(mediaRightsFor("S", 16)).toBe(60_000);
    expect(mediaRightsFor("A", 16)).toBe(30_000);
    expect(mediaRightsFor("B", 1)).toBe(0);
  });
  it("sponsor bonus only for top 4", () => {
    expect(sponsorBonusFor("S", 1)).toBe(50_000);
    expect(sponsorBonusFor("S", 5)).toBe(0);
  });
  it("every Major participant gets sticker money", () => {
    expect(stickerMoneyFor(16)).toBe(150_000);
    expect(stickerMoneyFor(1)).toBe(400_000);
  });
});
