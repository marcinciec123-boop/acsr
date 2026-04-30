import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Newspaper, Plus, Pin, PinOff, Trash2, Image, X, Clock, Sparkles, Bot, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { NewsPost } from "@/lib/types";
import { saveToStorage, loadFromStorage } from "@/lib/storage";
import { saveImage, loadImage, deleteImage } from "@/lib/storage";
import { generateAIRumors, type WorldSnapshot, type AIPostMode } from "@/lib/autoNews";
import { teamDatabase } from "@/data/tournaments";
import { getAllTransfers } from "@/data/history";
import { playerRoles } from "@/data/playerRoles";
import { computeCareerStats } from "@/lib/playerCareerStats";
import { toast } from "sonner";

const STORAGE_KEY = "news_posts";

const MODES: { value: AIPostMode; label: string; emoji: string; desc: string }[] = [
  { value: "mixed", label: "Wszystko po trochu", emoji: "🎲", desc: "Mix wszystkich typów" },
  { value: "memes", label: "Memy & żarty", emoji: "😂", desc: "Hcery, suchary, dystans" },
  { value: "mvp", label: "Sylwetki MVP", emoji: "⭐", desc: "Profile gwiazd i rising stars" },
  { value: "power-ranking", label: "Power Ranking", emoji: "📊", desc: "Top 5 z komentarzem" },
  { value: "beef", label: "Beef & dramaty", emoji: "🔥", desc: "Konflikty między graczami" },
  { value: "hot-take", label: "Hot takes", emoji: "🌶️", desc: "Kontrowersyjne opinie" },
  { value: "fun-fact", label: "Ciekawostki", emoji: "🧠", desc: "Statystyczne smaczki" },
  { value: "preview", label: "Zapowiedzi", emoji: "🎯", desc: "Co przed nami" },
];

