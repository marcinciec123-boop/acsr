// ===== Dodatki do aktualności: tożsamość komentujących, sondy, nastroje, załączniki, szablony =====

import type { MatchResult, TournamentData } from "./types";
import { loadFromStorage, saveToStorage } from "./storage";
import { loadAllTeams, loadArchivedTeams, loadExtraDisbands } from "./teamManagement";
import { playerRoles } from "@/data/playerRoles";

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

const COUNTRY_POOL: [string, number][] = [
  ["🇵🇱", 46], ["🇩🇪", 5], ["🇺🇦", 5], ["🇨🇿", 4], ["🇬🇧", 4], ["🇩🇰", 3], ["🇸🇪", 3],
  ["🇫🇷", 3], ["🇧🇷", 3], ["🇺🇸", 3], ["🇳🇴", 2], ["🇫🇮", 2], ["🇱🇹", 2], ["🇸🇰", 2],
  ["🇳🇱", 2], ["🇪🇸", 2], ["🇷🇴", 1], ["🇭🇺", 1], ["🇧🇬", 1], ["🇰🇿", 1], ["🇲🇳", 1],
  ["🇦🇺", 1], ["🇵🇹", 1], ["🇮🇩", 1],
];
const COUNTRY_TOTAL = COUNTRY_POOL.reduce((n, [, w]) => n + w, 0);

