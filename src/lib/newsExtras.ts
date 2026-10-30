import { isMatchDecided } from "./matchStatus";
import { calculateRating } from "./playerStats";
// ===== Dodatki do aktualności: tożsamość komentujących, sondy, nastroje, załączniki, szablony =====

import type { MatchResult, TournamentData } from "./types";
import { loadFromStorage, saveToStorage } from "./storage";
import { loadAllTeams, loadArchivedTeams, loadExtraDisbands } from "./teamManagement";
import { playerRoles } from "@/data/playerRoles";
import { getMatchTimestamp } from "./matchTime";
import { getWorldNowIso } from "./worldClock";
import { normalizeCountry } from "./flags";
import { playerNationalities } from "@/data/playerNationalities";

// ---------- Typy ----------

export interface NewsPoll {
  question: string;
  options: string[];
  /** Głosy społeczności (wygenerowane przy publikacji) */
  votes: number[];
}

export type NewsEmbed =
  | { kind: "match"; tournamentId: string; matchId: string }
  | { kind: "player"; name: string };

export interface NewsCover {
  teamA: string;
  teamB?: string;
  label?: string;
}

// ---------- Hash ----------

export const hashStr = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---------- Aktywne drużyny ----------

export function activeClubTeams() {
  const dead = new Set<string>([
    ...loadArchivedTeams(),
    ...loadExtraDisbands().map(d => d.team),
  ]);
  return loadAllTeams()
    .filter(t => !t.isNational && !dead.has(t.name))
    .sort((a, b) => (b.points || 0) - (a.points || 0));
}

// ---------- Tożsamość komentującego (flaga + ulubiona drużyna) ----------

// Cały świat — każdy kraj ma bazową szansę, a kraje z drużynami/graczami w zapisie dostają więcej.
const WORLD_ISO = "AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS XK YE ZA ZM ZW".split(" ");
const isoFlag = (iso: string) => String.fromCodePoint(...[...iso].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));

let countryPoolCache: { pool: [string, number][]; total: number } | null = null;
function countryPool() {
  if (countryPoolCache) return countryPoolCache;
  const w = new Map<string, number>(WORLD_ISO.map(i => [i, 0.15]));
  try {
    activeClubTeams().forEach(t => {
      const iso = normalizeCountry(t.country);
      if (iso && iso !== "EU") w.set(iso, (w.get(iso) || 0.15) + 3 + (t.points || 0) / 400);
    });
    Object.values(playerNationalities).forEach(c => {
      const iso = normalizeCountry(c);
      if (iso && iso !== "EU") w.set(iso, (w.get(iso) || 0.15) + 0.6);
    });
  } catch { /* brak danych */ }
  w.set("PL", (w.get("PL") || 0) + 40); // polski portal
  const pool = [...w.entries()].map(([i, n]) => [isoFlag(i), n] as [string, number]);
  countryPoolCache = { pool, total: pool.reduce((s, [, n]) => s + n, 0) };
  return countryPoolCache;
}

export function commenterFlag(nick: string): string {
  const { pool, total } = countryPool();
  let r = (hashStr("flag:" + nick.toLowerCase()) / 4294967296) * total;
  for (const [f, w] of pool) {
    if (r < w) return f;
    r -= w;
  }
  return "🇵🇱";
}

/** Ulubiona drużyna (ok. 55% użytkowników ją ma) — popularniejsze ekipy częściej. */
export function commenterFavTeam(nick: string, teams: { name: string }[]): string | null {
  if (!teams.length) return null;
  const h = hashStr("fav:" + nick.toLowerCase());
  if (h % 100 >= 55) return null;
  const top = Math.min(teams.length, 30);
  const pickTop = (h >>> 8) % 100 < 75;
  const idx = pickTop ? (h >>> 12) % top : (h >>> 12) % teams.length;
  return teams[idx].name;
}

// ---------- Nastroje (hype) ----------

const HYPE_KEY = "news_post_hype";
const CATEGORY_HYPE: Record<string, number> = {
  transfer: 62, signing: 70, release: 38, tournament: 72, mvp: 80, meme: 75,
  beef: 35, "hot-take": 45, rumor: 52, analysis: 58, rating: 60, recap: 66, preview: 74,
  "power-ranking": 55, "fun-fact": 70, opinion: 48, interview: 64,
};

