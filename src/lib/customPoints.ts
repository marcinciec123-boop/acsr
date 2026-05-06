import type { TournamentData } from "./types";
import { getPointsForPlacement } from "@/data/tournaments";

export type PointsBucket = "1" | "2" | "3-4" | "5-8" | "9-16" | "17-32" | "33+";
export const POINTS_BUCKETS: PointsBucket[] = ["1", "2", "3-4", "5-8", "9-16", "17-32", "33+"];

export const bucketForPlacement = (placement: number): PointsBucket => {
  if (placement === 1) return "1";
  if (placement === 2) return "2";
  if (placement <= 4) return "3-4";
  if (placement <= 8) return "5-8";
  if (placement <= 16) return "9-16";
  if (placement <= 32) return "17-32";
  return "33+";
};

export const getDefaultPointsForBucket = (
  tier: string,
  bucket: PointsBucket,
  format: "knockout" | "league" = "knockout"
): number => {
  const placement = ({ "1": 1, "2": 2, "3-4": 3, "5-8": 5, "9-16": 9, "17-32": 17, "33+": 33 } as const)[bucket];
  return getPointsForPlacement(tier, placement, format);
};

/** Compute points for a placement using customPoints if set, else default tier-based. */
export const resolvePoints = (t: TournamentData, placement: number): number => {
  const bucket = bucketForPlacement(placement);
  const custom = t.customPoints?.[bucket];
  if (custom !== undefined && custom !== null) return custom;
  const fmt = t.format.toLowerCase().includes("league") ? "league" : "knockout";
  return getDefaultPointsForBucket(t.tier, bucket, fmt);
};
