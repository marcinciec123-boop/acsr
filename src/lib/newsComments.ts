// ===== Komentarze użytkowników pod postami =====
// Po opublikowaniu posta generujemy 5-15 fikcyjnych komentarzy społeczności,
// które reagują na konkretną treść artykułu (AI, edge function `generate-comments`).

import { supabase } from "@/integrations/supabase/client";
import { loadAllTeams } from "./teamManagement";
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
  /** true = wpis redakcji (Twoja odpowiedź), a nie użytkownika */
  editor?: boolean;
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

    const raw: { author?: string; content?: string; likes?: number; replyToIndex?: number }[] =
      data?.comments || [];
    const base = Date.parse(getWorldNowIso());
    const kept = raw.filter(c => c.content && c.content.trim()).slice(0, 15);
    const ids = kept.map((_, i) => uid() + i);
    const comments: NewsComment[] = kept.map((c, i) => {
      const idx = typeof c.replyToIndex === "number" ? c.replyToIndex : -1;
      const parent = idx >= 0 && idx < i ? ids[idx] : undefined;
      return {
        id: ids[i],
        author: (c.author || "anon").trim().slice(0, 24),
        content: c.content!.trim(),
        likes: Math.max(-20, Math.min(999, Math.round(c.likes ?? 0))),
        date: new Date(base + i * 7 * 60 * 1000).toISOString(),
        ...(parent ? { replyTo: parent } : {}),
      };
    });

    if (comments.length === 0) return { ok: false, error: "Brak komentarzy w odpowiedzi" };
    setComments(post.id, comments);
    return { ok: true, count: comments.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown" };
  }
}

/** Nazwa autora wpisów redakcji w komentarzach. */
export const EDITOR_AUTHOR = "Redakcja";

/** Dodaje odpowiedź redakcji pod wskazanym komentarzem. Zwraca id nowego wpisu. */
export function addEditorReply(postId: string, parentId: string, content: string): string {
  const all = getComments(postId);
  const entry: NewsComment = {
    id: uid() + "ed",
    author: EDITOR_AUTHOR,
    content: content.trim(),
    likes: 0,
    date: getWorldNowIso(),
    replyTo: parentId,
    editor: true,
  };
  const idx = all.findIndex(c => c.id === parentId);
  const next = idx === -1 ? [...all, entry] : [...all.slice(0, idx + 1), entry, ...all.slice(idx + 1)];
  setComments(postId, next);
  return entry.id;
}

/** Generuje reakcje społeczności na wpis redakcji (odpowiedzi do odpowiedzi). */
export async function generateReplies(
  post: { id: string; title?: string; content: string; category?: string; tags?: string[] },
  editorCommentId: string,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const all = getComments(post.id);
    const byId = new Map(all.map(c => [c.id, c]));
    const target = byId.get(editorCommentId);
    if (!target) return { ok: false, error: "Nie znaleziono komentarza" };

    // Wątek: łańcuch rodziców do korzenia (od najstarszego)
    const chain: NewsComment[] = [];
    let cur: NewsComment | undefined = target;
    while (cur) {
      chain.unshift(cur);
      cur = cur.replyTo ? byId.get(cur.replyTo) : undefined;
    }

    // Autor komentarza, na który odpowiedziała redakcja — to on ma odpisać jako pierwszy
    const parentUser = target.replyTo ? byId.get(target.replyTo) : undefined;
    const originalAuthor = parentUser && !parentUser.editor ? parentUser.author : undefined;

    const { data, error } = await supabase.functions.invoke("generate-comments", {
      body: {
        mode: "reply",
        originalAuthor,
        originalContent: parentUser?.content,
        title: post.title || "",
        content: post.content || "",
        category: post.category || "",
        tags: post.tags || [],
        facts: buildFacts(post),
        thread: chain.slice(0, -1).map(c => ({ author: c.author, content: c.content })),
        targetAuthor: target.author,
        targetContent: target.content,
        usedNicks: [...new Set(all.map(c => c.author))],
      },
    });
    if (error) return { ok: false, error: error.message };
    if (data?.error) return { ok: false, error: data.error };

    const raw: { author?: string; content?: string; likes?: number; replyToIndex?: number }[] =
      data?.comments || [];
    const kept = raw.filter(c => c.content && c.content.trim()).slice(0, 6);
    if (kept.length === 0) return { ok: false, error: "Brak odpowiedzi w wynikach" };

    const base = Date.parse(target.date) || Date.parse(getWorldNowIso());
    const ids = kept.map((_, i) => uid() + "r" + i);
    const replies: NewsComment[] = kept.map((c, i) => {
      const idx = typeof c.replyToIndex === "number" ? c.replyToIndex : -1;
      return {
        id: ids[i],
        // pierwsza odpowiedź zawsze od oryginalnego autora, do którego odezwała się redakcja
        author: (i === 0 && originalAuthor ? originalAuthor : c.author || "anon").trim().slice(0, 24),
        content: c.content!.trim(),
        likes: Math.max(-20, Math.min(999, Math.round(c.likes ?? 0))),
        date: new Date(base + (i + 1) * 4 * 60 * 1000).toISOString(),
        replyTo: idx >= 0 && idx < i ? ids[idx] : editorCommentId,
      };
    });

    const pos = all.findIndex(c => c.id === editorCommentId);
    const next = pos === -1
      ? [...all, ...replies]
      : [...all.slice(0, pos + 1), ...replies, ...all.slice(pos + 1)];
    setComments(post.id, next);
    return { ok: true, count: replies.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown" };
  }
}