const CATEGORY_BADGES: Record<string, { label: string; color: string }> = {
  transfer: { label: "Transfer", color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  rumor: { label: "Plotka", color: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  analysis: { label: "Analiza", color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
  tournament: { label: "Turniej", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  rating: { label: "Rating", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  opinion: { label: "Opinia", color: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
  meme: { label: "Mem", color: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30" },
  mvp: { label: "MVP", color: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
  "power-ranking": { label: "Power Ranking", color: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  beef: { label: "Beef", color: "bg-red-500/15 text-red-300 border-red-500/30" },
  "fun-fact": { label: "Ciekawostka", color: "bg-teal-500/15 text-teal-300 border-teal-500/30" },
  recap: { label: "Recap", color: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
  preview: { label: "Zapowiedź", color: "bg-lime-500/15 text-lime-300 border-lime-500/30" },
  interview: { label: "Wywiad", color: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  signing: { label: "Signing", color: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  release: { label: "Release", color: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
};

const buildSnapshot = (): WorldSnapshot => {
  const transfers = getAllTransfers().slice(-15).reverse();
  const tournaments = loadFromStorage<{ name: string; status: string; tier: string; teams: number; placements?: { team: string; placement: number }[] }[]>("tournaments_data", []);

  // top players: weź po 1 z top 8 drużyn (najwyższy career rating)
  const topTeams = [...teamDatabase].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 10);
  const topPlayers: { player: string; team: string; rating: number; role?: string }[] = [];
  for (const team of topTeams.slice(0, 8)) {
    let best: { player: string; rating: number } | null = null;
    for (const p of team.roster || []) {
      try {
        const cs = computeCareerStats(p);
        if (cs.matchesPlayed > 0 && (!best || cs.careerRating > best.rating)) {
          best = { player: p, rating: cs.careerRating };
        }
      } catch { /* ignore */ }
    }
    if (best) {
      topPlayers.push({
        player: best.player,
        team: team.name,
        rating: best.rating,
        role: playerRoles[best.player],
      });
    }
  }

  return {
    topTeams: topTeams.map(t => ({ name: t.name, points: t.points || 0, country: t.country })),
    recentTransfers: transfers.map(t => ({ player: t.player, oldTeam: t.oldTeam, newTeam: t.newTeam })),
    tournaments: tournaments.map(t => {
      const winner = t.placements?.find(p => p.placement === 1)?.team || null;
      const runnerUp = t.placements?.find(p => p.placement === 2)?.team || null;
      return { name: t.name, status: t.status, tier: t.tier, teams: t.teams, winner, runnerUp };
    }),
    topPlayers,
  };
};

const NewsFeed = () => {
  const [posts, setPosts] = useState<NewsPost[]>(() => loadFromStorage<NewsPost[]>(STORAGE_KEY, []));
  const [showNew, setShowNew] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newImage, setNewImage] = useState<string | null>(null);
  const [imageCache, setImageCache] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<AIPostMode | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const i = setInterval(() => {
      const fresh = loadFromStorage<NewsPost[]>(STORAGE_KEY, []);
      if (fresh.length !== posts.length) setPosts(fresh);
    }, 1500);
    return () => clearInterval(i);
  }, [posts.length]);

  const handleAIGenerate = async (mode: AIPostMode) => {
    setAiLoading(mode);
    try {
      const snapshot = buildSnapshot();
      const count = mode === "mixed" ? 6 : 4;
      const res = await generateAIRumors(snapshot, count, { mode });
      if (!res.ok) {
        toast.error(res.error || "Nie udało się wygenerować newsów");
      } else {
        toast.success(`Wygenerowano ${res.posted} ${res.posted === 1 ? "post" : "posty"}`);
        setPosts(loadFromStorage<NewsPost[]>(STORAGE_KEY, []));
      }
    } finally {
      setAiLoading(null);
    }
  };

  useEffect(() => { saveToStorage(STORAGE_KEY, posts); }, [posts]);

  useEffect(() => {
    const loadImages = async () => {
      const cache: Record<string, string> = {};
      for (const post of posts) {
        if (post.imageId && !imageCache[post.imageId]) {
          const img = await loadImage(post.imageId);
          if (img) cache[post.imageId] = img;
        }
      }
      if (Object.keys(cache).length > 0) {
        setImageCache(prev => ({ ...prev, ...cache }));
      }
    };
    loadImages();
  }, [posts]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Maksymalny rozmiar: 5MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setNewImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handlePost = async () => {
    if (!newContent.trim() && !newImage) return;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    let imageId: string | undefined;
    if (newImage) {
      imageId = "img_" + id;
      await saveImage(imageId, newImage);
      setImageCache(prev => ({ ...prev, [imageId!]: newImage! }));
    }
    const post: NewsPost = {
      id,
      content: newContent.trim(),
      imageId,
      date: new Date().toISOString(),
    };
    setPosts(prev => [post, ...prev]);
    setNewContent("");
    setNewImage(null);
    setShowNew(false);
  };

  const handleDelete = async (post: NewsPost) => {
    if (post.imageId) await deleteImage(post.imageId);
    setPosts(prev => prev.filter(p => p.id !== post.id));
  };

  const togglePin = (id: string) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, pinned: !p.pinned } : p));
  };

  const allCategories = Array.from(new Set(posts.map(p => p.category).filter(Boolean))) as string[];

  const sorted = [...posts]
    .filter(p => !filter || p.category === filter)
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <section className="py-6">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Newspaper className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-heading font-bold text-foreground">Aktualności</h2>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={!!aiLoading} className="gap-1.5">
                  {aiLoading ? <Bot className="w-4 h-4 animate-pulse" /> : <Sparkles className="w-4 h-4" />}
                  {aiLoading ? "Generuję..." : "AI generator"}
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-popover">
                <DropdownMenuLabel className="text-xs font-mono text-muted-foreground">Wybierz typ postów</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {MODES.map(m => (
                  <DropdownMenuItem
                    key={m.value}
                    onClick={() => handleAIGenerate(m.value)}
                    className="flex flex-col items-start gap-0.5 cursor-pointer py-2"
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <span>{m.emoji}</span>
                      <span>{m.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground pl-6">{m.desc}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={() => setShowNew(!showNew)} className="gap-1.5">
              <Plus className="w-4 h-4" /> Nowy post
            </Button>
          </div>
        </div>

        {/* Category filter pills */}
        {allCategories.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-5 pb-3 border-b border-border">
            <button
              onClick={() => setFilter(null)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full font-mono border transition-colors",
                !filter ? "bg-primary/20 text-primary border-primary/40" : "bg-secondary/40 text-muted-foreground border-border hover:bg-secondary",
              )}
            >
              Wszystkie ({posts.length})
            </button>
            {allCategories.map(cat => {
              const meta = CATEGORY_BADGES[cat] || { label: cat, color: "bg-secondary/40 text-foreground border-border" };
              const count = posts.filter(p => p.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setFilter(filter === cat ? null : cat)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full font-mono border transition-colors",
                    filter === cat ? meta.color : "bg-secondary/40 text-muted-foreground border-border hover:bg-secondary",
                  )}
                >
                  {meta.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* New post form */}
        <AnimatePresence>
          {showNew && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6"
            >
              <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                <Textarea
                  placeholder="Co nowego w świecie CS:GO..."
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  className="bg-secondary/50 border-border min-h-[100px] resize-none"
                />
                {newImage && (
                  <div className="relative inline-block">
                    <img src={newImage} alt="Preview" className="max-h-48 rounded-md" />
                    <button
                      onClick={() => setNewImage(null)}
                      className="absolute top-1 right-1 bg-background/80 rounded-full p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <input type="file" ref={fileRef} accept="image/*" className="hidden" onChange={handleImageSelect} />
                    <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
                      <Image className="w-4 h-4 mr-1" /> Zdjęcie
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setShowNew(false); setNewContent(""); setNewImage(null); }}>
                      Anuluj
                    </Button>
                    <Button size="sm" onClick={handlePost} disabled={!newContent.trim() && !newImage}>
                      Opublikuj
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Posts */}
        <div className="space-y-4">
          {sorted.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-mono text-sm">{filter ? "Brak postów w tej kategorii." : "Brak postów. Wygeneruj AI lub dodaj pierwszy!"}</p>
            </div>
          )}
          {sorted.map((post, i) => {
            const catMeta = post.category ? CATEGORY_BADGES[post.category] : null;
            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className={cn(
                  "bg-card border rounded-lg p-4",
                  post.pinned ? "border-primary/40 bg-primary/5" : "border-border",
                )}
              >
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {post.pinned && (
                    <Badge variant="outline" className="text-xs gap-1 border-primary/40 text-primary">
                      <Pin className="w-3 h-3" /> Przypięty
                    </Badge>
                  )}
                  {catMeta && (
                    <Badge variant="outline" className={cn("text-xs font-mono", catMeta.color)}>
                      {catMeta.label}
                    </Badge>
                  )}
                </div>
                {post.content && (
                  <p className="text-foreground text-sm whitespace-pre-wrap mb-3 leading-relaxed">{post.content}</p>
                )}
                {post.imageId && imageCache[post.imageId] && (
                  <img
                    src={imageCache[post.imageId]}
                    alt="Post"
                    className="rounded-md max-w-full mb-3"
                  />
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-mono">
                    <Clock className="w-3 h-3" />
                    {formatDate(post.date)}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => togglePin(post.id)}
                      title={post.pinned ? "Odepnij" : "Przypnij"}
                    >
                      {post.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(post)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default NewsFeed;
