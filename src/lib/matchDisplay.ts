// ===== Match display helpers =====
// For Bo1 matches we historically stored the series result (1:0) in
// `score1`/`score2` and put the actual round score in `mapScore1`/`mapScore2`
// (legacy) or in `maps[0].score1`/`maps[0].score2` (newer). The user always
// wants to *see* the round score for Bo1 (e.g. 13:5), not "1:0".
//
// For Bo3/Bo5, `score1`/`score2` are the maps-won and that's what we want.

interface DisplayableMatch {
  bo?: number;
  score1?: number;
  score2?: number;
  mapScore1?: number;
  mapScore2?: number;
  maps?: { score1?: number; score2?: number }[];
}

/** Returns [displayScore1, displayScore2] respecting Bo1 round-score convention. */
export function getDisplayScore(m: DisplayableMatch | null | undefined): [number, number] {
  if (!m) return [0, 0];
  const bo = m.bo ?? 1;
  const s1 = m.score1 ?? 0;
  const s2 = m.score2 ?? 0;
  if (bo === 1) {
    // Prefer per-map data when present.
    const map = m.maps?.[0];
    if (map && ((map.score1 ?? 0) + (map.score2 ?? 0)) > 0) {
      return [map.score1 ?? 0, map.score2 ?? 0];
    }
    if (typeof m.mapScore1 === "number" && typeof m.mapScore2 === "number"
        && (m.mapScore1 + m.mapScore2) > 0) {
      return [m.mapScore1, m.mapScore2];
    }
    // Legacy row where map data is unavailable — score1/score2 already ARE the
    // round score (new convention) OR the series 1:0 (old sim); either way we
    // display them directly. Unplayed = 0:0.
    return [s1, s2];
  }
  return [s1, s2];
}

/** Convenience formatter: "13:5" / "2:1" etc. Returns empty when unplayed. */
export function formatMatchScore(m: DisplayableMatch | null | undefined, sep = ":"): string {
  const [a, b] = getDisplayScore(m);
  if (a === 0 && b === 0) return "";
  return `${a}${sep}${b}`;
}
