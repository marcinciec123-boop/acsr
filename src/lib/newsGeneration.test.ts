import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("./storage", () => ({ loadFromStorage: vi.fn(), saveToStorage: vi.fn() }));
import { loadFromStorage, saveToStorage } from "./storage";
import { addEditorial, editorialNames } from "./newsEditorials";
import { isRepeatedNews } from "./newsUniqueness";

describe("news generation rules", () => {
  beforeEach(() => { vi.mocked(loadFromStorage).mockImplementation((_key, fallback) => fallback); vi.clearAllMocks(); });
  it("rejects identical posts regardless of punctuation and case", () => {
    expect(isRepeatedNews({ content: "Falcons wygrywa finał!" }, [{ content: "FALCONS wygrywa finał." }])).toBe(true);
  });
  it("rejects highly similar rewrites without blocking different topics", () => {
    const content = "Falcons zdobywa tytuł po finale turnieju przeciw rywalom ze środka tabeli rankingu utrzymując przewagę punktową przez cały sezon";
    expect(isRepeatedNews({ content: content + " dzisiaj" }, [{ content }])).toBe(true);
    expect(isRepeatedNews({ content: "Nowy zawodnik trafia na ławkę rezerwowych w innej organizacji po zakończeniu kontraktu" }, [{ content }])).toBe(false);
  });
  it("saves a newly added editorial and includes legacy authors without duplicates", () => {
    expect(addEditorial("  Redakcja Marcina  ")).toBe("Redakcja Marcina");
    expect(saveToStorage).toHaveBeenCalledWith("news_editorials", ["Redakcja Marcina"]);
    expect(editorialNames(["ACSR"], ["acsr", "Stary autor"])).toEqual(["ACSR", "Stary autor"]);
  });
});