export function getPostHype(postId: string, category?: string): number {
  const stored = loadFromStorage<Record<string, number>>(HYPE_KEY, {})[postId];
  if (typeof stored === "number") return stored;
  const base = CATEGORY_HYPE[category || ""] ?? 60;
  const jitter = (hashStr("hype:" + postId) % 25) - 12;
  return Math.max(5, Math.min(97, base + jitter));
}

export function setPostHype(postId: string, hype: number): void {
  const all = loadFromStorage<Record<string, number>>(HYPE_KEY, {});
  all[postId] = Math.max(0, Math.min(100, Math.round(hype)));
  saveToStorage(HYPE_KEY, all);
}

// ---------- Sondy ----------

const VOTE_KEY = "news_poll_votes";

/** Generuje głosy społeczności — drużyny z rankingu dostają wagę zgodną z punktami. */
export function seedPollVotes(postId: string, options: string[]): number[] {
  const r = rng(hashStr("poll:" + postId));
  const pts = new Map(activeClubTeams().map(t => [t.name.toLowerCase(), t.points || 0]));
  const weights = options.map(o => {
    const p = pts.get(o.trim().toLowerCase());
    const base = p ? 0.4 + p / 1000 : 1;
    return base * (0.55 + r() * 0.9);
  });
  const total = 180 + Math.floor(r() * 2600);
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map(w => Math.round((w / sum) * total));
}

export const getMyVote = (postId: string): number | null =>
  loadFromStorage<Record<string, number>>(VOTE_KEY, {})[postId] ?? null;

export function setMyVote(postId: string, idx: number | null): void {
  const all = loadFromStorage<Record<string, number>>(VOTE_KEY, {});
  if (idx === null) delete all[postId];
  else all[postId] = idx;
  saveToStorage(VOTE_KEY, all);
}

// ---------- Mecze z zapisu ----------

export interface MatchRef {
  tournamentId: string;
  tournamentName: string;
  tier: string;
  date: string;
  match: MatchResult;
}

export function loadTournaments(): TournamentData[] {
  return loadFromStorage<TournamentData[]>("tournaments_data", []);
}

const isPlayed = (m: MatchResult) =>
  !!m.team1 && !!m.team2 && !/^(TBD|BYE)/i.test(m.team1) && !/^(TBD|BYE)/i.test(m.team2) &&
  isMatchDecided(m);

export function allMatchesOf(t: TournamentData): MatchResult[] {
  const out: MatchResult[] = [];
  const seen = new Set<string>();
  const push = (m: MatchResult) => { if (m && !seen.has(m.id)) { seen.add(m.id); out.push(m); } };
  (t.phases || []).forEach(p => {
    (p.groups || []).forEach(g => (g.matches || []).forEach(push));
    (p.bracket || []).forEach(push);
  });
  (t.matches || []).forEach(push);
  return out;
}

const DAY = 86400000;

/** Mecze rozegrane w ostatnich `days` dniach zegara gry (domyślnie 3). */
function recentPlayed(days: number): (MatchRef & { phaseName: string; phaseId: string; ts: number })[] {
  const now = Date.parse(getWorldNowIso()) || Date.now();
  const from = now - days * DAY;
  const out: (MatchRef & { phaseName: string; phaseId: string; ts: number })[] = [];
  loadTournaments().forEach(t => {
    const seen = new Set<string>();
    const add = (m: MatchResult, phaseId: string, phaseName: string) => {
      if (!m || seen.has(m.id) || !isPlayed(m)) return;
      seen.add(m.id);
      const ts = getMatchTimestamp({ scheduledAt: m.scheduledAt, playedAt: m.playedAt, fallbackDate: t.endDate || t.startDate });
      if (!ts || ts < from || ts > now + DAY) return;
      out.push({ tournamentId: t.id, tournamentName: t.name, tier: t.tier, date: new Date(ts).toISOString(), match: m, phaseId, phaseName, ts });
    };
    (t.phases || []).forEach(p => {
      (p.groups || []).forEach(g => (g.matches || []).forEach(m => add(m, p.id, p.name)));
      (p.bracket || []).forEach(m => add(m, p.id, p.name));
    });
    (t.matches || []).forEach(m => add(m, "legacy", ""));
  });
  return out.sort((a, b) => b.ts - a.ts);
}

export function listPlayedMatches(days = 3): MatchRef[] {
  return recentPlayed(days);
}

export interface RoundRef {
  key: string;
  tournamentId: string;
  tournamentName: string;
  tier: string;
  phaseName: string;
  label: string;
  matches: MatchRef[];
}

