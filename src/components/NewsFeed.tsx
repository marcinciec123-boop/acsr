import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Newspaper, Plus, Pin, PinOff, Trash2, Image, X, Clock, Sparkles, Bot, ChevronDown, CheckSquare, Square } from "lucide-react";
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
import { generateAIRumors, type WorldSnapshot, type WorldEvent, type AIPostMode } from "@/lib/autoNews";
import { getWorldNowIso } from "@/lib/worldClock";
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
  const transfers = getAllTransfers().slice(-20).reverse();
  const tournaments = loadFromStorage<{ name: string; status: string; tier: string; teams: number; participants?: string[]; placements?: { team: string; placement: number }[]; startDate?: string }[]>("tournaments_data", []);

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

  // Extract concrete DB-anchored events
  const events: WorldEvent[] = [];

  for (const t of transfers.slice(0, 12)) {
    const from = t.oldTeam && t.oldTeam !== "-" ? t.oldTeam : "FA";
    const to = t.newTeam && t.newTeam !== "-" ? t.newTeam : "FA";
    if (from === "FA" && to === "FA") continue;
    events.push({
      kind: "transfer",
      summary: `${t.player}: ${from} → ${to}`,
    });
  }

  const finished = tournaments.filter(t => (t.placements?.length ?? 0) > 0);
  for (const t of finished.slice(0, 8)) {
    const ranked = [...(t.placements || [])].sort((a, b) => a.placement - b.placement);
    const winner = ranked.find(p => p.placement === 1)?.team;
    const runnerUp = ranked.find(p => p.placement === 2)?.team;
    const top4 = ranked.slice(0, 4).map(p => `${p.placement}. ${p.team}`).join(", ");
    if (winner) {
      events.push({
        kind: "tournament_finished",
        summary: `Turniej "${t.name}" [${t.tier}] zakończony. Zwycięzca: ${winner}${runnerUp ? `, finalista: ${runnerUp}` : ""}. Top4: ${top4}.`,
      });
    }
  }

  const upcoming = tournaments.filter(t => t.status === "upcoming" || t.status === "scheduled");
  for (const t of upcoming.slice(0, 6)) {
    const parts = (t.participants || []).slice(0, 6).join(", ");
    events.push({
      kind: "tournament_upcoming",
      summary: `Nadchodzący turniej "${t.name}" [${t.tier}], ${t.teams} drużyn${parts ? `, m.in. ${parts}` : ""}.`,
    });
  }

  const ongoing = tournaments.filter(t => t.status === "ongoing" || t.status === "live");
  for (const t of ongoing.slice(0, 4)) {
    const parts = (t.participants || []).slice(0, 6).join(", ");
    events.push({
      kind: "tournament_ongoing",
      summary: `Trwa turniej "${t.name}" [${t.tier}]${parts ? ` — grają: ${parts}` : ""}.`,
    });
  }

  // Coach events from teamDatabase (recently assigned coaches)
  for (const team of teamDatabase) {
    if ((team as any).coach && !(team as any).isNational) {
      // Only push a handful — trim to top 8 by points
    }
  }
  const teamsWithCoach = [...teamDatabase]
    .filter(t => (t as any).coach && !(t as any).isNational)
    .sort((a, b) => (b.points || 0) - (a.points || 0))
    .slice(0, 5);
  for (const t of teamsWithCoach) {
    events.push({
      kind: "coach",
      summary: `${t.name} ma trenera: ${(t as any).coach}.`,
    });
  }

  return {
    topTeams: topTeams.map(t => ({ name: t.name, points: t.points || 0, country: t.country })),
    recentTransfers: transfers.map(t => ({ player: t.player, oldTeam: t.oldTeam, newTeam: t.newTeam })),
    tournaments: tournaments.map(t => {
      const placements = (t.placements || []).slice().sort((a, b) => a.placement - b.placement);
      const winner = placements.find(p => p.placement === 1)?.team || null;
      const runnerUp = placements.find(p => p.placement === 2)?.team || null;
      const top = placements.slice(0, 8).map(p => ({ team: p.team, placement: p.placement }));
      const participants = (t.participants && t.participants.length ? t.participants : placements.map(p => p.team));
      return { name: t.name, status: t.status, tier: t.tier, teams: t.teams, winner, runnerUp, participants, topPlacements: top };
    }),
    topPlayers,
    events,
  };
};

