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
  /** Bany z zapisanych map veto */
  bans: number;
  /** Bany jako pierwszy ban drużyny (permaban) */
  firstBans: number;
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
      (p.groups || []).forEach(g => (g.matches || []).forEach(m => out.push({ m, fallback: t.startDate })));
    }
    const seen = new Set(out.map(x => x.m.id));
    ((t as any).matches || []).forEach((m: MatchResult) => { if (!seen.has(m.id)) out.push({ m, fallback: t.startDate }); });
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
  activeMaps.forEach(map => stats.set(map, { map, played: 0, wins: 0, losses: 0, roundDiff: 0, picks: 0, bans: 0, firstBans: 0, strength: 0.5 }));

  for (const { m, fallback } of allMatches()) {
    if (m.id === excludeMatchId) continue;
    const side = keyOf(m.team1) === tk ? 1 : keyOf(m.team2) === tk ? 2 : 0;
    if (!side) continue;
    const ts = getMatchTimestamp({ scheduledAt: m.scheduledAt, playedAt: m.playedAt, fallbackDate: fallback }) || 0;
    if (sinceTs && (!ts || ts < sinceTs)) continue;
    if (untilTs && ts && ts > untilTs) continue;
    const bo = m.bo || 1;
    const veto = Array.isArray(m.veto) && m.veto.length ? m.veto : null;
    if (veto) {
      let first = true;
      for (const v of veto) {
        if (v.team !== side) continue;
        const s = stats.get(v.map);
        if (v.action === "ban") { if (s) { s.bans++; if (first) s.firstBans++; } first = false; }
        else if (v.action === "pick" && s) s.picks++;
      }
    }
    if (!m.maps?.length) continue;
    m.maps.forEach((mp, idx) => {
      const s = stats.get(mp.map);
      if (!s) return;
      const own = side === 1 ? mp.score1 : mp.score2;
      const opp = side === 1 ? mp.score2 : mp.score1;
      if ((own || 0) + (opp || 0) === 0 || own === opp) return; // nierozegrana
      s.played++;
      if (own > opp) s.wins++; else s.losses++;
      s.roundDiff += own - opp;
      if (!veto && pickerIndex(bo, idx, m.maps!.length) === side) s.picks++;
    });
  }
  stats.forEach(s => { s.strength = (s.wins + 1) / (s.played + 2); });
  return activeMaps.map(map => stats.get(map)!);
}

/** Permaban: najczęstszy pierwszy ban z zapisanych veto; bez veto — tylko przy wystarczającej próbie. */
export function guessPermaban(stats: TeamMapStat[]): string | null {
  if (!stats.length) return null;
  const vetoed = [...stats].sort((a, b) => b.firstBans - a.firstBans || b.bans - a.bans);
  if (vetoed[0].firstBans >= 2 || (vetoed[0].bans >= 2 && vetoed[0].bans > (vetoed[1]?.bans ?? 0))) return vetoed[0].map;
  const total = stats.reduce((n, s) => n + s.played, 0);
  if (total < 6) return null;
  const sorted = [...stats].sort((a, b) => a.played - b.played || a.strength - b.strength || a.roundDiff - b.roundDiff);
  return sorted[0].played === 0 ? sorted[0].map : null;
}

export type VetoSeqStep = { team: 1 | 2; action: "ban" | "pick" };

/** Kolejność veto. Bo3: B B P P, potem bany do 1 mapy. Bo5: B B P P B B P P, potem bany. Bo1: same bany. */
export function vetoSequence(bo: number, poolSize: number): VetoSeqStep[] {
  const head: VetoSeqStep[] = bo === 3
    ? [{ team: 1, action: "ban" }, { team: 2, action: "ban" }, { team: 1, action: "pick" }, { team: 2, action: "pick" }]
    : bo === 5
      ? [{ team: 1, action: "ban" }, { team: 2, action: "ban" }, { team: 1, action: "pick" }, { team: 2, action: "pick" },
         { team: 1, action: "ban" }, { team: 2, action: "ban" }, { team: 1, action: "pick" }, { team: 2, action: "pick" }]
      : [];
  const out = head.slice(0, Math.max(0, poolSize - 1));
  let t: 1 | 2 = 1;
  while (out.length < poolSize - 1) { out.push({ team: t, action: "ban" }); t = t === 1 ? 2 : 1; }
  return out;
}

