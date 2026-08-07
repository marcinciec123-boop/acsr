// ===== Numeracja meczów w turnieju =====
// Stabilny, kolejny numer dla każdego meczu w turnieju (fazy -> grupy -> bracket).
// Używane w wykazach meczów i masowej edycji terminów dla lepszej organizacji.

import type { TournamentData } from "./types";

export const buildMatchNumbers = (t: TournamentData): Record<string, number> => {
  const out: Record<string, number> = {};
  let n = 0;
  t.phases?.forEach(p => {
    (p.groups || []).forEach(g => {
      g.matches?.forEach(m => {
        if (out[m.id] === undefined) out[m.id] = ++n;
      });
    });
    (p.bracket || []).forEach(m => {
      if (out[m.id] === undefined) out[m.id] = ++n;
    });
  });
  return out;
};

export const formatMatchNumber = (n?: number) => (n ? `#${n}` : "");
