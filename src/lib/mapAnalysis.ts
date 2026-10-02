// ===== Analiza map przed meczem (Pre-Match Hub) =====
// Wylicza statystyki map drużyn z rozegranych meczów (tylko aktywna pula)
// oraz przewidywany przebieg veto. Picki są wnioskowane z kolejności map:
// Bo3 → mapa 1 = pick drużyny 1, mapa 2 = pick drużyny 2, ostatnia = decider;
// Bo5 → mapy 1 i 3 = drużyna 1, mapy 2 i 4 = drużyna 2.

import type { MatchResult, TournamentData } from "@/lib/types";
import { loadFromStorage } from "@/lib/storage";
import { canonicalTeamName, nameKey } from "@/lib/teamRenames";
import { getMatchTimestamp } from "@/lib/matchTime";

export interface TeamMapStat {
  map: string;
  played: number;
  wins: number;
  losses: number;
  roundDiff: number;
  picks: number;
  /** Wygładzony winrate 0..1 (prior 50%) */
  strength: number;
}

export interface VetoStep {
  team: string;
  action: "ban" | "pick" | "decider";
  map: string;
}

const keyOf = (n: string) => nameKey(canonicalTeamName(n || ""));

function allMatches(): { m: MatchResult; fallback: string }[] {
  const tours = loadFromStorage<TournamentData[]>("tournaments_data", []);
  const out: { m: MatchResult; fallback: string }[] = [];
  for (const t of Array.isArray(tours) ? tours : []) {
    for (const p of t.phases || []) {
      (p.bracket || []).forEach(m => out.push({ m, fallback: t.startDate }));
      (p.groups || []).forEach(g => g.matches.forEach(m => out.push({ m, fallback: t.startDate })));
    }
  }
  return out;
}

function pickerIndex(bo: number, idx: number, total: number): 1 | 2 | null {
  if (bo === 3 && total >= 2) return idx === 0 ? 1 : idx === 1 ? 2 : null;
  if (bo === 5) return idx === 0 || idx === 2 ? 1 : idx === 1 || idx === 3 ? 2 : null;
  return null;
}

/** Statystyki map drużyny w aktywnej puli. `sinceTs` = 0 → cała historia. */
export function computeTeamMapStats(
  team: string,
  activeMaps: string[],
  sinceTs: number,
  untilTs: number,
  excludeMatchId?: string,
): TeamMapStat[] {
  const tk = keyOf(team);
  const stats = new Map<string, TeamMapStat>();
  activeMaps.forEach(map => stats.set(map, { map, played: 0, wins: 0, losses: 0, roundDiff: 0, picks: 0, strength: 0.5 }));

  for (const { m, fallback } of allMatches()) {
    if (m.id === excludeMatchId || !m.maps?.length) continue;
    const side = keyOf(m.team1) === tk ? 1 : keyOf(m.team2) === tk ? 2 : 0;
    if (!side) continue;
    const ts = getMatchTimestamp({ scheduledAt: m.scheduledAt, playedAt: m.playedAt, fallbackDate: fallback });
    if (sinceTs && ts && ts < sinceTs) continue;
    if (untilTs && ts && ts > untilTs) continue;
    const bo = m.bo || 1;
    m.maps.forEach((mp, idx) => {
      const s = stats.get(mp.map);
      if (!s) return;
      const own = side === 1 ? mp.score1 : mp.score2;
      const opp = side === 1 ? mp.score2 : mp.score1;
      if ((own || 0) + (opp || 0) === 0 || own === opp) return; // nierozegrana
      s.played++;
      if (own > opp) s.wins++; else s.losses++;
      s.roundDiff += own - opp;
      if (pickerIndex(bo, idx, m.maps!.length) === side) s.picks++;
    });
  }
  stats.forEach(s => { s.strength = (s.wins + 1) / (s.played + 2); });
  return activeMaps.map(map => stats.get(map)!);
}

/** Najbardziej prawdopodobny permaban: mapa najrzadziej grana, potem najsłabsza. */
export function guessPermaban(stats: TeamMapStat[]): string | null {
  if (!stats.length) return null;
  const sorted = [...stats].sort((a, b) => a.played - b.played || a.strength - b.strength || a.roundDiff - b.roundDiff);
  return sorted[0].map;
}

export function vetoSequence(bo: number, team1: string, team2: string): { team: string; action: "ban" | "pick" }[] {
  const b = (t: string) => ({ team: t, action: "ban" as const });
  const p = (t: string) => ({ team: t, action: "pick" as const });
  if (bo === 1) return Array.from({ length: 10 }, (_, i) => b(i % 2 === 0 ? team1 : team2));
  if (bo === 3) return [b(team1), b(team2), p(team1), p(team2), b(team1), b(team2), b(team1), b(team2)];
  return [b(team1), b(team2), p(team1), p(team2), p(team1), p(team2), b(team1), b(team2)];
}

/** Symulacja veto: ban = mapa, gdzie przewaga rywala największa; pick = gdzie własna przewaga największa. */
export function predictVeto(
  team1: string,
  team2: string,
  bo: number,
  activeMaps: string[],
  s1: TeamMapStat[],
  s2: TeamMapStat[],
): VetoStep[] {
  const get = (arr: TeamMapStat[], map: string) => arr.find(x => x.map === map);
  const score = (own: TeamMapStat | undefined, opp: TeamMapStat | undefined) => {
    const o = own?.strength ?? 0.5, r = opp?.strength ?? 0.5;
    const exp = Math.min(own?.played ?? 0, 10) * 0.01;
    return o - r + exp;
  };
  const mapsNeeded = bo === 1 ? 1 : bo;
  let avail = [...activeMaps];
  const out: VetoStep[] = [];
  let picks = 0;
  for (const step of vetoSequence(bo, team1, team2)) {
    if (avail.length <= mapsNeeded - picks) break;
    const isT1 = step.team === team1;
    const own = isT1 ? s1 : s2, opp = isT1 ? s2 : s1;
    let best = avail[0], bestVal = -Infinity;
    for (const map of avail) {
      const adv = score(get(own, map), get(opp, map));
      const val = step.action === "pick" ? adv : -adv;
      if (val > bestVal) { bestVal = val; best = map; }
    }
    out.push({ team: step.team, action: step.action, map: best });
    avail = avail.filter(m => m !== best);
    if (step.action === "pick") picks++;
  }
  while (picks < mapsNeeded && avail.length) {
    out.push({ team: "", action: "decider", map: avail.shift()! });
    picks++;
  }
  return out;
}
