// ===== Komentarze użytkowników pod postami =====
// Po opublikowaniu posta generujemy 5-15 fikcyjnych komentarzy społeczności,
// które reagują na konkretną treść artykułu (AI, edge function `generate-comments`).

import { supabase } from "@/integrations/supabase/client";
import { loadFromStorage, saveToStorage } from "./storage";
import { getWorldNowIso } from "./worldClock";

const KEY = "news_comments";

export interface NewsComment {
  id: string;
  author: string;
  content: string;
  likes: number;
  date: string;
  /** Odpowiedź na komentarz o tym id (opcjonalnie) */
  replyTo?: string;
}

export type CommentStore = Record<string, NewsComment[]>;

export const loadAllComments = (): CommentStore => loadFromStorage<CommentStore>(KEY, {});

export const getComments = (postId: string): NewsComment[] => loadAllComments()[postId] || [];

export const setComments = (postId: string, comments: NewsComment[]): void => {
  const all = loadAllComments();
  all[postId] = comments;
  saveToStorage(KEY, all);
};

export const deleteComments = (postIds: string[]): void => {
  const all = loadAllComments();
  postIds.forEach(id => { delete all[id]; });
  saveToStorage(KEY, all);
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** Buduje wyciąg z bazy danych (składy, trenerzy, punkty, miejsce w rankingu),
 *  żeby AI nie zmyślała przynależności graczy do drużyn. */
function buildFacts(post: { title?: string; content: string; tags?: string[] }): string {
  const teams = loadAllTeams().filter(t => !t.isNational);
  const ranked = [...teams].sort((a, b) => (b.points || 0) - (a.points || 0));
  const rankOf = new Map(ranked.map((t, i) => [t.name, i + 1]));

  const haystack = `${post.title || ""} ${post.content || ""} ${(post.tags || []).join(" ")}`.toLowerCase();
  const mentioned = teams.filter(t =>
    haystack.includes(t.name.toLowerCase()) ||
    t.roster.some(p => p && haystack.includes(p.toLowerCase())) ||
    (t.coach ? haystack.includes(t.coach.toLowerCase()) : false),
  );

  const selected = [...new Set([...mentioned, ...ranked.slice(0, 15)])].slice(0, 30);

  return selected
    .map(t => {
      const rank = rankOf.get(t.name);
      const coach = t.coach ? `, trener: ${t.coach}` : "";
      return `#${rank ?? "-"} ${t.name} (${t.country || "?"}, ${Math.round(t.points || 0)} pkt) — skład: ${t.roster.filter(Boolean).join(", ")}${coach}`;
    })
    .join("\n");
}

/** Generuje komentarze pod postem i zapisuje je. Zwraca liczbę komentarzy. */
export async function generateComments(
  post: { id: string; title?: string; content: string; category?: string; tags?: string[] },
): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-comments", {
      body: {
        title: post.title || "",
        content: post.content || "",
        category: post.category || "",
        tags: post.tags || [],
        facts: buildFacts(post),
      },
    });

    if (error) return { ok: false, error: error.message };
    if (data?.error) return { ok: false, error: data.error };

    const raw: { author?: string; content?: string; likes?: number }[] = data?.comments || [];
    const base = Date.parse(getWorldNowIso());
    const comments: NewsComment[] = raw
      .filter(c => c.content && c.content.trim())
      .slice(0, 15)
      .map((c, i) => ({
        id: uid() + i,
        author: (c.author || "anon").trim().slice(0, 24),
        content: c.content!.trim(),
        likes: Math.max(-20, Math.min(999, Math.round(c.likes ?? 0))),
        date: new Date(base + i * 7 * 60 * 1000).toISOString(),
      }));
    if (comments.length === 0) return { ok: false, error: "Brak komentarzy w odpowiedzi" };
    setComments(post.id, comments);
    return { ok: true, count: comments.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown" };
  }
}
