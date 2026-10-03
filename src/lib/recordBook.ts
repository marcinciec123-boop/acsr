// ===== Księga Rekordów ACSR =====
// Rekordy all-time liczone na bieżąco z meczów zapisanych w lokalnym zapisie
// użytkownika (każdy zapis ma własne rekordy, łącznie z wcześniej rozegranymi).

import type { TournamentData, MatchResult } from "./types";
import { calculateRating } from "./playerStats";
import { loadStatsTournaments, nationalTeamNames, computePortalStats } from "./statsPortal";
import { parsePrizePool } from "./prizeDistribution";
import { getMatchTimestamp } from "./matchTime";

export type RecordCategory = "player-map" | "player-match" | "player-career" | "team" | "map" | "tournament";

export interface RecordEntry {
  value: number;
  display: string;
  player?: string;
  team?: string;
  context?: string;
  date?: string;
  tournamentId?: string;
  matchId?: string;
}

export interface RecordDef {
  id: string;
  category: RecordCategory;
  title: string;
  desc?: string;
  entries: RecordEntry[];
}

export const CATEGORY_LABEL: Record<RecordCategory, string> = {
  "player-map": "Gracze — pojedyncza mapa",
  "player-match": "Gracze — pojedynczy mecz",
  "player-career": "Gracze — kariera",
  team: "Drużyny",
  map: "Mapy i mecze",
  tournament: "Turnieje",
};

const TOP = 5;
const MIN_MAPS_CAREER = 20;
const MIN_MAPS_TEAM_MAP = 10;

// Rekordy ratingowe sprzed aktualizacji systemu ratingowego (do 2026-10-03 włącznie)
// z wartościami poza zakresem 0.45–2.00 są pomijane; nowe mecze liczą się normalnie.
const RATING_FIX_CUTOFF = new Date(2026, 9, 4).getTime(); // 2026-10-04 00:00 lokalnie
const RATING_MIN = 0.45;
const RATING_MAX = 2.0;
function ratingCounts(rating: number, ts: number): boolean {
  if (ts < RATING_FIX_CUTOFF && (rating > RATING_MAX || rating < RATING_MIN)) return false;
  return true;
}

interface FlatMatch { m: MatchResult; t: TournamentData; ts: number }

function collect(list: TournamentData[], skip: Set<string>): FlatMatch[] {
  const out: FlatMatch[] = [];
  for (const t of list) {
    const ms: MatchResult[] = [
      ...(t.phases || []).flatMap(p => [...(p.bracket || []), ...((p.groups || []).flatMap(g => g.matches || []))]),
      ...(t.matches || []),
    ];
    for (const m of ms) {
      if (!m.team1 || !m.team2 || m.team1 === "BYE" || m.team2 === "BYE") continue;
      if (skip.has(m.team1.trim()) || skip.has(m.team2.trim())) continue;
      if ((m.score1 || 0) + (m.score2 || 0) <= 0) continue;
      let ts = 0;
      try { ts = getMatchTimestamp(m) || 0; } catch { ts = 0; }
      if (!ts) {
        const raw = m.playedAt || m.scheduledAt || t.startDate;
        const p = raw ? new Date(raw).getTime() : NaN;
        ts = Number.isFinite(p) ? p : 0;
      }
      out.push({ m, t, ts });
    }
  }
  return out.sort((a, b) => a.ts - b.ts);
}

const fmtDate = (ts: number) => (ts ? new Date(ts).toISOString().slice(0, 10) : undefined);
const f2 = (n: number) => n.toFixed(2);
const f1 = (n: number) => n.toFixed(1);
const pct = (n: number) => `${n.toFixed(1)}%`;

function top(entries: RecordEntry[], asc = false): RecordEntry[] {
  return [...entries].sort((a, b) => (asc ? a.value - b.value : b.value - a.value)).slice(0, TOP);
}

/** Top-N bez powtórzeń tego samego posiadacza (np. kariera, serie). */
function topUnique(entries: RecordEntry[], key: (e: RecordEntry) => string, asc = false): RecordEntry[] {
  const best = new Map<string, RecordEntry>();
  for (const e of entries) {
    const k = key(e);
    const cur = best.get(k);
    if (!cur || (asc ? e.value < cur.value : e.value > cur.value)) best.set(k, e);
  }
  return top([...best.values()], asc);
}