/** Kolejki / rundy / fazy z ostatnich dni — grupowane po turnieju, fazie i nazwie rundy. */
export function listRecentRounds(days = 3): RoundRef[] {
  const map = new Map<string, RoundRef>();
  const order: string[] = [];
  recentPlayed(days).forEach(r => {
    const label = r.match.round || r.phaseName || "Mecze";
    const key = `${r.tournamentId}|${r.phaseId}|${label}`;
    if (!map.has(key)) {
      map.set(key, { key, tournamentId: r.tournamentId, tournamentName: r.tournamentName, tier: r.tier, phaseName: r.phaseName, label, matches: [] });
      order.push(key);
    }
    map.get(key)!.matches.push(r);
  });
  const rounds = order.map(k => map.get(k)!);

  // Całe fazy i całe turnieje (brackety) z aktywnością w ostatnich dniach — wszystkie rozegrane mecze
  const extra: RoundRef[] = [];
  const touched = new Map<string, Set<string>>();
  recentPlayed(days).forEach(r => {
    if (!touched.has(r.tournamentId)) touched.set(r.tournamentId, new Set());
    touched.get(r.tournamentId)!.add(r.phaseId);
  });
  const tours = loadTournaments();
  touched.forEach((phaseIds, tid) => {
    const t = tours.find(x => x.id === tid);
    if (!t) return;
    const ref = (m: MatchResult): MatchRef => ({ tournamentId: t.id, tournamentName: t.name, tier: t.tier, date: m.playedAt || m.scheduledAt || t.endDate || t.startDate, match: m });
    const all: MatchRef[] = [];
    const seen = new Set<string>();
    (t.phases || []).forEach(p => {
      const ms: MatchRef[] = [];
      [...(p.groups || []).flatMap(g => g.matches || []), ...(p.bracket || [])].forEach(m => {
        if (!m || seen.has(m.id) || !isPlayed(m)) return;
        seen.add(m.id);
        ms.push(ref(m)); all.push(ref(m));
      });
      if (phaseIds.has(p.id) && ms.length) {
        extra.push({ key: `phase|${t.id}|${p.id}`, tournamentId: t.id, tournamentName: t.name, tier: t.tier, phaseName: "", label: `Cała faza: ${p.name}`, matches: ms });
      }
    });
    (t.matches || []).forEach(m => { if (m && !seen.has(m.id) && isPlayed(m)) { seen.add(m.id); all.push(ref(m)); } });
    if (all.length) extra.push({ key: `tour|${t.id}`, tournamentId: t.id, tournamentName: t.name, tier: t.tier, phaseName: "", label: "Cały turniej (wszystkie fazy)", matches: all });
  });
  return [...rounds, ...extra];
}

export function findMatch(tournamentId: string, matchId: string): MatchRef | null {
  const t = loadTournaments().find(x => x.id === tournamentId);
  if (!t) return null;
  const m = allMatchesOf(t).find(x => x.id === matchId);
  if (!m) return null;
  return { tournamentId: t.id, tournamentName: t.name, tier: t.tier, date: t.endDate || t.startDate, match: m };
}

// ---------- MVP meczu ----------

export function matchMvp(m: MatchResult): { name: string; team: string; rating: number; kills: number; deaths: number; adr: number } | null {
  const acc = new Map<string, { team: string; r: number; n: number; k: number; d: number; adr: number }>();
  (m.maps || []).forEach(mp => {
    [...(mp.team1Players || []).map(p => [p, m.team1] as const), ...(mp.team2Players || []).map(p => [p, m.team2] as const)]
      .forEach(([p, team]) => {
        if (!p?.playerName) return;
        const a = acc.get(p.playerName) || { team, r: 0, n: 0, k: 0, d: 0, adr: 0 };
        a.r += (p.rating && p.rating > 0) ? p.rating : calculateRating({ ...p, rounds: (mp.score1 || 0) + (mp.score2 || 0) } as any); a.n++; a.k += p.kills || 0; a.d += p.deaths || 0; a.adr += p.adr || 0;
        acc.set(p.playerName, a);
      });
  });
  let best: { name: string; team: string; rating: number; kills: number; deaths: number; adr: number } | null = null;
  acc.forEach((a, name) => {
    const rating = a.r / a.n;
    if (!best || rating > best.rating) best = { name, team: a.team, rating, kills: a.k, deaths: a.d, adr: a.adr / a.n };
  });
  return best;
}

// ---------- Szablony ----------

export interface TemplateResult {
  title: string;
  content: string;
  category: string;
  tags: string[];
  embeds?: NewsEmbed[];
  cover?: NewsCover;
  poll?: { question: string; options: string[] };
}


