// ===== Auto news generator =====
// Creates deterministic news posts when meaningful events happen:
// - transfers (player moves teams)
// - tournament finishes / winner declared
// - big ranking shifts (left for caller)
//
// Posts are appended to localStorage `news_posts` (same key NewsFeed reads).
// Each auto-post gets a stable `eventKey` so we never duplicate the same event.

import type { NewsPost } from "./types";
import { saveToStorage, loadFromStorage } from "./storage";
import { supabase } from "@/integrations/supabase/client";

const NEWS_KEY = "news_posts";

interface AutoNewsPost extends NewsPost {
  /** Stable key per event so we don't repost the same thing on re-renders. */
  eventKey?: string;
  auto?: boolean;
}

const loadPosts = (): AutoNewsPost[] => loadFromStorage<AutoNewsPost[]>(NEWS_KEY, []);
const savePosts = (posts: AutoNewsPost[]) => saveToStorage(NEWS_KEY, posts);

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const appendPost = (
  eventKey: string,
  content: string,
  category: string,
): boolean => {
  const posts = loadPosts();
  if (posts.some(p => p.eventKey === eventKey)) return false;
  const post: AutoNewsPost = {
    id: uid(),
    content,
    date: new Date().toISOString(),
    category,
    eventKey,
    auto: true,
  };
  savePosts([post, ...posts]);
  return true;
};

// ----------------- transfer event -----------------

export function announceTransfer(player: string, oldTeam: string, newTeam: string): void {
  const key = `transfer:${player}:${oldTeam}->${newTeam}:${new Date().toISOString().slice(0, 10)}`;
  let content = "";
  let category = "transfer";

  const hasOld = oldTeam && oldTeam !== "-" && oldTeam !== "";
  const hasNew = newTeam && newTeam !== "-" && newTeam !== "";

  if (hasOld && hasNew) {
    content = `🔁 TRANSFER: ${player} opuszcza ${oldTeam} i dołącza do ${newTeam}. Ruch który może namieszać w aktualnym rankingu — zobaczymy czy nowa drużyna na tym zyska.`;
  } else if (!hasOld && hasNew) {
    content = `📥 ${newTeam} sięga po wolnego agenta — ${player} oficjalnie w składzie. Sprawdzą się w nadchodzących turniejach?`;
    category = "signing";
  } else if (hasOld && !hasNew) {
    content = `📤 ${player} opuszcza ${oldTeam} i staje się wolnym agentem. Jakie zespoły mogą zainteresować się jego usługami?`;
    category = "release";
  } else {
    return;
  }

  appendPost(key, content, category);
}

// ----------------- tournament events -----------------

export function announceTournamentStarted(tournamentName: string, tier: string, teams: number): void {
  const key = `t-start:${tournamentName}`;
  const content = `🏆 START TURNIEJU [${tier}]: ${tournamentName} oficjalnie rusza. ${teams} drużyn walczy o pulę nagród. Faworyci ruszają na sceny.`;
  appendPost(key, content, "tournament");
}

export function announceTournamentFinished(
  tournamentName: string,
  tier: string,
  winner: string | null,
  runnerUp: string | null,
): void {
  const key = `t-end:${tournamentName}`;
  let content: string;
  if (winner && runnerUp) {
    content = `🥇 ${tournamentName} ZAKOŃCZONY: ${winner} pokonuje ${runnerUp} w wielkim finale i sięga po trofeum klasy ${tier}. Mocny wpis do CV w tym sezonie.`;
  } else if (winner) {
    content = `🥇 ${tournamentName} (Tier ${tier}) zakończony — ${winner} triumfuje. Brawa dla mistrzów!`;
  } else {
    content = `📋 ${tournamentName} (Tier ${tier}) został zakończony.`;
  }
  appendPost(key, content, "tournament");
}

export function announceMatchUpset(winner: string, loser: string, score: string, context: string): void {
  const key = `upset:${winner}-${loser}-${score}-${context}`;
  const content = `⚡ NIESPODZIANKA: ${winner} ogrywa ${loser} ${score} w ${context}. Czy to przebudzenie, czy chwilowy zryw?`;
  appendPost(key, content, "analysis");
}

// ----------------- ranking shift -----------------

export function announceRankingChange(team: string, oldRank: number, newRank: number): void {
  if (oldRank === newRank) return;
  const diff = oldRank - newRank;
  const key = `rank:${team}:${oldRank}->${newRank}:${new Date().toISOString().slice(0, 10)}`;
  const dir = diff > 0 ? "📈 W GÓRĘ" : "📉 W DÓŁ";
  const content = `${dir}: ${team} przesuwa się z #${oldRank} na #${newRank} w światowym rankingu. ${diff > 0 ? "Forma rośnie." : "Coś nie gra w ostatnich meczach."}`;
  appendPost(key, content, "rating");
}

// ----------------- AI rumor batch -----------------

export type AIPostMode =
  | "mixed"
  | "memes"
  | "mvp"
  | "power-ranking"
  | "beef"
  | "hot-take"
  | "fun-fact"
  | "recap"
  | "preview";

export interface WorldSnapshot {
  topTeams: { name: string; points: number; country: string }[];
  recentTransfers: { player: string; oldTeam: string; newTeam: string }[];
  tournaments: { name: string; status: string; tier: string; teams: number; winner?: string | null; runnerUp?: string | null }[];
  topPlayers?: { player: string; team: string; rating: number; role?: string }[];
}

export async function generateAIRumors(
  snapshot: WorldSnapshot,
  count = 6,
  options?: { mode?: AIPostMode; context?: string; eventKeyPrefix?: string },
): Promise<{ ok: boolean; posted?: number; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-news", {
      body: {
        ...snapshot,
        count,
        mode: options?.mode || "mixed",
        context: options?.context,
      },
    });
    if (error) return { ok: false, error: error.message };
    if (data?.error) return { ok: false, error: data.error };
    const posts: { category: string; content: string }[] = data?.posts || [];
    const prefix = options?.eventKeyPrefix || "ai";
    const stamp = Date.now();
    let n = 0;
    posts.forEach((p, i) => {
      const key = `${prefix}:${stamp}:${i}`;
      if (appendPost(key, p.content, p.category)) n++;
    });
    return { ok: true, posted: n };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown" };
  }
}

// ----------------- post-tournament AI recap -----------------

/** Triggered when a tournament finishes — generates AI recap + MVP + power-ranking shift posts. */
export async function generateTournamentRecap(
  tournamentName: string,
  tier: string,
  winner: string | null,
  runnerUp: string | null,
  snapshot: WorldSnapshot,
): Promise<void> {
  const ctx = `Turniej "${tournamentName}" (Tier ${tier}) właśnie się zakończył. \
Zwycięzca: ${winner || "nieznany"}. Drugie miejsce: ${runnerUp || "nieznane"}. \
Napisz 8 postów: (1) recap turnieju z najważniejszymi momentami, \
(2) sylwetka MVP (gracz ze zwycięskiej drużyny z top playersów), \
(3) power-ranking top 5 po turnieju z krótkim komentarzem, \
(4) hot-take o przegranym finaliście / zaskoczeniu turnieju, \
(5) mem o najsłabszym występie, \
(6) ciekawostka statystyczna z turnieju, \
(7) zapowiedź co dalej dla zwycięzców (kolejne turnieje), \
(8) plotka transferowa lub beef związany z turniejem.`;

  await generateAIRumors(snapshot, 8, {
    mode: "recap",
    context: ctx,
    eventKeyPrefix: `recap:${tournamentName}`,
  });
}

