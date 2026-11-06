import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { matchDraftKey, rankingAfterMatchConfirmation, useMatchDraft } from "./matchDraft";
import { loadFromStorage, removeFromStorage, saveToStorage } from "./storage";
import type { MatchResult, TeamData } from "./types";

vi.mock("./storage", () => ({ loadFromStorage: vi.fn((_key, fallback) => fallback), saveToStorage: vi.fn(() => true), removeFromStorage: vi.fn() }));
const match: MatchResult = { id: "m1", team1: "A", team2: "B", bo: 3, score1: 0, score2: 0 };
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

describe("isolated match editing", () => {
  it("keeps typed scores and statistics out of committed tournaments and domain events", () => {
    vi.useFakeTimers();
    const event = vi.fn();
    window.addEventListener("tournaments:update", event);
    const { result, unmount } = renderHook(() => useMatchDraft(match, "t1"));
    act(() => result.current.update({ score1: 2, maps: [{ map: "Mirage", score1: 13, score2: 4 }] }));
    expect(result.current.match.score1).toBe(2);
    expect(match.score1).toBe(0);
    expect(saveToStorage).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(400));
    expect(saveToStorage).toHaveBeenCalledTimes(1);
    expect(saveToStorage).toHaveBeenCalledWith(matchDraftKey("t1", "m1"), expect.objectContaining({ match: expect.objectContaining({ score1: 2 }) }));
    expect(event).not.toHaveBeenCalled();
    unmount();
    window.removeEventListener("tournaments:update", event);
  });
  it("restores an unfinished draft after leaving the match", () => {
    vi.mocked(loadFromStorage).mockReturnValueOnce({ base: JSON.stringify(match), match: { ...match, score1: 1 } });
    const { result, unmount } = renderHook(() => useMatchDraft(match, "t1"));
    expect(result.current.match.score1).toBe(1);
    unmount();
  });
  it("removes the draft after confirmation without re-saving it on exit", () => {
    const { result, unmount } = renderHook(() => useMatchDraft(match, "t1"));
    act(() => result.current.update({ score1: 2 }));
    act(() => result.current.clear({ ...match, score1: 2, resultConfirmed: true }));
    unmount();
    expect(removeFromStorage).toHaveBeenCalledWith(matchDraftKey("t1", "m1"));
    expect(saveToStorage).not.toHaveBeenCalled();
  });
  it("updates points by replacing the previous award, including a corrected winner", () => {
    const ranking: TeamData[] = [ { name: "A", points: 120, country: "PL", region: "EU", roster: [] }, { name: "B", points: 90, country: "PL", region: "EU", roster: [] } ];
    const previous = { ...match, score1: 2, resultConfirmed: true, pointsWinner: 20, pointsLoser: 10 };
    expect(rankingAfterMatchConfirmation(ranking, previous, previous).map(t => t.points)).toEqual([120, 90]);
    expect(rankingAfterMatchConfirmation(ranking, previous, { ...previous, score1: 0, score2: 2, pointsWinner: 30, pointsLoser: 15 }).map(t => t.points)).toEqual([85, 130]);
  });
});