import { describe, expect, it } from "vitest";
import { generatedReplyParents } from "./newsReplyLinks";

describe("AI reply nick binding", () => {
  it("uses kubaa21 rather than a conflicting index", () => {
    expect(generatedReplyParents([
      { author: "JanuszTaktyki" },
      { author: "kubaa21" },
      { author: "fan", replyToAuthor: " @KUBAA21 ", replyToIndex: 0 },
    ], ["janusz", "kuba", "fan"])[2]).toBe("kuba");
  });

  it("links editorial replies and replies within the generated batch", () => {
    expect(generatedReplyParents([
      { author: "kubaa21", replyToAuthor: "Redakcja" },
      { author: "fan", replyToAuthor: "kubaa21" },
    ], ["kuba", "fan"], { author: "Redakcja", id: "editor" })).toEqual(["editor", "kuba"]);
  });

  it("keeps legacy indices tied to original IDs before filtering", () => {
    const parents = generatedReplyParents([
      { author: "removed" }, { author: "kubaa21" }, { replyToIndex: 1 },
    ], ["removed", "kuba", "reply"]);
    expect(parents[2]).toBe("kuba");
  });

  it("does not use the index for an unknown or future nickname", () => {
    expect(generatedReplyParents([
      { author: "janusz" }, { replyToAuthor: "kubaa21", replyToIndex: 0 }, { author: "kubaa21" },
    ], ["janusz", "reply", "kuba"])[1]).toBeUndefined();
  });

  it("selects the most recent previous comment from that author", () => {
    expect(generatedReplyParents([
      { author: "kubaa21" }, { author: "kubaa21" }, { replyToAuthor: "kubaa21" },
    ], ["old", "recent", "reply"])[2]).toBe("recent");
  });
});