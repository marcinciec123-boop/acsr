import type { TournamentData } from "./types";
import { getPointsForPlacement } from "@/data/tournaments";

/** Compute points for a placement using customPoints (per-placement) if set, else default tier-based. */
export const resolvePoints = (t: TournamentData, placement: number): number => {
  const custom = t.customPoints?.[String(placement)];
  if (custom !== undefined && custom !== null) return custom;
  const fmt = t.format.toLowerCase().includes("league") ? "league" : "knockout";
  return getPointsForPlacement(t.tier, placement, fmt);
};

/** Default points for a placement (tier-based), used to pre-fill inputs. */
export const getDefaultPoints = (
  tier: string,
  placement: number,
  format: "knockout" | "league" = "knockout",
): number => getPointsForPlacement(tier, placement, format);

/** Copy configured rewards for both single and regional tournaments, including qualifiers. */
export const configuredRewards = (
  pointsEnabled: boolean,
  points: Record<string, number>,
  prizesEnabled: boolean,
  prizes: Record<string, number>,
): Pick<TournamentData, "customPoints" | "customPrizes"> => ({
  customPoints: pointsEnabled ? { ...points } : undefined,
  customPrizes: prizesEnabled ? { ...prizes } : undefined,
});

export const canEditQualifierPoints = (t: TournamentData): boolean =>
  t.kind === "qualifier" && !t.resultsConfirmed && (t.status === "upcoming" || t.status === "live");

export const qualifierPointsPatch = (
  t: TournamentData,
  points: Record<string, number>,
): Partial<TournamentData> => canEditQualifierPoints(t) ? { customPoints: { ...points } } : {};