import { analyzeMatch, writeMatchReport, writeRoundReport, writeTransfer, writeBench, writeRanking, rnd } from "./newsWriter";

export function matchReportTemplate(ref: MatchRef): TemplateResult {
  const m = ref.match;
  const mvp = matchMvp(m);
  const f = analyzeMatch(m, mvp);
  const { w, l } = f;
  const isFinal = /final/i.test(m.round || "") && !/semi|quarter|ćwierć|pół/i.test(m.round || "");
  const { title, content } = writeMatchReport(f, ref.tournamentName, ref.tier, isFinal);
  return {
    title, content,
    category: isFinal ? "tournament" : "recap",
    tags: [w, l, ref.tournamentName, ...(mvp ? [mvp.name] : [])],
    embeds: [{ kind: "match", tournamentId: ref.tournamentId, matchId: m.id }, ...(mvp ? [{ kind: "player" as const, name: mvp.name }] : [])],
    cover: { teamA: m.team1, teamB: m.team2, label: ref.tournamentName },
    poll: isFinal
      ? { question: rnd([`Czy ${w} obroni formę w następnym turnieju?`, `Ile trofeów zdobędzie ${w} w tym sezonie?`]), options: ["Tak, to ich era", "Jednorazowy wyskok", "Zobaczymy"] }
      : { question: rnd([`Kto zajdzie dalej w ${ref.tournamentName}?`, `Zasłużone zwycięstwo ${w}?`]), options: [w, l] },
  };
}

export function transferTemplate(player: string, fromTeam: string, toTeam: string): TemplateResult {
  const hasFrom = fromTeam && fromTeam !== "-";
  const { title, content } = writeTransfer(player, fromTeam, toTeam);
  return {
    title, content,
    category: hasFrom ? "transfer" : "signing",
    tags: [player, toTeam, ...(hasFrom ? [fromTeam] : [])],
    embeds: [{ kind: "player", name: player }],
    cover: { teamA: toTeam, ...(hasFrom ? { teamB: fromTeam } : {}), label: "TRANSFER" },
    poll: { question: `Dobry ruch ${toTeam}?`, options: ["Strzał w dziesiątkę", "Średnio", "Pomyłka"] },
  };
}

export function benchTemplate(player: string, team: string): TemplateResult {
  const { title, content } = writeBench(player, team);
  return {
    title, content, category: "release", tags: [player, team],
    embeds: [{ kind: "player", name: player }],
    cover: { teamA: team, label: "BENCH" },
    poll: { question: `Gdzie powinien trafić ${player}?`, options: ["Do topowej ekipy", "Niższy tier na odbudowę", "Przerwa od grania"] },
  };
}

export function rankingTemplate(team: string, rank: number, points: number): TemplateResult {
  const { title, content } = writeRanking(team, rank, points);
  return {
    title, content, category: "rating", tags: [team, "ranking"],
    cover: { teamA: team, label: `#${rank} ACSR` },
    poll: { question: `Gdzie ${team} będzie za miesiąc?`, options: ["Wyżej", "Tak samo", "Niżej"] },
  };
}

export function roundReportTemplate(g: RoundRef): TemplateResult {
  const phase = g.phaseName && g.phaseName !== g.label ? `${g.phaseName} — ${g.label}` : g.label;
  const facts = g.matches.map(r => analyzeMatch(r.match, matchMvp(r.match)));
  const star = facts.map(f => f.mvp).filter(Boolean).sort((a, b) => b!.rating - a!.rating)[0] || null;
  const { title, content, winners } = writeRoundReport(facts, g.tournamentName, g.tier, phase, g.label, star);
  return {
    title, content,
    category: "recap",
    tags: [g.tournamentName, g.label, ...winners.slice(0, 6), ...(star ? [star.name] : [])],
    embeds: [
      ...g.matches.slice(0, 8).map(r => ({ kind: "match" as const, tournamentId: r.tournamentId, matchId: r.match.id })),
      ...(star ? [{ kind: "player" as const, name: star.name }] : []),
    ],
    cover: winners.length >= 2 ? { teamA: winners[0], teamB: winners[1], label: g.label } : { teamA: winners[0] || g.matches[0].match.team1, label: g.label },
    poll: { question: `Kto zrobił największe wrażenie — ${g.label}?`, options: winners.slice(0, 6).length >= 2 ? winners.slice(0, 6) : ["Faworyci", "Czarne konie"] },
  };
}