export function commenterFlag(nick: string): string {
  let r = hashStr("flag:" + nick.toLowerCase()) % COUNTRY_TOTAL;
  for (const [f, w] of COUNTRY_POOL) {
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
  (m.score1 !== m.score2 || (m.maps?.length ?? 0) > 0) && (m.score1 + m.score2 > 0);

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

export function listPlayedMatches(limit = 60): MatchRef[] {
  const refs: MatchRef[] = [];
  loadTournaments().forEach(t => {
    allMatchesOf(t).filter(isPlayed).forEach(m => {
      const date = (m as MatchResult & { date?: string; scheduledAt?: string }).date
        || (m as MatchResult & { scheduledAt?: string }).scheduledAt
        || t.endDate || t.startDate || "";
      refs.push({ tournamentId: t.id, tournamentName: t.name, tier: t.tier, date, match: m });
    });
  });
  return refs.sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, limit);
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
        a.r += p.rating ?? 1; a.n++; a.k += p.kills || 0; a.d += p.deaths || 0; a.adr += p.adr || 0;
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

const pick = <T,>(arr: T[], seed: string): T => arr[hashStr(seed) % arr.length];

export function matchReportTemplate(ref: MatchRef): TemplateResult {
  const m = ref.match;
  const w = m.score1 > m.score2 ? m.team1 : m.team2;
  const l = w === m.team1 ? m.team2 : m.team1;
  const ws = Math.max(m.score1, m.score2), ls = Math.min(m.score1, m.score2);
  const maps = (m.maps || []).map(mp => `${mp.map} ${mp.score1}:${mp.score2}`).join(", ");
  const mvp = matchMvp(m);
  const isFinal = /final/i.test(m.round || "") && !/semi|quarter|ćwierć|pół/i.test(m.round || "");
  const head = isFinal
    ? pick([`${w} mistrzem ${ref.tournamentName}!`, `${w} triumfuje w ${ref.tournamentName}`, `Puchar ${ref.tournamentName} jedzie do ${w}`], m.id)
    : pick([`${w} ogrywa ${l} ${ws}:${ls}`, `${w} lepsze od ${l} w ${ref.tournamentName}`, `${l} bez odpowiedzi na ${w}`], m.id);
  const lines = [
    `${w} pokonało ${l} ${ws}:${ls}${m.round ? ` (${m.round})` : ""} w ramach ${ref.tournamentName} [Tier ${ref.tier}].`,
    maps ? `Wyniki map: ${maps}.` : "",
    mvp ? `MVP spotkania: ${mvp.name} (${mvp.team}) — rating ${mvp.rating.toFixed(2)}, ${mvp.kills}-${mvp.deaths}, ADR ${mvp.adr.toFixed(1)}.` : "",
    isFinal
      ? `To zwieńczenie turnieju dla ${w} — trofeum i komplet punktów rankingowych trafia na ich konto.`
      : pick([`${l} musi szybko wyciągnąć wnioski przed kolejnymi meczami.`, `${w} potwierdza formę, a ${l} zostaje z wieloma pytaniami.`], m.id + "x"),
  ].filter(Boolean);
  return {
    title: head,
    content: lines.join("\n\n"),
    category: isFinal ? "tournament" : "recap",
    tags: [w, l, ref.tournamentName, ...(mvp ? [mvp.name] : [])],
    embeds: [{ kind: "match", tournamentId: ref.tournamentId, matchId: m.id }, ...(mvp ? [{ kind: "player" as const, name: mvp.name }] : [])],
    cover: { teamA: m.team1, teamB: m.team2, label: ref.tournamentName },
    poll: isFinal
      ? { question: `Czy ${w} obroni formę w następnym turnieju?`, options: ["Tak, to ich era", "Jednorazowy wyskok", "Zobaczymy"] }
      : { question: `Kto zajdzie dalej w ${ref.tournamentName}?`, options: [w, l] },
  };
}

export function transferTemplate(player: string, fromTeam: string, toTeam: string): TemplateResult {
  const role = playerRoles[player];
  const hasFrom = fromTeam && fromTeam !== "-";
  return {
    title: hasFrom ? `${player} przechodzi z ${fromTeam} do ${toTeam}` : `${toTeam} ogłasza ${player}`,
    content: [
      hasFrom
        ? `Oficjalnie: ${player}${role ? ` (${role})` : ""} opuszcza ${fromTeam} i dołącza do ${toTeam}.`
        : `${toTeam} sięga po ${player}${role ? `, który w nowej ekipie ma pełnić rolę ${role}` : ""}.`,
      `„Cieszę się z nowego wyzwania. ${toTeam} ma ambicje, które pokrywają się z moimi — chcemy walczyć o trofea” — mówi ${player}.`,
      `Organizacja liczy, że transfer wzmocni skład przed nadchodzącymi turniejami.`,
    ].join("\n\n"),
    category: hasFrom ? "transfer" : "signing",
    tags: [player, toTeam, ...(hasFrom ? [fromTeam] : [])],
    embeds: [{ kind: "player", name: player }],
    cover: { teamA: toTeam, ...(hasFrom ? { teamB: fromTeam } : {}), label: "TRANSFER" },
    poll: { question: `Dobry ruch ${toTeam}?`, options: ["Strzał w dziesiątkę", "Średnio", "Pomyłka"] },
  };
}

export function benchTemplate(player: string, team: string): TemplateResult {
  return {
    title: `${player} przesunięty na ławkę ${team}`,
    content: [
      `${team} poinformowało, że ${player} zostaje przesunięty do rezerwy i nie zagra w najbliższych turniejach.`,
      `„To była trudna decyzja. Dziękujemy ${player} za dotychczasową pracę i będziemy wspierać go w dalszych krokach” — przekazała organizacja.`,
      `Zawodnik może szukać nowego klubu. Nazwisko zastępcy ma zostać ogłoszone wkrótce.`,
    ].join("\n\n"),
    category: "release",
    tags: [player, team],
    embeds: [{ kind: "player", name: player }],
    cover: { teamA: team, label: "BENCH" },
    poll: { question: `Gdzie powinien trafić ${player}?`, options: ["Do topowej ekipy", "Niższy tier na odbudowę", "Przerwa od grania"] },
  };
}

export function rankingTemplate(team: string, rank: number, points: number): TemplateResult {
  return {
    title: `${team} na #${rank} w rankingu ACSR`,
    content: [
      `${team} zajmuje obecnie ${rank}. miejsce w światowym rankingu ACSR z dorobkiem ${Math.round(points)} pkt.`,
      rank <= 5
        ? `To pozycja ścisłej czołówki — od nich oczekuje się walki o każde trofeum.`
        : rank <= 20
          ? `Drużyna puka do czołówki i każdy kolejny turniej może ją przybliżyć do Top 5.`
          : `Ekipa wciąż buduje pozycję i szuka przełomowego wyniku.`,
    ].join("\n\n"),
    category: "rating",
    tags: [team, "ranking"],
    cover: { teamA: team, label: `#${rank} ACSR` },
    poll: { question: `Gdzie ${team} będzie za miesiąc?`, options: ["Wyżej", "Tak samo", "Niżej"] },
  };
}
