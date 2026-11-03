import { describe, expect, it, vi } from "vitest";
import { createWriteQueue } from "@/lib/diskStore";

describe("disk write queue", () => {
  it("coalesces repeated writes of one key into the last value", async () => {
    const write = vi.fn(async () => undefined);
    const remove = vi.fn(async () => undefined);
    const q = createWriteQueue(write, remove, 10_000);
    q.set("a", "1"); q.set("a", "2"); q.set("a", "3");
    await q.flush();
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("a", "3");
  });
  it("a delete after a write removes instead of writing", async () => {
    const write = vi.fn(async () => undefined);
    const remove = vi.fn(async () => undefined);
    const q = createWriteQueue(write, remove, 10_000);
    q.set("b", "x"); q.delete("b");
    await q.flush();
    expect(write).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith("b");
  });
});
