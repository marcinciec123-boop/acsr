// ===== Rozwijalna sekcja komentarzy pod postem =====

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, ChevronDown, ThumbsUp, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { NewsPost } from "@/lib/types";
import { generateComments, getComments, setComments, type NewsComment } from "@/lib/newsComments";
import { toast } from "sonner";

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

  // Po zakończeniu generowania po publikacji — dociągnij świeże komentarze.
  useEffect(() => {
    if (pending) return;
    const fresh = getComments(post.id);
    if (fresh.length !== comments.length) setLocal(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, post.id]);

  const count = comments.length;

  const regenerate = async () => {
    setLoading(true);
    const res = await generateComments(post);
    if (!res.ok) toast.error(res.error || "Nie udało się wygenerować komentarzy");
    else {
      setLocal(getComments(post.id));
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
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 ml-auto text-xs font-mono text-muted-foreground"
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
                const ordered: NewsComment[] = [];
                const walk = (c: NewsComment) => {
                  ordered.push(c);
                  (children.get(c.id) || []).forEach(walk);
                };
                roots.forEach(walk);

                return ordered.map(c => {
                  const depth = Math.min(depthOf(c), 3);
                  const parent = c.replyTo ? byId.get(c.replyTo) : undefined;
                  return (
                    <div
                      key={c.id}
                      className={cn("flex gap-2", depth > 0 && "border-l-2 border-border/60 pl-2")}
                      style={depth > 0 ? { marginLeft: depth * 14 } : undefined}
                    >
                      <span
                        className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white/90"
                        style={{ background: avatarColor(c.author) }}
                      >
                        {c.author.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1 rounded-md border border-border/50 bg-secondary/25 px-2.5 py-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-foreground">{c.author}</span>
                          {parent && (
                            <span className="inline-flex items-center gap-0.5 text-xs font-mono text-primary/80">
                              <CornerDownRight className="w-3 h-3" />@{parent.author}
                            </span>
                          )}
                          <span className="text-xs font-mono text-muted-foreground opacity-70">{fmt(c.date)}</span>
                        </div>
                        <p className="text-xs text-foreground/90 mt-0.5 whitespace-pre-wrap leading-relaxed">{c.content}</p>
                        <button
                          type="button"
                          onClick={() => toggleLike(c.id)}
                          className={cn(
                            "mt-1 inline-flex items-center gap-1 text-xs font-mono transition-colors",
                            liked.includes(c.id) ? "text-primary" : "text-muted-foreground hover:text-primary",
                          )}
                        >
                          <ThumbsUp className="w-3 h-3" /> {c.likes}
                        </button>
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