const NewsFeed = () => {
  const [posts, setPosts] = useState<NewsPost[]>(() => loadFromStorage<NewsPost[]>(STORAGE_KEY, []));
  const [showNew, setShowNew] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newCategory, setNewCategory] = useState<string>("");
  const [newTags, setNewTags] = useState("");
  const [newSource, setNewSource] = useState("");
  const [newDate, setNewDate] = useState<string>(() => getWorldNowIso().slice(0, 10));
  const [newPinned, setNewPinned] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newImage, setNewImage] = useState<string | null>(null);
  const [imageCache, setImageCache] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<AIPostMode | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
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
      const count = mode === "mixed" ? 10 : 8;
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

  const resetForm = () => {
    setNewContent(""); setNewTitle(""); setNewAuthor(""); setNewCategory("");
    setNewTags(""); setNewSource(""); setNewPinned(false); setNewImage(null);
    setNewDate(getWorldNowIso().slice(0, 10));
    setEditingId(null);
  };

  const startEdit = (post: NewsPost) => {
    setEditingId(post.id);
    setNewContent(post.content || "");
    setNewTitle(post.title || "");
    setNewAuthor(post.author || "");
    setNewCategory(post.category || "");
    setNewTags((post.tags || []).join(", "));
    setNewSource(post.source || "");
    setNewPinned(!!post.pinned);
    setNewDate((post.date || getWorldNowIso()).slice(0, 10));
    setNewImage(post.imageId ? imageCache[post.imageId] || null : null);
    setShowNew(true);
  };

  const handlePost = async () => {
    if (!newContent.trim() && !newTitle.trim() && !newImage) return;
    const id = editingId || Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    let imageId: string | undefined = editingId ? posts.find(p => p.id === editingId)?.imageId : undefined;
    if (newImage && !(imageId && imageCache[imageId] === newImage)) {
      imageId = "img_" + id + "_" + Math.random().toString(36).slice(2, 5);
      await saveImage(imageId, newImage);
      setImageCache(prev => ({ ...prev, [imageId!]: newImage! }));
    }
    if (!newImage) imageId = undefined;
    const tags = newTags.split(",").map(t => t.trim()).filter(Boolean);
    const existingTime = editingId ? (posts.find(p => p.id === editingId)?.date || "").slice(10) : "";
    const post: NewsPost = {
      id,
      content: newContent.trim(),
      title: newTitle.trim() || undefined,
      author: newAuthor.trim() || undefined,
      category: newCategory || undefined,
      tags: tags.length ? tags : undefined,
      source: newSource.trim() || undefined,
      pinned: newPinned || undefined,
      imageId,
      date: newDate + (existingTime || getWorldNowIso().slice(10)),
    };
    setPosts(prev => editingId ? prev.map(p => p.id === editingId ? post : p) : [post, ...prev]);
    toast.success(editingId ? "Zaktualizowano post" : "Opublikowano post");
    resetForm();
    setShowNew(false);
  };

  const handleDelete = async (post: NewsPost) => {
    if (post.imageId) await deleteImage(post.imageId);
    setPosts(prev => prev.filter(p => p.id !== post.id));
  };

  const toggleSelected = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const deleteMany = async (ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const removed = posts.filter(p => idSet.has(p.id));
    for (const p of removed) {
      if (p.imageId) await deleteImage(p.imageId);
    }
    setPosts(prev => prev.filter(p => !idSet.has(p.id)));
    setSelected([]);
    toast.success(`Usunięto ${removed.length} ${removed.length === 1 ? "post" : "postów"}`);
  };

  const togglePin = (id: string) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, pinned: !p.pinned } : p));
  };

  const allCategories = Array.from(new Set([
    ...Object.keys(CATEGORY_BADGES),
    ...posts.map(p => p.category).filter(Boolean) as string[],
  ]));
  const usedCategories = Array.from(new Set(posts.map(p => p.category).filter(Boolean))) as string[];
  const years = Array.from(new Set(posts.map(p => (p.date || "").slice(0, 4)).filter(Boolean))).sort().reverse();

  const q = search.trim().toLowerCase();
  const sorted = [...posts]
    .filter(p => !filter || p.category === filter)
    .filter(p => yearFilter === "all" || (p.date || "").slice(0, 4) === yearFilter)
    .filter(p => !pinnedOnly || p.pinned)
    .filter(p => !q || [p.title, p.content, p.author, p.category, ...(p.tags || [])]
      .filter(Boolean).join(" ").toLowerCase().includes(q))
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return sortDir === "desc" ? diff : -diff;
    });


  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const eventCount = buildSnapshot().events?.length ?? 0;

  return (
    <section className="py-6">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Gradient header banner */}
        <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 mb-5">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
                <Newspaper className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-heading font-bold text-foreground leading-tight">Aktualności</h2>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {posts.length} {posts.length === 1 ? "post" : "postów"} · {eventCount} {eventCount === 1 ? "wydarzenie" : "wydarzeń"} w bazie
                </p>
              </div>
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
                  <DropdownMenuLabel className="text-xs font-mono text-muted-foreground">
                    Wybierz typ postów · {eventCount} zdarzeń
                  </DropdownMenuLabel>
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
              <Button
                size="sm"
                variant={selectMode ? "secondary" : "outline"}
                className="gap-1.5"
                onClick={() => { setSelectMode(v => !v); setSelected([]); }}
              >
                <CheckSquare className="w-4 h-4" /> {selectMode ? "Zakończ zaznaczanie" : "Zaznacz"}
              </Button>
            </div>
          </div>
          {eventCount === 0 && (
            <div className="relative mt-3 text-xs text-amber-300/90 font-mono border border-amber-500/30 bg-amber-500/10 rounded-md px-3 py-2">
              Brak zdarzeń w bazie (transferów, wyników turniejów). Dodaj coś w panelach Transfery/Turnieje, żeby AI miało na czym oprzeć newsy.
            </div>
          )}
        </div>


        {/* Bulk actions */}
        {selectMode && (
          <div className="flex flex-wrap items-center gap-2 mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
            <span className="text-xs font-mono text-muted-foreground">
              Zaznaczono {selected.length} z {sorted.length}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelected(sorted.map(p => p.id))}>
                Zaznacz wszystkie
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                Odznacz
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5"
                disabled={selected.length === 0}
                onClick={() => deleteMany(selected)}
              >
                <Trash2 className="w-4 h-4" /> Usuń zaznaczone ({selected.length})
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5"
                disabled={posts.length === 0}
                onClick={() => {
                  if (window.confirm(`Usunąć wszystkie posty (${posts.length})?`)) deleteMany(posts.map(p => p.id));
                }}
              >
                <Trash2 className="w-4 h-4" /> Usuń wszystkie
              </Button>
            </div>
          </div>
        )}

        {/* Search + filters */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Szukaj: tytuł, treść, tag, drużyna..."
              className="w-full h-9 pl-8 pr-2 rounded-md border border-border bg-secondary/40 text-sm font-mono text-foreground"
            />
          </div>
          <select
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value)}
            className="h-9 px-2 rounded-md border border-border bg-secondary/40 text-xs font-mono text-foreground"
          >
            <option value="all">Wszystkie lata</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
            className="h-9 px-2.5 rounded-md border border-border bg-secondary/40 text-xs font-mono text-muted-foreground hover:text-foreground"
          >
            {sortDir === "desc" ? "Najnowsze" : "Najstarsze"}
          </button>
          <button
            onClick={() => setPinnedOnly(v => !v)}
            className={cn(
              "h-9 px-2.5 rounded-md border text-xs font-mono transition-colors",
              pinnedOnly ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
            )}
          >
            Tylko przypięte
          </button>
        </div>

        {/* Category filter pills */}
        {usedCategories.length > 0 && (
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
            {usedCategories.map(cat => {
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
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Nagłówek (opcjonalnie)"
                  className="w-full h-10 px-3 rounded-md border border-border bg-secondary/50 text-sm font-heading font-bold text-foreground"
                />
                <Textarea
                  placeholder="Treść artykułu..."
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  className="bg-secondary/50 border-border min-h-[100px] resize-none"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="h-9 px-2 rounded-md border border-border bg-secondary/50 text-xs font-mono text-foreground"
                  >
                    <option value="">Bez kategorii</option>
                    {allCategories.map(cat => (
                      <option key={cat} value={cat}>{CATEGORY_BADGES[cat]?.label || cat}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="h-9 px-2 rounded-md border border-border bg-secondary/50 text-xs font-mono text-foreground"
                  />
                  <input
                    value={newAuthor}
                    onChange={e => setNewAuthor(e.target.value)}
                    placeholder="Autor / redakcja"
                    className="h-9 px-2 rounded-md border border-border bg-secondary/50 text-xs font-mono text-foreground"
                  />
                  <input
                    value={newSource}
                    onChange={e => setNewSource(e.target.value)}
                    placeholder="Źródło (opcjonalnie)"
                    className="h-9 px-2 rounded-md border border-border bg-secondary/50 text-xs font-mono text-foreground"
                  />
                  <input
                    value={newTags}
                    onChange={e => setNewTags(e.target.value)}
                    placeholder="Tagi po przecinku (np. NAVI, Major, transfer)"
                    className="h-9 px-2 rounded-md border border-border bg-secondary/50 text-xs font-mono text-foreground sm:col-span-2"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs font-mono text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={newPinned} onChange={e => setNewPinned(e.target.checked)} />
                  Przypnij post na górze
                </label>
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
                    <Button variant="ghost" size="sm" onClick={() => { setShowNew(false); resetForm(); }}>
                      Anuluj
                    </Button>
                    <Button size="sm" onClick={handlePost} disabled={!newContent.trim() && !newTitle.trim() && !newImage}>
                      {editingId ? "Zapisz zmiany" : "Opublikuj"}
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
                  {selectMode && (
                    <button
                      type="button"
                      onClick={() => toggleSelected(post.id)}
                      aria-pressed={selected.includes(post.id)}
                      className="text-muted-foreground hover:text-primary"
                      title="Zaznacz post"
                    >
                      {selected.includes(post.id)
                        ? <CheckSquare className="w-4 h-4 text-primary" />
                        : <Square className="w-4 h-4" />}
                    </button>
                  )}
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
