// ===== Rozwijalna sekcja komentarzy pod postem =====

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, ChevronDown, ThumbsUp, RefreshCw, Loader2, CornerDownRight, Reply, Send, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { NewsPost } from "@/lib/types";
import {
  generateComments,
  generateReplies,
  addEditorReply,
  getComments,
  setComments,
  getPostLikes,
  setPostLikes,
  type NewsComment,
} from "@/lib/newsComments";
import { toast } from "sonner";
import { Pin } from "lucide-react";
import TeamLogo from "@/components/TeamLogo";
import { activeClubTeams, commenterFavTeam, commenterFlag } from "@/lib/newsExtras";

interface Props {
  post: NewsPost;
  /** true kiedy komentarze są właśnie generowane po publikacji */
  pending?: boolean;
}

const fmt = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

const avatarColor = (nick: string) => {
  let h = 0;
  for (let i = 0; i < nick.length; i++) h = (h * 31 + nick.charCodeAt(i)) % 360;
  return `hsl(${h} 60% 45%)`;
};

const PostComments = ({ post, pending }: Props) => {
  const [open, setOpen] = useState(false);
  const [comments, setLocal] = useState<NewsComment[]>(() => getComments(post.id));
  const [loading, setLoading] = useState(false);
  const [liked, setLiked] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [replying, setReplying] = useState<string | null>(null);
  const [postLikeCount, setPostLikeCount] = useState(() => getPostLikes(post.id));
  const [postLiked, setPostLiked] = useState(false);
  const [sortMode, setSortMode] = useState<"top" | "new">("top");
  const [clubTeams] = useState(() => activeClubTeams());
  const togglePin = (id: string) => {
    const next = comments.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c);
    setLocal(next);
    setComments(post.id, next);
  };
  // Zwinięte wątki — zapamiętywane w localStorage; domyślnie wszystkie zwinięte.
  const storeKey = `news:collapsed:${post.id}`;
  const parentsOf = (list: NewsComment[]) =>
    list.filter(c => list.some(x => x.replyTo === c.id)).map(c => c.id);
  const [collapsedStored, setCollapsedStored] = useState<string[] | null>(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      return raw ? (JSON.parse(raw) as string[]) : null;
    } catch { return null; }
  });
  const collapsed = collapsedStored ?? parentsOf(comments);
  const persistCollapsed = (next: string[]) => {
    setCollapsedStored(next);
    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const toggleCollapse = (id: string) =>
    persistCollapsed(collapsed.includes(id) ? collapsed.filter(x => x !== id) : [...collapsed, id]);



  const sendEditorReply = async (parentId: string) => {
    const text = draft.trim();
    if (!text) return;
    const newId = addEditorReply(post.id, parentId, text);
    setLocal(getComments(post.id));
    setDraft("");
    setReplyTo(null);
    setReplying(newId);
    const res = await generateReplies(post, newId);
    setLocal(getComments(post.id));
    setReplying(null);
    if (!res.ok) toast.error(res.error || "Nie udało się wygenerować reakcji");
    else toast.success(`Społeczność odpowiedziała (${res.count})`);
  };


  // Po zakończeniu generowania po publikacji — dociągnij świeże komentarze.
  useEffect(() => {
    if (pending) return;
    const fresh = getComments(post.id);
    if (fresh.length !== comments.length) setLocal(fresh);
    setPostLikeCount(getPostLikes(post.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, post.id]);

  const count = comments.filter(c => !c.replyTo).length;

  const regenerate = async () => {
    setLoading(true);
    const res = await generateComments(post);
    if (!res.ok) toast.error(res.error || "Nie udało się wygenerować komentarzy");
    else {
      setLocal(getComments(post.id));
      setPostLikeCount(getPostLikes(post.id));
      setOpen(true);
      toast.success(`Wygenerowano ${res.count} komentarzy`);
    }
    setLoading(false);
  };

  const toggleLike = (id: string) => {
    const next = comments.map(c =>
      c.id === id ? { ...c, likes: c.likes + (liked.includes(id) ? -1 : 1) } : c,
    );
    setLocal(next);
    setComments(post.id, next);
    setLiked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/60">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => { setLocal(getComments(post.id)); setOpen(v => !v); }}
          className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {pending && count === 0
            ? "Generuję komentarze…"
            : `Komentarze (${count})`}
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
        </button>
        {pending && count === 0 && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
        <button
          type="button"
          onClick={() => {
            const next = postLikeCount + (postLiked ? -1 : 1);
            setPostLikeCount(next);
            setPostLiked(v => !v);
            setPostLikes(post.id, next);
          }}
          className={cn(
            "flex items-center gap-1 text-xs font-mono transition-colors",
            postLiked ? "text-primary" : "text-muted-foreground hover:text-primary",
          )}
          title="Polub artykuł"
        >
          <ThumbsUp className="w-3.5 h-3.5" /> {postLikeCount}
        </button>
        {open && count > 0 && (
          <div className="ml-auto flex rounded border border-border overflow-hidden">
            {(["top", "new"] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setSortMode(m)}
                className={cn("px-2 h-6 text-xs font-mono", sortMode === m ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-primary")}
              >
                {m === "top" ? "Top" : "Najnowsze"}
              </button>
            ))}
          </div>
        )}
        {open && count > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs font-mono text-muted-foreground"
            onClick={() => persistCollapsed(collapsed.length ? [] : parentsOf(comments))}
          >
            {collapsed.length ? "Rozwiń wszystkie" : "Zwiń wszystkie"}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-6 px-2 text-xs font-mono text-muted-foreground", !(open && count > 0) && "ml-auto")}

          onClick={regenerate}
          disabled={loading}
        >
          {loading
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <RefreshCw className="w-3 h-3" />}
          <span className="ml-1">{count ? "Odśwież" : "Generuj"}</span>
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-2.5">
              {count === 0 && (
                <p className="text-xs font-mono text-muted-foreground">
                  Brak komentarzy — kliknij „Generuj”, żeby społeczność się wypowiedziała.
                </p>
              )}
              {(() => {
                const byId = new Map(comments.map(c => [c.id, c]));
                const depthOf = (c: NewsComment): number => {
                  let d = 0, cur = c;
                  while (cur.replyTo && byId.has(cur.replyTo) && d < 4) {
                    cur = byId.get(cur.replyTo)!;
                    d++;
                  }
                  return d;
                };
                // Ułóż wątkowo: rodzic, potem jego odpowiedzi (rekurencyjnie)
                const children = new Map<string, NewsComment[]>();
                const roots: NewsComment[] = [];
                comments.forEach(c => {
                  if (c.replyTo && byId.has(c.replyTo)) {
                    const arr = children.get(c.replyTo) || [];
                    arr.push(c);
                    children.set(c.replyTo, arr);
                  } else roots.push(c);
                });
                const descCount = (id: string): number =>
                  (children.get(id) || []).reduce((n, ch) => n + 1 + descCount(ch.id), 0);
                const ordered: NewsComment[] = [];
                const walk = (c: NewsComment) => {
                  ordered.push(c);
                  if (collapsed.includes(c.id)) return;
                  (children.get(c.id) || []).forEach(walk);
                };
                roots.sort((a, b) =>
                  (Number(!!b.pinned) - Number(!!a.pinned)) ||
                  (sortMode === "top" ? b.likes - a.likes : b.date.localeCompare(a.date)));
                roots.forEach(walk);

                return ordered.map(c => {
                  const depth = Math.min(depthOf(c), 3);
                  const parent = c.replyTo ? byId.get(c.replyTo) : undefined;
                  const hidden = descCount(c.id);
                  const isCollapsed = collapsed.includes(c.id);
                  return (
                    <div
                      key={c.id}
                      className={cn("flex gap-2", depth > 0 && "border-l-2 border-border/60 pl-2")}
                      style={depth > 0 ? { marginLeft: depth * 14 } : undefined}
                    >
                      {hidden > 0 ? (
                        <button
                          type="button"
                          onClick={() => toggleCollapse(c.id)}
                          title={isCollapsed ? "Rozwiń wątek" : "Zwiń wątek"}
                          className="shrink-0 self-start mt-0.5 w-4 h-7 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                        >
                          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isCollapsed && "-rotate-90")} />
                        </button>
                      ) : (
                        <span className="shrink-0 w-4" />
                      )}

                      <span
                        className={cn(
                          "w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white/90",
                          c.editor && "ring-2 ring-primary",
                        )}
                        style={{ background: c.editor ? "hsl(var(--primary))" : avatarColor(c.author) }}
                      >
                        {c.editor ? <ShieldCheck className="w-3.5 h-3.5" /> : c.author.slice(0, 2).toUpperCase()}
                      </span>
                      <div
                        className={cn(
                          "min-w-0 flex-1 rounded-md border px-2.5 py-1.5",
                          c.editor
                            ? "border-primary/50 bg-primary/10"
                            : "border-border/50 bg-secondary/25",
                        )}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          {!c.editor && <span className="text-sm leading-none" title="Kraj">{commenterFlag(c.author)}</span>}
                          <span className="text-xs font-mono font-bold text-foreground">{c.author}</span>
                          {!c.editor && (() => {
                            const fav = commenterFavTeam(c.author, clubTeams);
                            return fav ? <span title={`Kibic: ${fav}`} className="inline-flex"><TeamLogo teamName={fav} size={14} rounded="md" /></span> : null;
                          })()}
                          {c.pinned && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-mono bg-primary/15 text-primary">
                              <Pin className="w-3 h-3" /> PRZYPIĘTY
                            </span>
                          )}
                          {c.editor && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-primary/20 text-primary">
                              REDAKCJA
                            </span>
                          )}
                          {parent && (
                            <span className="inline-flex items-center gap-0.5 text-xs font-mono text-primary/80">
                              <CornerDownRight className="w-3 h-3" />@{parent.author}
                            </span>
                          )}
                          <span className="text-xs font-mono text-muted-foreground opacity-70">{fmt(c.date)}</span>
                          {isCollapsed && hidden > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleCollapse(c.id)}
                              className="px-1.5 py-0.5 rounded text-xs font-mono bg-secondary/60 text-muted-foreground hover:text-primary"
                            >
                              +{hidden} {hidden === 1 ? "odpowiedź" : "odpowiedzi"}
                            </button>
                          )}

                        </div>
                        <p className="text-xs text-foreground/90 mt-0.5 whitespace-pre-wrap leading-relaxed">{c.content}</p>
                        <div className="mt-1 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleLike(c.id)}
                            className={cn(
                              "inline-flex items-center gap-1 text-xs font-mono transition-colors",
                              liked.includes(c.id) ? "text-primary" : "text-muted-foreground hover:text-primary",
                            )}
                          >
                            <ThumbsUp className="w-3 h-3" /> {c.likes}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setDraft(""); }}
                            className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Reply className="w-3 h-3" /> Odpowiedz jako redakcja
                          </button>
                          {!c.replyTo && (
                            <button
                              type="button"
                              onClick={() => togglePin(c.id)}
                              className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
                            >
                              <Pin className="w-3 h-3" /> {c.pinned ? "Odepnij" : "Przypnij"}
                            </button>
                          )}
                          {replying === c.id && (
                            <span className="inline-flex items-center gap-1 text-xs font-mono text-primary">
                              <Loader2 className="w-3 h-3 animate-spin" /> reakcje…
                            </span>
                          )}
                        </div>

                        {replyTo === c.id && (
                          <div className="mt-2 space-y-2">
                            <Textarea
                              value={draft}
                              onChange={e => setDraft(e.target.value)}
                              placeholder={`Odpowiedź redakcji do @${c.author}…`}
                              rows={3}
                              className="text-xs"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                disabled={!draft.trim() || replying !== null}
                                onClick={() => sendEditorReply(c.id)}
                              >
                                <Send className="w-3 h-3 mr-1" /> Opublikuj i wygeneruj reakcje
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => { setReplyTo(null); setDraft(""); }}
                              >
                                Anuluj
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                  );
                });
              })()}
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PostComments;