export function computeRecordBook(): RecordDef[] {
  const tournaments = loadStatsTournaments();
  const national = nationalTeamNames();
  const matches = collect(tournaments, national);
  const defs: RecordDef[] = [];
  const add = (id: string, category: RecordCategory, title: string, entries: RecordEntry[], desc?: string) => {
    if (entries.length) defs.push({ id, category, title, entries, desc });
  };

  // ---------- zbieranie ----------
  const pMap: Record<string, RecordEntry[]> = {
    kills: [], deaths: [], assists: [], adr: [], rating: [], kd: [], lowRating: [], kast: [], ud: [], ef: [],
  };
  const pSeries: Record<string, RecordEntry[]> = { kills: [], rating: [], adr: [], deaths: [] };
  interface Career {
    team: string; maps: number; rounds: number; kills: number; deaths: number; assists: number;
    dmg: number; kast: number; ratingSum: number; k30: number; k25: number; r150: number;
    run120: number; best120: number; run120Ctx?: RecordEntry; best120Ctx?: RecordEntry;
    runPos: number; bestPos: number; zeroK: number; ace40: number; matches: Set<string>; wins: number;
  }
  const career = new Map<string, Career>();
  const getC = (name: string, team: string): Career => {
    let c = career.get(name);
    if (!c) {
      c = { team, maps: 0, rounds: 0, kills: 0, deaths: 0, assists: 0, dmg: 0, kast: 0, ratingSum: 0, k30: 0, k25: 0, r150: 0,
        run120: 0, best120: 0, runPos: 0, bestPos: 0, zeroK: 0, ace40: 0, matches: new Set(), wins: 0 };
      career.set(name, c);
    }
    c.team = team;
    return c;
  };

  interface TeamAgg {
    played: number; won: number; mapsWon: number; mapsLost: number; roundsWon: number; roundsLost: number;
    winRun: number; bestWin: number; bestWinEnd?: number; lossRun: number; bestLoss: number; bestLossEnd?: number;
    mapRun: number; bestMapRun: number; bestMapRunEnd?: number; sweeps: number; shutoutMaps: number; ots: number;
  }
  const teams = new Map<string, TeamAgg>();
  const getT = (n: string): TeamAgg => {
    let a = teams.get(n);
    if (!a) {
      a = { played: 0, won: 0, mapsWon: 0, mapsLost: 0, roundsWon: 0, roundsLost: 0, winRun: 0, bestWin: 0, lossRun: 0,
        bestLoss: 0, mapRun: 0, bestMapRun: 0, sweeps: 0, shutoutMaps: 0, ots: 0 };
      teams.set(n, a);
    }
    return a;
  };
  const teamMap = new Map<string, { team: string; map: string; w: number; l: number; run: number; best: number }>();
  const mapCount = new Map<string, { played: number; rounds: number; ots: number }>();

  const blowouts: RecordEntry[] = [];
  const longestMaps: RecordEntry[] = [];
  const longestSeries: RecordEntry[] = [];
  const comebacks: RecordEntry[] = [];
  const upsets: RecordEntry[] = [];
  const highOT: RecordEntry[] = [];
  const reverseSweeps: RecordEntry[] = [];

  for (const { m, t, ts } of matches) {
    const t1 = m.team1.trim(); const t2 = m.team2.trim();
    if (m.score1 === m.score2) continue;
    const w = m.score1 > m.score2 ? t1 : t2;
    const l = w === t1 ? t2 : t1;
    const date = fmtDate(ts);
    const base = { date, tournamentId: t.id, matchId: m.id };
    const vs = `${t1} vs ${t2} · ${t.name}`;

    // seria meczów
    const A = getT(w); const B = getT(l);
    A.played++; B.played++; A.won++;
    A.winRun++; A.lossRun = 0; if (A.winRun > A.bestWin) { A.bestWin = A.winRun; A.bestWinEnd = ts; }
    B.lossRun++; B.winRun = 0; if (B.lossRun > B.bestLoss) { B.bestLoss = B.lossRun; B.bestLossEnd = ts; }

    const maps = (m.maps || []).filter(mp => (mp.score1 || 0) + (mp.score2 || 0) > 0);
    const losingMapsW = maps.filter(mp => (w === t1 ? mp.score2 > mp.score1 : mp.score1 > mp.score2)).length;
    if (maps.length >= 2 && losingMapsW === 0) A.sweeps++;
    // reverse sweep: zwycięzca przegrał dwie pierwsze mapy w Bo5
    if (maps.length === 5) {
      const lostFirst2 = maps.slice(0, 2).every(mp => (w === t1 ? mp.score2 > mp.score1 : mp.score1 > mp.score2));
      if (lostFirst2) reverseSweeps.push({ value: 5, display: `${m.score1}:${m.score2}`, team: w, context: `od 0:2 · ${vs}`, ...base });
    }

    let seriesRounds = 0;
    const sKills = new Map<string, { k: number; d: number; dmg: number; rr: number; ratingW: number; team: string }>();

    maps.forEach((mp, mi) => {
      const rounds = (mp.score1 || 0) + (mp.score2 || 0);
      seriesRounds += rounds;
      const mw = mp.score1 > mp.score2 ? t1 : t2;
      const ml = mw === t1 ? t2 : t1;
      const ws = Math.max(mp.score1, mp.score2); const ls = Math.min(mp.score1, mp.score2);
      const mctx = `${mp.map} · ${t1} ${mp.score1}:${mp.score2} ${t2} · ${t.name}`;
      const ot = rounds > 24;
      const MA = getT(mw); const MB = getT(ml);
      MA.mapsWon++; MB.mapsLost++;
      MA.mapRun++; if (MA.mapRun > MA.bestMapRun) { MA.bestMapRun = MA.mapRun; MA.bestMapRunEnd = ts; }
      MB.mapRun = 0;
      MA.roundsWon += ws; MA.roundsLost += ls; MB.roundsWon += ls; MB.roundsLost += ws;
      if (ls === 0) MA.shutoutMaps++;
      if (ot) { MA.ots++; MB.ots++; }

      blowouts.push({ value: ws - ls, display: `${ws}:${ls}`, team: mw, context: mctx, ...base });
      longestMaps.push({ value: rounds, display: `${rounds} rund`, team: mw, context: mctx, ...base });
      if (ot) highOT.push({ value: rounds, display: `${ws}:${ls}`, team: mw, context: mctx, ...base });

      // comeback po pierwszej połowie
      if (mp.half1Score1 != null && mp.half1Score2 != null) {
        const h1w = mw === t1 ? mp.half1Score1 : mp.half1Score2;
        const h1l = mw === t1 ? mp.half1Score2 : mp.half1Score1;
        const deficit = h1l - h1w;
        if (deficit > 0) comebacks.push({ value: deficit, display: `${h1w}:${h1l} → ${ws}:${ls}`, team: mw, context: mctx, ...base });
      }

      if (mp.map) {
        const mc = mapCount.get(mp.map) || { played: 0, rounds: 0, ots: 0 };
        mc.played++; mc.rounds += rounds; if (ot) mc.ots++;
        mapCount.set(mp.map, mc);
        for (const [tm, won] of [[mw, true], [ml, false]] as const) {
          const k = `${tm}|${mp.map}`;
          const r = teamMap.get(k) || { team: tm, map: mp.map, w: 0, l: 0, run: 0, best: 0 };
          if (won) { r.w++; r.run++; r.best = Math.max(r.best, r.run); } else { r.l++; r.run = 0; }
          teamMap.set(k, r);
        }
      }

      const sides = [{ list: mp.team1Players || [], team: t1 }, { list: mp.team2Players || [], team: t2 }];
      for (const side of sides) {
        for (const p of side.list) {
          if (!p?.playerName) continue;
          const rating = p.rating ?? calculateRating({ ...p, rounds });
          const e = { player: p.playerName, team: side.team, context: mctx, ...base };
          pMap.kills.push({ ...e, value: p.kills, display: `${p.kills}` });
          pMap.deaths.push({ ...e, value: p.deaths, display: `${p.deaths}` });
          pMap.assists.push({ ...e, value: p.assists, display: `${p.assists}` });
          pMap.adr.push({ ...e, value: p.adr, display: f1(p.adr) });
          pMap.rating.push({ ...e, value: rating, display: f2(rating) });
          pMap.lowRating.push({ ...e, value: rating, display: f2(rating) });
          pMap.kd.push({ ...e, value: p.kills - p.deaths, display: `+${p.kills - p.deaths} (${p.kills}-${p.deaths})` });
          if (p.kast) pMap.kast.push({ ...e, value: p.kast, display: pct(p.kast) });
          if (p.ud) pMap.ud.push({ ...e, value: p.ud, display: `${p.ud}` });
          if (p.ef) pMap.ef.push({ ...e, value: p.ef, display: `${p.ef}` });

          const c = getC(p.playerName, side.team);
          c.maps++; c.rounds += rounds; c.kills += p.kills; c.deaths += p.deaths; c.assists += p.assists;
          c.dmg += p.adr * rounds; c.kast += p.kast || 0; c.ratingSum += rating * rounds;
          if (p.kills >= 30) c.k30++;
          if (p.kills >= 25) c.k25++;
          if (p.kills >= 40) c.ace40++;
          if (rating >= 1.5) c.r150++;
          if (p.kills === 0) c.zeroK++;
          if (!c.matches.has(m.id + t.id)) { c.matches.add(m.id + t.id); if (side.team === w) c.wins++; }
          if (rating >= 1.2) {
            c.run120++;
            if (c.run120 > c.best120) { c.best120 = c.run120; c.best120Ctx = { value: 0, display: "", ...base, context: t.name }; }
          } else c.run120 = 0;
          if (p.kills > p.deaths) { c.runPos++; c.bestPos = Math.max(c.bestPos, c.runPos); } else c.runPos = 0;

          const sk = sKills.get(p.playerName) || { k: 0, d: 0, dmg: 0, rr: 0, ratingW: 0, team: side.team };
          sk.k += p.kills; sk.d += p.deaths; sk.dmg += p.adr * rounds; sk.rr += rounds; sk.ratingW += rating * rounds;
          sKills.set(p.playerName, sk);
        }
      }
      void mi;
    });

    if (maps.length >= 2) {
      longestSeries.push({ value: seriesRounds, display: `${seriesRounds} rund`, team: w, context: `${m.score1}:${m.score2} · ${vs}`, ...base });
      for (const [player, s] of sKills) {
        const e = { player, team: s.team, context: `${maps.length} mapy · ${vs}`, ...base };
        pSeries.kills.push({ ...e, value: s.k, display: `${s.k}` });
        pSeries.deaths.push({ ...e, value: s.d, display: `${s.d}` });
        if (s.rr) {
          pSeries.rating.push({ ...e, value: s.ratingW / s.rr, display: f2(s.ratingW / s.rr) });
          pSeries.adr.push({ ...e, value: s.dmg / s.rr, display: f1(s.dmg / s.rr) });
        }
      }
    }
    void upsets;
  }

  // ---------- gracze: mapa ----------
  add("pm-kills", "player-map", "Najwięcej zabójstw na mapie", top(pMap.kills));
  add("pm-rating", "player-map", "Najwyższy rating na mapie", top(pMap.rating));
  add("pm-adr", "player-map", "Najwyższy ADR na mapie", top(pMap.adr));
  add("pm-kd", "player-map", "Najlepszy bilans K-D na mapie", top(pMap.kd));
  add("pm-assists", "player-map", "Najwięcej asyst na mapie", top(pMap.assists));
  add("pm-kast", "player-map", "Najwyższy KAST na mapie", top(pMap.kast));
  add("pm-ud", "player-map", "Najwięcej obrażeń z granatów na mapie", top(pMap.ud));
  add("pm-ef", "player-map", "Najwięcej oślepionych na mapie", top(pMap.ef));
  add("pm-deaths", "player-map", "Najwięcej zgonów na mapie", top(pMap.deaths), "Rekord niechlubny");
  add("pm-low", "player-map", "Najniższy rating na mapie", top(pMap.lowRating, true), "Rekord niechlubny");

  // ---------- gracze: mecz ----------
  add("ps-kills", "player-match", "Najwięcej zabójstw w serii (Bo3/Bo5)", top(pSeries.kills));
  add("ps-rating", "player-match", "Najwyższy rating w serii", top(pSeries.rating));
  add("ps-adr", "player-match", "Najwyższy ADR w serii", top(pSeries.adr));
  add("ps-deaths", "player-match", "Najwięcej zgonów w serii", top(pSeries.deaths), "Rekord niechlubny");

  // ---------- gracze: kariera ----------
  const cs = [...career.entries()].map(([player, c]) => ({ player, ...c }));
  const qual = cs.filter(c => c.maps >= MIN_MAPS_CAREER && c.rounds > 0);
  const ce = (c: (typeof cs)[number], value: number, display: string, context?: string): RecordEntry =>
    ({ player: c.player, team: c.team, value, display, context: context ?? `${c.maps} map` });
  add("pc-kills", "player-career", "Najwięcej zabójstw w karierze", top(cs.map(c => ce(c, c.kills, c.kills.toLocaleString("pl-PL")))));
  add("pc-maps", "player-career", "Najwięcej rozegranych map", top(cs.map(c => ce(c, c.maps, `${c.maps}`, `${c.matches.size} meczów`))));
  add("pc-wins", "player-career", "Najwięcej wygranych meczów", top(cs.map(c => ce(c, c.wins, `${c.wins}`, `z ${c.matches.size} meczów`))));
  add("pc-rating", "player-career", "Najwyższy rating w karierze", top(qual.map(c => ce(c, c.ratingSum / c.rounds, f2(c.ratingSum / c.rounds)))), `min. ${MIN_MAPS_CAREER} map`);
  add("pc-adr", "player-career", "Najwyższy ADR w karierze", top(qual.map(c => ce(c, c.dmg / c.rounds, f1(c.dmg / c.rounds)))), `min. ${MIN_MAPS_CAREER} map`);
  add("pc-kpr", "player-career", "Najwięcej zabójstw na rundę", top(qual.map(c => ce(c, c.kills / c.rounds, f2(c.kills / c.rounds)))), `min. ${MIN_MAPS_CAREER} map`);
  add("pc-kdr", "player-career", "Najlepszy stosunek K/D", top(qual.filter(c => c.deaths > 0).map(c => ce(c, c.kills / c.deaths, f2(c.kills / c.deaths)))), `min. ${MIN_MAPS_CAREER} map`);
  add("pc-kast", "player-career", "Najwyższy średni KAST", top(qual.map(c => ce(c, c.kast / c.maps, pct(c.kast / c.maps)))), `min. ${MIN_MAPS_CAREER} map`);
  add("pc-apr", "player-career", "Najwięcej asyst na rundę", top(qual.map(c => ce(c, c.assists / c.rounds, f2(c.assists / c.rounds)))), `min. ${MIN_MAPS_CAREER} map`);
  add("pc-k30", "player-career", "Najwięcej map z 30+ zabójstwami", top(cs.filter(c => c.k30).map(c => ce(c, c.k30, `${c.k30}`))));
  add("pc-k25", "player-career", "Najwięcej map z 25+ zabójstwami", top(cs.filter(c => c.k25).map(c => ce(c, c.k25, `${c.k25}`))));
  add("pc-k40", "player-career", "Najwięcej map z 40+ zabójstwami", top(cs.filter(c => c.ace40).map(c => ce(c, c.ace40, `${c.ace40}`))));
  add("pc-r150", "player-career", "Najwięcej map z ratingiem 1.50+", top(cs.filter(c => c.r150).map(c => ce(c, c.r150, `${c.r150}`))));
  add("pc-s120", "player-career", "Najdłuższa seria map z ratingiem 1.20+", top(cs.filter(c => c.best120 >= 2).map(c => ({ ...ce(c, c.best120, `${c.best120} map`), ...(c.best120Ctx ? { date: c.best120Ctx.date, context: `zakończona/trwa · ${c.best120Ctx.context}` } : {}) }))));
  add("pc-spos", "player-career", "Najdłuższa seria map z dodatnim K-D", top(cs.filter(c => c.bestPos >= 2).map(c => ce(c, c.bestPos, `${c.bestPos} map`))));
  add("pc-zero", "player-career", "Najwięcej map bez zabójstwa", top(cs.filter(c => c.zeroK).map(c => ce(c, c.zeroK, `${c.zeroK}`))), "Rekord niechlubny");

  // zarobki / trofea (z portalu statystyk)
  try {
    const portal = computePortalStats("total");
    add("pc-earn", "player-career", "Najwyższe zarobki gracza", top(portal.players.filter(p => p.earnings > 0).map(p => ({ player: p.player, team: p.teams[p.teams.length - 1], value: p.earnings, display: `$${p.earnings.toLocaleString("pl-PL")}`, context: `${p.events} turniejów` }))));
    add("pc-gold", "player-career", "Najwięcej wygranych turniejów (gracz)", top(portal.players.filter(p => p.gold > 0).map(p => ({ player: p.player, value: p.gold, display: `${p.gold}`, context: p.teams.join(", ") }))));
    add("t-earn", "team", "Najwyższe zarobki organizacji", top(portal.orgs.filter(o => o.earnings > 0).map(o => ({ team: o.team, value: o.earnings, display: `$${o.earnings.toLocaleString("pl-PL")}`, context: `${o.events} turniejów` }))));
    add("t-gold", "team", "Najwięcej wygranych turniejów", top(portal.orgs.filter(o => o.gold > 0).map(o => ({ team: o.team, value: o.gold, display: `${o.gold}`, context: `${o.silver}× 2. miejsce` }))));
    add("t-goldS", "team", "Najwięcej trofeów Tier S", top(portal.orgs.map(o => ({ team: o.team, value: o.titles.filter(x => x.tier === "S").length, display: `${o.titles.filter(x => x.tier === "S").length}` })).filter(e => e.value > 0)));
    add("t-major", "team", "Najwięcej wygranych Majorów", top(portal.orgs.map(o => ({ team: o.team, value: o.titles.filter(x => x.major).length, display: `${o.titles.filter(x => x.major).length}`, context: o.titles.filter(x => x.major).map(x => x.name).join(", ") })).filter(e => e.value > 0)));
    add("t-finals", "team", "Najwięcej finałów", top(portal.orgs.filter(o => o.gold + o.silver > 0).map(o => ({ team: o.team, value: o.gold + o.silver, display: `${o.gold + o.silver}`, context: `${o.gold} wygranych` }))));
    add("t-podium", "team", "Najwięcej miejsc w top 4", top(portal.orgs.filter(o => o.gold + o.silver + o.bronze > 0).map(o => ({ team: o.team, value: o.gold + o.silver + o.bronze, display: `${o.gold + o.silver + o.bronze}` }))));
  } catch { /* portal opcjonalny */ }

  // ---------- drużyny ----------
  const ts = [...teams.entries()].map(([team, a]) => ({ team, ...a }));
  add("t-winstreak", "team", "Najdłuższa seria wygranych meczów", top(ts.filter(a => a.bestWin >= 2).map(a => ({ team: a.team, value: a.bestWin, display: `${a.bestWin}`, date: fmtDate(a.bestWinEnd || 0) }))));
  add("t-mapstreak", "team", "Najdłuższa seria wygranych map", top(ts.filter(a => a.bestMapRun >= 2).map(a => ({ team: a.team, value: a.bestMapRun, display: `${a.bestMapRun}`, date: fmtDate(a.bestMapRunEnd || 0) }))));
  add("t-lossstreak", "team", "Najdłuższa seria porażek", top(ts.filter(a => a.bestLoss >= 2).map(a => ({ team: a.team, value: a.bestLoss, display: `${a.bestLoss}`, date: fmtDate(a.bestLossEnd || 0) }))), "Rekord niechlubny");
  add("t-wins", "team", "Najwięcej wygranych meczów", top(ts.map(a => ({ team: a.team, value: a.won, display: `${a.won}`, context: `bilans ${a.won}-${a.played - a.won}` }))));
  add("t-played", "team", "Najwięcej rozegranych meczów", top(ts.map(a => ({ team: a.team, value: a.played, display: `${a.played}` }))));
  add("t-mapswon", "team", "Najwięcej wygranych map", top(ts.map(a => ({ team: a.team, value: a.mapsWon, display: `${a.mapsWon}` }))));
  add("t-wr", "team", "Najwyższy % wygranych meczów", top(ts.filter(a => a.played >= 10).map(a => ({ team: a.team, value: (a.won / a.played) * 100, display: pct((a.won / a.played) * 100), context: `${a.won}-${a.played - a.won}` }))), "min. 10 meczów");
  add("t-rd", "team", "Najlepsza różnica rund", top(ts.map(a => ({ team: a.team, value: a.roundsWon - a.roundsLost, display: `${a.roundsWon - a.roundsLost > 0 ? "+" : ""}${a.roundsWon - a.roundsLost}` }))));
  add("t-sweeps", "team", "Najwięcej wygranych bez straty mapy (Bo3/Bo5)", top(ts.filter(a => a.sweeps).map(a => ({ team: a.team, value: a.sweeps, display: `${a.sweeps}` }))));
  add("t-shutouts", "team", "Najwięcej map wygranych do zera", top(ts.filter(a => a.shutoutMaps).map(a => ({ team: a.team, value: a.shutoutMaps, display: `${a.shutoutMaps}` }))));
  add("t-ots", "team", "Najwięcej dogrywek", top(ts.filter(a => a.ots).map(a => ({ team: a.team, value: a.ots, display: `${a.ots}` }))));
  const tm = [...teamMap.values()];
  add("t-mapwr", "team", "Najwyższy % wygranych na jednej mapie", top(tm.filter(r => r.w + r.l >= MIN_MAPS_TEAM_MAP).map(r => ({ team: r.team, value: (r.w / (r.w + r.l)) * 100, display: pct((r.w / (r.w + r.l)) * 100), context: `${r.map} · ${r.w}-${r.l}` }))), `min. ${MIN_MAPS_TEAM_MAP} map`);
  add("t-mapw", "team", "Najwięcej wygranych na jednej mapie", top(tm.map(r => ({ team: r.team, value: r.w, display: `${r.w}`, context: `${r.map} · ${r.w}-${r.l}` }))));
  add("t-maprun", "team", "Najdłuższa seria wygranych na jednej mapie", top(tm.filter(r => r.best >= 2).map(r => ({ team: r.team, value: r.best, display: `${r.best}`, context: r.map }))));

  // ---------- mapy / mecze ----------
  add("m-blowout", "map", "Najwyższe zwycięstwo na mapie", top(blowouts));
  add("m-longest", "map", "Najdłuższa mapa", top(longestMaps));
  add("m-ot", "map", "Najdłuższa dogrywka", top(highOT));
  add("m-comeback", "map", "Największy comeback po pierwszej połowie", top(comebacks), "Strata rund po 12 rundach");
  add("m-series", "map", "Najdłuższa seria (łącznie rund)", top(longestSeries));
  add("m-reverse", "map", "Reverse sweep w Bo5 (z 0:2)", reverseSweeps.slice(-TOP).reverse());
  const mc = [...mapCount.entries()];
  add("m-popular", "map", "Najczęściej grana mapa", top(mc.map(([map, v]) => ({ value: v.played, display: `${v.played}`, context: map }))));
  add("m-otmap", "map", "Mapa z największą liczbą dogrywek", top(mc.filter(([, v]) => v.ots).map(([map, v]) => ({ value: v.ots, display: `${v.ots}`, context: map }))));
  add("m-avg", "map", "Najwyższa średnia rund na mapie", top(mc.filter(([, v]) => v.played >= 5).map(([map, v]) => ({ value: v.rounds / v.played, display: f1(v.rounds / v.played), context: map }))), "min. 5 rozegrań");

  // ---------- turnieje ----------
  const real = tournaments.filter(t => t.kind !== "qualifier");
  const tCount = (t: TournamentData) => collect([t], national).length;
  const winner = (t: TournamentData) => (t.placements || []).find(p => p.placement === 1)?.team;
  add("tr-pool", "tournament", "Największa pula nagród", top(real.filter(t => parsePrizePool(t.prizePool) > 0).map(t => ({ value: parsePrizePool(t.prizePool), display: `$${parsePrizePool(t.prizePool).toLocaleString("pl-PL")}`, context: t.name, team: winner(t), tournamentId: t.id, date: t.startDate }))));
  add("tr-teams", "tournament", "Najwięcej drużyn w turnieju", top(real.map(t => ({ value: t.participants?.length || t.teams || 0, display: `${t.participants?.length || t.teams || 0}`, context: t.name, tournamentId: t.id, date: t.startDate })).filter(e => e.value > 0)));
  add("tr-matches", "tournament", "Najwięcej meczów w turnieju", top(real.map(t => ({ value: tCount(t), display: `${tCount(t)}`, context: t.name, tournamentId: t.id, date: t.startDate })).filter(e => e.value > 0)));
  add("tr-q", "tournament", "Największe kwalifikacje", top(tournaments.filter(t => t.kind === "qualifier").map(t => ({ value: t.participants?.length || 0, display: `${t.participants?.length || 0} drużyn`, context: t.name, tournamentId: t.id, date: t.startDate })).filter(e => e.value > 0)));

  void topUnique;
  return defs;
}
