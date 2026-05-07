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
