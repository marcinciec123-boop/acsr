// ===== Czyszczenie "szkieletu TBD" ze Swissa =====
//
// Wcześniejsza wersja generatora dopisywała nieistniejące rundy TBD również do
// zakończonych (historycznych) turniejów. Ta migracja usuwa wszystkie mecze
// TBD vs TBD z faz Swiss w turniejach, które nie są już w toku, oraz z rund,
// w których wszystkie realne mecze zostały już rozegrane.

import { loadFromStorage, saveToStorage } from "./storage";
import type { TournamentData, MatchResult } from "./types";
import { isPlaceholder } from "./teamHelpers";

const isTbd = (m: MatchResult) => isPlaceholder(m.team1) || isPlaceholder(m.team2);

export function cleanupSwissSkeletons(): number {
  const tournaments = loadFromStorage<TournamentData[]>("tournaments_data", []);
  if (!tournaments.length) return 0;

  let removed = 0;
  const next = tournaments.map(t => {
    if (t.status !== "completed") return t;
    const phases = (t.phases || []).map(p => {
      if (!p.bracket?.length) return p;
      const kept = p.bracket.filter(m => {
        const drop = isTbd(m) && (m.score1 + m.score2) === 0;
        if (drop) removed += 1;
        return !drop;
      });
      return kept.length === p.bracket.length ? p : { ...p, bracket: kept };
    });
    return { ...t, phases };
  });

  if (removed > 0) saveToStorage("tournaments_data", next);
  return removed;
}
