import { teamDatabase } from "@/data/tournaments";
import { countryFlag } from "@/lib/flags";

const teamMap = new Map(teamDatabase.map(t => [t.name, t]));

export function getTeamCountry(name: string): string {
  return teamMap.get(name)?.country || "";
}

export function getTeamRegion(name: string): string {
  return teamMap.get(name)?.region || "";
}

export function getTeamFlag(name: string): string {
  const c = getTeamCountry(name);
  return c ? countryFlag(c) : "";
}

export function getTeamPoints(name: string): number {
  return teamMap.get(name)?.points || 0;
}

/** Returns a short tag based on team name (first 4 letters uppercased), used as a faux logo. */
export function teamTag(name: string): string {
  if (!name) return "?";
  const cleaned = name.replace(/[^A-Za-z0-9]/g, "");
  return cleaned.slice(0, 4).toUpperCase() || "?";
}

export function isPlaceholder(name: string | undefined | null): boolean {
  if (!name) return true;
  const u = name.toUpperCase();
  return u === "BYE" || u === "TBD" || u.startsWith("TBD-") || u.startsWith("TBD ");
}