/** Symulacja veto: ban = mapa, gdzie przewaga rywala największa (preferuje znane permabany); pick = własna przewaga. */
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
    const exp = Math.min(own?.played ?? 0, 10) * 0.01 + Math.min(own?.picks ?? 0, 5) * 0.02;
    return o - r + exp - Math.min(own?.bans ?? 0, 5) * 0.03;
  };
  let avail = [...activeMaps];
  const out: VetoStep[] = [];
  for (const step of vetoSequence(bo, activeMaps.length)) {
    if (avail.length <= 1) break;
    const own = step.team === 1 ? s1 : s2, opp = step.team === 1 ? s2 : s1;
    let best = avail[0], bestVal = -Infinity;
    for (const map of avail) {
      const adv = score(get(own, map), get(opp, map));
      const val = step.action === "pick" ? adv : -adv;
      if (val > bestVal) { bestVal = val; best = map; }
    }
    out.push({ team: step.team === 1 ? team1 : team2, action: step.action, map: best });
    avail = avail.filter(m => m !== best);
  }
  if (avail.length) out.push({ team: "", action: "decider", map: avail[0] });
  return out;
}

// ===== Head-to-head =====
export interface H2HMeeting { id: string; tournament: string; ts: number; s1: number; s2: number; winner: 1 | 2; maps: { map: string; s1: number; s2: number }[] }
export interface H2HSummary {
  meetings: H2HMeeting[]; // najnowsze najpierw
  wins1: number; wins2: number;
  maps1: number; maps2: number;
  rounds1: number; rounds2: number;
  streak: { side: 1 | 2; count: number } | null;
  mapRecord: { map: string; w1: number; w2: number }[];
}

export function computeH2H(team1: string, team2: string, excludeMatchId?: string): H2HSummary {
  const k1 = keyOf(team1), k2 = keyOf(team2);
  const tours = loadFromStorage<TournamentData[]>("tournaments_data", []);
  const meetings: H2HMeeting[] = [];
  for (const t of Array.isArray(tours) ? tours : []) {
    const list: MatchResult[] = [];
    for (const p of t.phases || []) {
      (p.bracket || []).forEach(m => list.push(m));
      (p.groups || []).forEach(g => (g.matches || []).forEach(m => list.push(m)));
    }
    const seen = new Set(list.map(m => m.id));
    ((t as any).matches || []).forEach((m: MatchResult) => { if (!seen.has(m.id)) list.push(m); });
    for (const m of list) {
      if (m.id === excludeMatchId) continue;
      const a = keyOf(m.team1), b = keyOf(m.team2);
      const flip = a === k2 && b === k1;
      if (!(flip || (a === k1 && b === k2))) continue;
      const s1 = flip ? m.score2 : m.score1, s2 = flip ? m.score1 : m.score2;
      if ((s1 || 0) === (s2 || 0)) continue;
      const maps = (m.maps || [])
        .map(mp => ({ map: mp.map, s1: flip ? mp.score2 : mp.score1, s2: flip ? mp.score1 : mp.score2 }))
        .filter(mp => (mp.s1 || 0) + (mp.s2 || 0) > 0 && mp.s1 !== mp.s2);
      meetings.push({
        id: m.id, tournament: t.name, s1, s2, winner: s1 > s2 ? 1 : 2, maps,
        ts: getMatchTimestamp({ scheduledAt: m.scheduledAt, playedAt: m.playedAt, fallbackDate: t.startDate }) || 0,
      });
    }
  }
  meetings.sort((x, y) => y.ts - x.ts);
  const r: H2HSummary = { meetings, wins1: 0, wins2: 0, maps1: 0, maps2: 0, rounds1: 0, rounds2: 0, streak: null, mapRecord: [] };
  const mr = new Map<string, { map: string; w1: number; w2: number }>();
  for (const mt of meetings) {
    if (mt.winner === 1) r.wins1++; else r.wins2++;
    const bo1 = mt.maps.length === 1 && Math.max(mt.s1, mt.s2) > 1;
    if (bo1 || !mt.maps.length) { if (mt.winner === 1) r.maps1++; else r.maps2++; }
    else { r.maps1 += mt.s1; r.maps2 += mt.s2; }
    for (const mp of mt.maps) {
      r.rounds1 += mp.s1; r.rounds2 += mp.s2;
      const e = mr.get(mp.map) || { map: mp.map, w1: 0, w2: 0 };
      if (mp.s1 > mp.s2) e.w1++; else e.w2++;
      mr.set(mp.map, e);
    }
  }
  if (meetings.length) {
    const side = meetings[0].winner; let c = 0;
    for (const mt of meetings) { if (mt.winner !== side) break; c++; }
    r.streak = { side, count: c };
  }
  r.mapRecord = [...mr.values()].sort((a, b) => (b.w1 + b.w2) - (a.w1 + a.w2));
  return r;
}
