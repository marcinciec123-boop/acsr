import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import NewsComposer, { type ComposerDraft } from "@/components/news/NewsComposer";
import { motion, AnimatePresence } from "framer-motion";
import { Newspaper, Plus, Pin, PinOff, Trash2, Image, X, Clock, Sparkles, Bot, ChevronDown, CheckSquare, Square, Search, Pencil } from "lucide-react";
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
import PostComments from "@/components/PostComments";
import { deleteComments, generateComments } from "@/lib/newsComments";
import { CoverBanner, EmbedCards, PollBox, SentimentBar } from "@/components/news/NewsExtras";
import { seedPollVotes } from "@/lib/newsExtras";

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

const emptyDraft = (): ComposerDraft => {
  const now = new Date();
  return {
    title: "", content: "", category: "",
    date: getWorldNowIso().slice(0, 10),
    time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    author: "", source: "", tags: "", pinned: false, image: null,
    poll: null, embeds: [], cover: null,
  };
};

const NewsFeed = () => {
  const [posts, setPosts] = useState<NewsPost[]>(() => loadFromStorage<NewsPost[]>(STORAGE_KEY, []));
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ComposerDraft>(() => emptyDraft());
  const [composerKey, setComposerKey] = useState(0);
  const [imageCache, setImageCache] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);

  const [aiLoading, setAiLoading] = useState<AIPostMode | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [cats, setCats] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [authorFilter, setAuthorFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [imageOnly, setImageOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [commentPending, setCommentPending] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    if (showNew) return; // brak odpytywania storage podczas pisania artykułu
    const i = setInterval(() => {
      const fresh = loadFromStorage<NewsPost[]>(STORAGE_KEY, []);
      if (fresh.length !== posts.length) setPosts(fresh);
    }, 4000);
    return () => clearInterval(i);
  }, [posts.length, showNew]);

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

  useEffect(() => { setPage(1); }, [search, cats, yearFilter, monthFilter, authorFilter, tagFilter, dateFrom, dateTo, imageOnly, pinnedOnly, sortDir, pageSize]);

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

  const resetForm = useCallback(() => {
    setDraft(emptyDraft());
    setEditingId(null);
    setComposerKey(k => k + 1);
  }, []);

  const startEdit = (post: NewsPost) => {
    const pd = new Date(post.date || getWorldNowIso());
    setEditingId(post.id);
    setDraft({
      title: post.title || "",
      content: post.content || "",
      category: post.category || "",
      date: (post.date || getWorldNowIso()).slice(0, 10),
      time: Number.isNaN(pd.getTime()) ? "12:00" : `${String(pd.getHours()).padStart(2, "0")}:${String(pd.getMinutes()).padStart(2, "0")}`,
      author: post.author || "",
      source: post.source || "",
      tags: (post.tags || []).join(", "),
      pinned: !!post.pinned,
      image: post.imageId ? imageCache[post.imageId] || null : null,
      poll: post.poll ? { question: post.poll.question, options: post.poll.options.join("\n") } : null,
      embeds: post.embeds || [],
      cover: post.cover || null,
    });
    setComposerKey(k => k + 1);
    setShowNew(true);
  };

  const handlePost = useCallback(async (d: ComposerDraft) => {
    if (!d.content.trim() && !d.title.trim() && !d.image) return;
    const id = editingId || Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    let imageId: string | undefined = editingId ? posts.find(p => p.id === editingId)?.imageId : undefined;
    if (d.image && !(imageId && imageCache[imageId] === d.image)) {
      imageId = "img_" + id + "_" + Math.random().toString(36).slice(2, 5);
      await saveImage(imageId, d.image);
      setImageCache(prev => ({ ...prev, [imageId!]: d.image! }));
    }
    if (!d.image) imageId = undefined;
    const tags = d.tags.split(",").map(t => t.trim()).filter(Boolean);
    const localDt = new Date(`${d.date}T${d.time || "12:00"}:00`);
    const isoDate = Number.isNaN(localDt.getTime()) ? getWorldNowIso() : localDt.toISOString();
    const post: NewsPost = {
      id,
      content: d.content.trim(),
      title: d.title.trim() || undefined,
      author: d.author.trim() || undefined,
      category: d.category || undefined,
      tags: tags.length ? tags : undefined,
      source: d.source.trim() || undefined,
      pinned: d.pinned || undefined,
      imageId,
      date: isoDate,
    };
    if (d.poll) {
      const options = d.poll.options.split("\n").map(o => o.trim()).filter(Boolean).slice(0, 6);
      if (d.poll.question.trim() && options.length >= 2) {
        const prev = editingId ? posts.find(p => p.id === editingId)?.poll : undefined;
        const same = prev && prev.options.join("|") === options.join("|");
        post.poll = { question: d.poll.question.trim(), options, votes: same ? prev!.votes : seedPollVotes(id, options) };
      }
    }
    if (d.embeds.length) post.embeds = d.embeds;
    if (d.cover?.teamA) post.cover = d.cover;
    setPosts(prev => editingId ? prev.map(p => p.id === editingId ? post : p) : [post, ...prev]);
    toast.success(editingId ? "Zaktualizowano post" : "Opublikowano post");
    const wasNew = !editingId;
    resetForm();
    setShowNew(false);
    if (wasNew && (post.content || post.title)) {
      setCommentPending(post.id);
      generateComments(post)
        .then(res => {
          if (!res.ok) toast.error(res.error || "Nie udało się wygenerować komentarzy");
          else toast.success(`Społeczność skomentowała (${res.count})`);
        })
        .finally(() => setCommentPending(null));
    }
  }, [editingId, posts, imageCache, resetForm]);


  const categoryLabel = useCallback((cat: string) => CATEGORY_BADGES[cat]?.label || cat, []);
  const handleCancelComposer = useCallback(() => { setShowNew(false); resetForm(); }, [resetForm]);

  const handleDelete = async (post: NewsPost) => {
    if (post.imageId) await deleteImage(post.imageId);
    deleteComments([post.id]);
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
    deleteComments(ids);
    setPosts(prev => prev.filter(p => !idSet.has(p.id)));
    setSelected([]);
    toast.success(`Usunięto ${removed.length} ${removed.length === 1 ? "post" : "postów"}`);
  };

  const togglePin = (id: string) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, pinned: !p.pinned } : p));
  };

  const allCategories = useMemo(() => Array.from(new Set([
    ...Object.keys(CATEGORY_BADGES),
    ...posts.map(p => p.category).filter(Boolean) as string[],
  ])), [posts]);
  const usedCategories = useMemo(() => Array.from(new Set(posts.map(p => p.category).filter(Boolean))) as string[], [posts]);
  const years = useMemo(() => Array.from(new Set(posts.map(p => (p.date || "").slice(0, 4)).filter(Boolean))).sort().reverse(), [posts]);

  const authors = useMemo(() => Array.from(new Set(posts.map(p => p.author).filter(Boolean))).sort() as string[], [posts]);
  const allTags = useMemo(() => Array.from(new Set(posts.flatMap(p => p.tags || []))).sort(), [posts]);
  const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"];
  const MONTH_LABELS = ["Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec","Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"];

  const q = search.trim().toLowerCase();
  const sorted = useMemo(() => [...posts]
    .filter(p => cats.length === 0 || (p.category && cats.includes(p.category)))
    .filter(p => yearFilter === "all" || (p.date || "").slice(0, 4) === yearFilter)
    .filter(p => monthFilter === "all" || (p.date || "").slice(5, 7) === monthFilter)
    .filter(p => authorFilter === "all" || p.author === authorFilter)
    .filter(p => tagFilter === "all" || (p.tags || []).includes(tagFilter))
    .filter(p => !dateFrom || (p.date || "").slice(0, 10) >= dateFrom)
    .filter(p => !dateTo || (p.date || "").slice(0, 10) <= dateTo)
    .filter(p => !imageOnly || !!p.imageId)
    .filter(p => !pinnedOnly || p.pinned)
    .filter(p => !q || [p.title, p.content, p.author, p.category, ...(p.tags || [])]
      .filter(Boolean).join(" ").toLowerCase().includes(q))
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return sortDir === "desc" ? diff : -diff;
    }), [posts, cats, yearFilter, monthFilter, authorFilter, tagFilter, dateFrom, dateTo, imageOnly, pinnedOnly, q, sortDir]);


  const activeFilters: { key: string; label: string; clear: () => void }[] = [
    ...cats.map(c => ({ key: `cat-${c}`, label: CATEGORY_BADGES[c]?.label || c, clear: () => setCats(prev => prev.filter(x => x !== c)) })),
    ...(yearFilter !== "all" ? [{ key: "year", label: `Rok ${yearFilter}`, clear: () => setYearFilter("all") }] : []),
    ...(monthFilter !== "all" ? [{ key: "month", label: MONTH_LABELS[MONTHS.indexOf(monthFilter)], clear: () => setMonthFilter("all") }] : []),
    ...(authorFilter !== "all" ? [{ key: "author", label: `Autor: ${authorFilter}`, clear: () => setAuthorFilter("all") }] : []),
    ...(tagFilter !== "all" ? [{ key: "tag", label: `#${tagFilter}`, clear: () => setTagFilter("all") }] : []),
    ...(dateFrom ? [{ key: "from", label: `Od ${dateFrom}`, clear: () => setDateFrom("") }] : []),
    ...(dateTo ? [{ key: "to", label: `Do ${dateTo}`, clear: () => setDateTo("") }] : []),
    ...(imageOnly ? [{ key: "img", label: "Ze zdjęciem", clear: () => setImageOnly(false) }] : []),
    ...(pinnedOnly ? [{ key: "pin", label: "Przypięte", clear: () => setPinnedOnly(false) }] : []),
    ...(q ? [{ key: "q", label: `"${search.trim()}"`, clear: () => setSearch("") }] : []),
  ];
  const clearAll = () => {
    setCats([]); setYearFilter("all"); setMonthFilter("all"); setAuthorFilter("all");
    setTagFilter("all"); setDateFrom(""); setDateTo(""); setImageOnly(false);
    setPinnedOnly(false); setSearch("");
  };

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const goPage = (n: number) => {
    setPage(Math.min(Math.max(1, n), totalPages));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };


  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const eventCount = useMemo(() => buildSnapshot().events?.length ?? 0, [posts.length]);

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
        <div className="rounded-xl border border-border bg-card/60 p-3 mb-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Szukaj: tytuł, treść, tag, drużyna..."
                className="w-full h-9 pl-8 pr-2 rounded-md border border-border bg-secondary/40 text-sm font-mono text-foreground"
              />
            </div>
            <button
              onClick={() => setSortDir(d => d === "desc" ? "asc" : "desc")}
              className="h-9 px-2.5 rounded-md border border-border bg-secondary/40 text-xs font-mono text-muted-foreground hover:text-foreground"
            >
              {sortDir === "desc" ? "Najnowsze" : "Najstarsze"}
            </button>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={cn(
                "h-9 px-2.5 rounded-md border text-xs font-mono transition-colors flex items-center gap-1.5",
                showFilters || activeFilters.length
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
              )}
            >
              Filtry{activeFilters.length ? ` (${activeFilters.length})` : ""}
              <ChevronDown className={cn("w-3 h-3 transition-transform", showFilters && "rotate-180")} />
            </button>
          </div>

          {/* Active filter chips */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {activeFilters.map(f => (
                <button
                  key={f.key}
                  onClick={f.clear}
                  className="text-xs font-mono px-2 py-0.5 rounded-full border border-primary/40 bg-primary/10 text-primary flex items-center gap-1 hover:bg-primary/20"
                >
                  {f.label} <X className="w-3 h-3" />
                </button>
              ))}
              <button onClick={clearAll} className="text-xs font-mono px-2 py-0.5 text-muted-foreground hover:text-foreground underline">
                wyczyść wszystkie
              </button>
            </div>
          )}

          <AnimatePresence initial={false}>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-1 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <select
                      value={yearFilter}
                      onChange={e => setYearFilter(e.target.value)}
                      className="h-9 px-2 rounded-md border border-border bg-secondary/40 text-xs font-mono text-foreground"
                    >
                      <option value="all">Wszystkie lata</option>
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select
                      value={monthFilter}
                      onChange={e => setMonthFilter(e.target.value)}
                      className="h-9 px-2 rounded-md border border-border bg-secondary/40 text-xs font-mono text-foreground"
                    >
                      <option value="all">Wszystkie miesiące</option>
                      {MONTHS.map((m, i) => <option key={m} value={m}>{MONTH_LABELS[i]}</option>)}
                    </select>
                    <select
                      value={authorFilter}
                      onChange={e => setAuthorFilter(e.target.value)}
                      className="h-9 px-2 rounded-md border border-border bg-secondary/40 text-xs font-mono text-foreground"
                    >
                      <option value="all">Wszyscy autorzy</option>
                      {authors.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <select
                      value={tagFilter}
                      onChange={e => setTagFilter(e.target.value)}
                      className="h-9 px-2 rounded-md border border-border bg-secondary/40 text-xs font-mono text-foreground"
                    >
                      <option value="all">Wszystkie tagi</option>
                      {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground">Zakres dat:</span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="h-9 px-2 rounded-md border border-border bg-secondary/40 text-xs font-mono text-foreground"
                    />
                    <span className="text-xs text-muted-foreground">—</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="h-9 px-2 rounded-md border border-border bg-secondary/40 text-xs font-mono text-foreground"
                    />
                    <button
                      onClick={() => setPinnedOnly(v => !v)}
                      className={cn(
                        "h-9 px-2.5 rounded-md border text-xs font-mono transition-colors",
                        pinnedOnly ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Tylko przypięte
                    </button>
                    <button
                      onClick={() => setImageOnly(v => !v)}
                      className={cn(
                        "h-9 px-2.5 rounded-md border text-xs font-mono transition-colors",
                        imageOnly ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Ze zdjęciem
                    </button>
                  </div>

                  {/* Category multi-select pills */}
                  {usedCategories.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap pt-1 border-t border-border/60">
                      <button
                        onClick={() => setCats([])}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-full font-mono border transition-colors mt-2",
                          cats.length === 0 ? "bg-primary/20 text-primary border-primary/40" : "bg-secondary/40 text-muted-foreground border-border hover:bg-secondary",
                        )}
                      >
                        Wszystkie ({posts.length})
                      </button>
                      {usedCategories.map(cat => {
                        const meta = CATEGORY_BADGES[cat] || { label: cat, color: "bg-secondary/40 text-foreground border-border" };
                        const count = posts.filter(p => p.category === cat).length;
                        const on = cats.includes(cat);
                        return (
                          <button
                            key={cat}
                            onClick={() => setCats(prev => on ? prev.filter(c => c !== cat) : [...prev, cat])}
                            className={cn(
                              "text-xs px-2.5 py-1 rounded-full font-mono border transition-colors mt-2",
                              on ? meta.color : "bg-secondary/40 text-muted-foreground border-border hover:bg-secondary",
                            )}
                          >
                            {meta.label} ({count})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result count + page size */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60">
            <span className="text-xs font-mono text-muted-foreground pt-2">
              Znaleziono {sorted.length} {sorted.length === 1 ? "post" : "postów"} · strona {currentPage}/{totalPages}
            </span>
            <div className="flex items-center gap-1.5 pt-2">
              <span className="text-xs font-mono text-muted-foreground">Na stronę:</span>
              <select
                value={pageSize}
                onChange={e => setPageSize(Number(e.target.value))}
                className="h-8 px-2 rounded-md border border-border bg-secondary/40 text-xs font-mono text-foreground"
              >
                {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>


        {/* New post form (izolowany komponent — brak re-renderu listy przy pisaniu) */}
        {showNew && (
          <div className="mb-6">
            <NewsComposer
              key={composerKey}
              initial={draft}
              editing={!!editingId}
              categories={allCategories}
              categoryLabel={categoryLabel}
              onSubmit={handlePost}
              onCancel={handleCancelComposer}
            />
          </div>
        )}



        {/* Posts */}
        <div className="space-y-4">
          {sorted.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-mono text-sm">{activeFilters.length ? "Brak postów pasujących do filtrów." : "Brak postów. Wygeneruj AI lub dodaj pierwszy!"}</p>
            </div>
          )}
          {pageItems.map((post, i) => {
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
                {post.title && (
                  <h3 className="font-heading font-bold text-foreground text-lg mb-1.5 leading-snug">{post.title}</h3>
                )}
                {post.cover && !(post.imageId && imageCache[post.imageId]) && <CoverBanner cover={post.cover} />}
                {post.content && (
                  <p className="text-foreground text-sm whitespace-pre-wrap mb-3 leading-relaxed">{post.content}</p>
                )}
                {post.embeds && post.embeds.length > 0 && <EmbedCards embeds={post.embeds} />}
                {post.poll && <PollBox postId={post.id} poll={post.poll} />}
                <SentimentBar postId={post.id} category={post.category} version={commentPending === post.id ? 1 : 0} />
                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {post.tags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => setSearch(tag)}
                        className="text-xs font-mono px-2 py-0.5 rounded-full border border-border bg-secondary/40 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}
                {post.imageId && imageCache[post.imageId] && (
                  <img
                    src={imageCache[post.imageId]}
                    alt="Post"
                    className="rounded-md max-w-full mb-3 cursor-zoom-in hover:opacity-90 transition-opacity"
                    onClick={() => setLightbox(imageCache[post.imageId!])}
                  />
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-mono flex-wrap">
                    <Clock className="w-3 h-3" />
                    {formatDate(post.date)}
                    {post.author && <span>· {post.author}</span>}
                    {post.source && <span className="opacity-70">· {post.source}</span>}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => startEdit(post)}
                      title="Edytuj"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
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
                <PostComments post={post} pending={commentPending === post.id} />
              </motion.div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-6">
            <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => goPage(1)}>«</Button>
            <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => goPage(currentPage - 1)}>Poprzednia</Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPages || Math.abs(n - currentPage) <= 2)
              .map((n, idx, arr) => (
                <span key={n} className="flex items-center gap-1.5">
                  {idx > 0 && n - arr[idx - 1] > 1 && <span className="text-xs text-muted-foreground px-1">…</span>}
                  <button
                    onClick={() => goPage(n)}
                    className={cn(
                      "h-8 min-w-8 px-2 rounded-md border text-xs font-mono transition-colors",
                      n === currentPage
                        ? "border-primary/40 bg-primary/20 text-primary"
                        : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {n}
                  </button>
                </span>
              ))}
            <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => goPage(currentPage + 1)}>Następna</Button>
            <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => goPage(totalPages)}>»</Button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setLightbox(null)}
          >
            <button
              className="absolute top-4 right-4 p-2 rounded-md border border-border bg-secondary/60 text-foreground hover:text-primary"
              onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
              title="Zamknij"
            >
              <X className="w-4 h-4" />
            </button>
            <motion.img
              initial={{ scale: 0.94 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.94 }}
              src={lightbox}
              alt="Podgląd"
              className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>

  );
};

export default NewsFeed;
