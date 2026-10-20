import { describe, expect, it } from "vitest";
import { countryFlag, normalizeCountry } from "@/lib/flags";

describe("country flags", () => {
  it("supports two-letter ISO codes", () => {
    expect(countryFlag("GB")).toBe("🇬🇧");
    expect(countryFlag("PT")).toBe("🇵🇹");
  });

  it("supports three-letter ISO codes missing from the old dictionary", () => {
    expect(countryFlag("GBR")).toBe("🇬🇧");
    expect(countryFlag("ZAF")).toBe("🇿🇦");
    expect(countryFlag("MAR")).toBe("🇲🇦");
    expect(countryFlag("ATA")).toBe("🇦🇶");
  });

  it("normalizes lowercase codes and surrounding whitespace", () => {
    expect(countryFlag(" gbr ")).toBe("🇬🇧");
    expect(countryFlag(" pl ")).toBe("🇵🇱");
    expect(normalizeCountry(" prt ")).toBe("PT");
  });

  it("handles UK subdivisions before rejecting non-two-letter values", () => {
    expect(countryFlag("ENG")).toBe(String.fromCodePoint(0x1f3f4, 0xe0067, 0xe0062, 0xe0065, 0xe006e, 0xe0067, 0xe007f));
    expect(countryFlag("SCO")).toBe(countryFlag("GB-SCT"));
    expect(countryFlag("WAL")).toBe(countryFlag("GB-WLS"));
  });

  it("returns the fallback for empty or malformed codes", () => {
    expect(countryFlag(null)).toBe("🏳️");
    expect(countryFlag("12")).toBe("🏳️");
    expect(countryFlag("unknown")).toBe("🏳️");
  });
});