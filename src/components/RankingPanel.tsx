import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Users, Plus, Edit3, Check, X, Search, ChevronUp, ChevronDown, Globe, User,
  Trophy, TrendingUp, TrendingDown, Minus, Crown, Medal, Award, BarChart3, Activity, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { TeamData, RankingAdjustment } from "@/lib/types";
import { saveToStorage, loadFromStorage } from "@/lib/storage";
import { teamDatabase } from "@/data/tournaments";
import { countryFlag } from "@/lib/flags";
import { playerNationalities } from "@/data/playerNationalities";
import TeamLogo from "@/components/TeamLogo";
import PanelHeader from "@/components/PanelHeader";
import { getWorldDate, getWorldNowIso } from "@/lib/worldClock";
import { getRankingAt, getTeamRankingSeries } from "@/lib/rankingHistory";
import { CalendarClock } from "lucide-react";

// Mini wykres punktów (sparkline) — broadcast style
const Sparkline = ({ team, width = 46, height = 14 }: { team: string; width?: number; height?: number }) => {
  const pts = useMemo(() => getTeamRankingSeries(team).slice(-14).map(p => p.points), [team]);
  if (pts.length < 2) return <span className="inline-block" style={{ width, height }} />;
  const min = Math.min(...pts), max = Math.max(...pts);
  const span = max - min || 1;
  const d = pts.map((v, i) => `${(i / (pts.length - 1)) * width},${height - ((v - min) / span) * height}`).join(" L");
  const rising = pts[pts.length - 1] >= pts[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={rising ? "text-[hsl(var(--win))]" : "text-[hsl(var(--loss))]"} fill="none" aria-hidden>
      <path d={`M${d}`} stroke="currentColor" strokeWidth="1.5" opacity="0.7" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};


type RegionFilter = "all" | "EU" | "US" | "LATAM" | "ASIA" | "OCE" | "AFR";

const RANKING_KEY = "ranking_data";
const ADJUSTMENTS_KEY = "ranking_adjustments";
const SNAPSHOT_KEY = "ranking_snapshot_prev"; // poprzednia migawka do trendów

interface RankingPanelProps {
  onSelectTeam?: (name: string) => void;
  onSelectPlayer?: (name: string) => void;
}

const tierFor = (rank: number) => {
  if (rank <= 10) return { label: "S", color: "text-accent", bg: "bg-accent/15 border-accent/40" };
  if (rank <= 25) return { label: "A", color: "text-primary", bg: "bg-primary/15 border-primary/40" };
  if (rank <= 50) return { label: "B", color: "text-[hsl(var(--silver))]", bg: "bg-[hsl(var(--silver)/0.15)] border-[hsl(var(--silver)/0.4)]" };
  if (rank <= 100) return { label: "C", color: "text-muted-foreground", bg: "bg-muted/40 border-border" };
  return { label: "—", color: "text-muted-foreground", bg: "bg-muted/40 border-border" };
};

const RankingPanel = ({ onSelectTeam, onSelectPlayer }: RankingPanelProps) => {
  const [teams, setTeams] = useState<TeamData[]>(() => {
    const saved = loadFromStorage<TeamData[] | null>(RANKING_KEY, null);
    if (saved) return saved;
    return teamDatabase.map(t => ({ ...t }));
  });
  const [adjustments, setAdjustments] = useState<RankingAdjustment[]>(() =>
    loadFromStorage<RankingAdjustment[]>(ADJUSTMENTS_KEY, [])
  );
  const [prevSnapshot, setPrevSnapshot] = useState<Record<string, number>>(() =>
    loadFromStorage<Record<string, number>>(SNAPSHOT_KEY, {})
  );
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");
  const [nationalityFilter, setNationalityFilter] = useState<string>("all");
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjTeam, setAdjTeam] = useState("");
  const [adjPoints, setAdjPoints] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editPoints, setEditPoints] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const [showPast, setShowPast] = useState(false);
  const [pastDate, setPastDate] = useState(() => getWorldDate());
  const pastRanking = useMemo(() => (showPast ? getRankingAt(pastDate) : []), [showPast, pastDate]);

  useEffect(() => { saveToStorage(RANKING_KEY, teams); }, [teams]);
  useEffect(() => { saveToStorage(ADJUSTMENTS_KEY, adjustments); }, [adjustments]);

  const sorted = useMemo(() => [...teams].filter(t => !t.isNational).sort((a, b) => b.points - a.points), [teams]);

  // Poprzednie pozycje (z migawki)
  const prevRanks = useMemo(() => {
    const arr = Object.entries(prevSnapshot).sort((a, b) => b[1] - a[1]);
    const map: Record<string, number> = {};
    arr.forEach(([name], i) => { map[name] = i + 1; });
    return map;
  }, [prevSnapshot]);

  const allNationalities = useMemo(() => {
    const set = new Set<string>();
    teams.forEach(t => t.roster.forEach(p => set.add(playerNationalities[p] || t.country)));
    return Array.from(set).sort();
  }, [teams]);

  const filtered = useMemo(() => {
    return sorted.filter(t => {
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (regionFilter !== "all" && t.region !== regionFilter) return false;
      if (nationalityFilter !== "all" && !t.roster.some(p => (playerNationalities[p] || t.country) === nationalityFilter)) return false;
      return true;
    });
  }, [sorted, search, regionFilter, nationalityFilter]);

  // === Statystyki agregowane ===
  const stats = useMemo(() => {
    const totalPoints = sorted.reduce((s, t) => s + t.points, 0);
    const avgPoints = sorted.length ? Math.round(totalPoints / sorted.length) : 0;
    const top = sorted[0];
    const regionCounts: Record<string, number> = {};
    sorted.forEach(t => { regionCounts[t.region] = (regionCounts[t.region] || 0) + 1; });
    const regionsRanked = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]);
    const dominantRegion = regionsRanked[0];
    const totalPlayers = sorted.reduce((s, t) => s + t.roster.length, 0);
    return { totalPoints, avgPoints, top, dominantRegion, regionsRanked, totalPlayers };
  }, [sorted]);

  

  const handleAdjust = () => {
    const pts = parseInt(adjPoints);
    if (!adjTeam || isNaN(pts)) return;
    const adj: RankingAdjustment = {
      id: Date.now().toString(36),
      team: adjTeam,
      points: pts,
      reason: adjReason.trim() || (pts > 0 ? "Dodanie punktów" : "Odjęcie punktów"),
      date: getWorldNowIso(),
    };
    setTeams(prev => prev.map(t =>
      t.name === adjTeam ? { ...t, points: Math.max(0, t.points + pts) } : t
    ));
    setAdjustments(prev => [adj, ...prev]);
    setAdjTeam(""); setAdjPoints(""); setAdjReason(""); setShowAdjust(false);
  };

  const handleHalveAll = () => {
    const targets = teams.filter(t => !t.isNational && t.points > 0);
    if (targets.length === 0) return;
    if (!window.confirm(`Podzielić punkty ${targets.length} drużynom na pół (zaokrąglenie w górę)?`)) return;
    const now = getWorldNowIso();
    const newAdjustments: RankingAdjustment[] = [];
    setTeams(prev => prev.map(t => {
      if (t.isNational || t.points <= 0) return t;
      const halved = Math.ceil(t.points / 2);
      const diff = halved - t.points;
      newAdjustments.push({
        id: `${Date.now().toString(36)}-${t.name}`,
        team: t.name,
        points: diff,
        reason: "Balansowanie: podział punktów na pół",
        date: now,
      });
      return { ...t, points: halved };
    }));
    setAdjustments(prev => [...newAdjustments, ...prev]);
  };



  const handleInlineEdit = (teamName: string) => {
    const pts = parseInt(editPoints);
    if (isNaN(pts) || pts < 0) { setEditingTeam(null); return; }
    const team = teams.find(t => t.name === teamName);
    if (!team) return;
    const diff = pts - team.points;
    const adj: RankingAdjustment = {
      id: Date.now().toString(36),
      team: teamName,
      points: diff,
      reason: "Ręczna edycja punktów",
      date: getWorldNowIso(),
    };
    setTeams(prev => prev.map(t => t.name === teamName ? { ...t, points: pts } : t));
    setAdjustments(prev => [adj, ...prev]);
    setEditingTeam(null);
  };

  const captureSnapshot = () => {
    const snap: Record<string, number> = {};
    sorted.forEach(t => { snap[t.name] = t.points; });
    saveToStorage(SNAPSHOT_KEY, snap);
    setPrevSnapshot(snap);
  };

  const trendFor = (teamName: string, currentRank: number) => {
    const prev = prevRanks[teamName];
    if (!prev) return { dir: "new" as const, diff: 0 };
    if (prev === currentRank) return { dir: "same" as const, diff: 0 };
    return prev > currentRank
      ? { dir: "up" as const, diff: prev - currentRank }
      : { dir: "down" as const, diff: currentRank - prev };
  };

  const top3 = sorted.slice(0, 3);

  return (
    <section className="py-6 relative overflow-hidden">
      {/* Tactical micro-grid + scanlines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.12]"
        style={{ backgroundImage: "radial-gradient(hsl(var(--primary)) 0.5px, transparent 0.5px)", backgroundSize: "16px 16px" }}
        aria-hidden
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04] z-10"
        style={{ background: "linear-gradient(hsl(var(--background)/0) 50%, hsl(var(--background)) 50%)", backgroundSize: "100% 3px" }}
        aria-hidden
      />
      <div className="container mx-auto px-4 relative z-20">

        {/* === HEADER === */}
        <PanelHeader
          icon={Trophy}
          title="Ranking drużyn"
          meta={`${sorted.length} drużyn · aktualizowany na bieżąco`}
          actions={
            <>
              <Button size="sm" variant="outline" onClick={captureSnapshot} className="gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                Zapisz migawkę
              </Button>
              <Button size="sm" variant="outline" onClick={handleHalveAll} className="gap-1.5" title="Dzieli punkty wszystkich drużyn klubowych na pół (zaokrąglenie w górę)">
                <Sparkles className="w-3.5 h-3.5" />
                Podziel punkty ÷2
              </Button>
              <Dialog open={showPast} onOpenChange={setShowPast}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5" />
                    Ranking z dnia
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Ranking historyczny</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 pt-2">
                    <Input type="date" value={pastDate} onChange={e => setPastDate(e.target.value)} />
                    <div className="max-h-[55vh] overflow-y-auto pr-1 space-y-1">
                      {pastRanking.length === 0 && (
                        <p className="text-sm font-mono text-muted-foreground">Brak danych dla tej daty.</p>
                      )}
                      {pastRanking.map(r => (
                        <div key={r.team} className="flex items-center gap-3 px-2 py-1.5 rounded-md bg-secondary/30">
                          <span className="w-8 text-right font-mono text-xs text-muted-foreground tabular-nums">#{r.rank}</span>
                          <TeamLogo teamName={r.team} size={22} />
                          <span className="flex-1 text-sm font-heading truncate">{r.team}</span>
                          <span className="font-mono text-xs tabular-nums text-primary">{r.points.toLocaleString()} pkt</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Plus className="w-4 h-4" /> Korekta punktów
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Zmień punkty drużyny</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="text-sm font-mono text-muted-foreground mb-1 block">Drużyna</label>
                      <select
                        value={adjTeam}
                        onChange={e => setAdjTeam(e.target.value)}
                        className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground text-sm font-mono"
                      >
                        <option value="">Wybierz drużynę...</option>
                        {sorted.map(t => <option key={t.name} value={t.name}>{t.name} ({t.points} pkt)</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-mono text-muted-foreground mb-1 block">
                        Punkty (+ dodaj, - odejmij)
                      </label>
                      <Input type="number" placeholder="+100 lub -50" value={adjPoints} onChange={e => setAdjPoints(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm font-mono text-muted-foreground mb-1 block">Powód (opcjonalnie)</label>
                      <Input placeholder="np. Wygrana turnieju, kara..." value={adjReason} onChange={e => setAdjReason(e.target.value)} />
                    </div>
                    <Button onClick={handleAdjust} className="w-full">Zastosuj zmianę</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          }
        />

        {/* === PODIUM TOP 3 === */}
        {top3.length === 3 && (
          <div className="grid grid-cols-3 gap-3 items-end mb-6 pt-2 max-w-xl mx-auto">
            {[1, 0, 2].map((idx, displayIdx) => {
              const team = top3[idx];
              if (!team) return null;
              const rank = idx + 1;
              const isChamp = rank === 1;
              const barColor = rank === 1 ? "bg-[hsl(var(--gold))]" : rank === 2 ? "bg-[hsl(var(--silver))]" : "bg-[hsl(var(--bronze))]";
              const label = rank === 1 ? "Champion" : `Rank_0${rank}`;
              return (
                <motion.button
                  key={team.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: displayIdx * 0.08 }}
                  onClick={() => onSelectTeam?.(team.name)}
                  className={cn(
                    "group flex flex-col items-center gap-2",
                    rank === 1 ? "order-2 z-10 scale-105" : rank === 2 ? "order-1 translate-y-2" : "order-3 translate-y-2",
                  )}
                >
                  <div className={cn(
                    "relative w-full aspect-square bg-card border flex items-center justify-center overflow-hidden transition-all",
                    isChamp
                      ? "border-[hsl(var(--gold)/0.45)] shadow-[0_0_25px_hsl(var(--gold)/0.15)]"
                      : "border-border group-hover:border-primary/50",
                  )}>
                    <div className="absolute inset-0 opacity-[0.05] bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,currentColor_5px,currentColor_6px)] text-foreground" />
                    {isChamp && (
                      <>
                        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-[hsl(var(--gold))]" />
                        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-[hsl(var(--gold))]" />
                        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at center, hsl(var(--gold)/0.12) 0%, transparent 70%)" }} />
                      </>
                    )}
                    <TeamLogo teamName={team.name} size={isChamp ? 56 : 44} rounded="md" />
                    <div className={cn("absolute bottom-0 w-full", isChamp ? "h-1.5" : "h-1", barColor)} />
                  </div>
                  <div className="text-center min-w-0 w-full">
                    <p className={cn(
                      "text-xs font-mono uppercase tracking-widest",
                      isChamp ? "text-[hsl(var(--gold))] font-bold" : "text-muted-foreground",
                    )}>{label}</p>
                    <p className="text-xs md:text-sm font-heading font-black uppercase truncate group-hover:text-primary transition-colors">{team.name}</p>
                    <div className="flex items-center justify-center gap-1.5 mt-0.5">
                      <Sparkline team={team.name} width={isChamp ? 30 : 24} height={10} />
                      <span className="text-xs font-mono text-primary tabular-nums">{team.points.toLocaleString()}</span>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground mt-0.5">
                      {countryFlag(team.country)} {team.country}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}


        {/* === FILTERS === */}
        <div className="bg-card/60 border border-border rounded-xl p-3 mb-4 space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Szukaj drużyny lub gracza..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-secondary/40 border-border"
            />
            {onSelectPlayer && search.trim().length >= 2 && (() => {
              const q = search.toLowerCase();
              const matches: { player: string; team: string; country: string }[] = [];
              for (const t of teams) {
                for (const p of t.roster) {
                  if (p.toLowerCase().includes(q)) {
                    matches.push({ player: p, team: t.name, country: playerNationalities[p] || t.country });
                    if (matches.length >= 8) break;
                  }
                }
                if (matches.length >= 8) break;
              }
              if (matches.length === 0) return null;
              return (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-xl overflow-hidden">
                  <div className="px-3 py-1.5 text-xs font-mono uppercase text-muted-foreground tracking-wider border-b border-border/50 bg-secondary/40">
                    Gracze ({matches.length})
                  </div>
                  {matches.map(m => (
                    <button
                      key={`${m.team}-${m.player}`}
                      onClick={() => { onSelectPlayer(m.player); setSearch(""); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-mono hover:bg-secondary/40 transition-colors text-left"
                    >
                      <User className="w-3 h-3 text-primary shrink-0" />
                      <span>{countryFlag(m.country)}</span>
                      <span className="font-bold text-foreground">{m.player}</span>
                      <span className="text-muted-foreground ml-auto">{m.team}</span>
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>

          <div className="flex items-start gap-6 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Globe className="w-4 h-4 text-muted-foreground" />
              {(["all", "EU", "US", "LATAM", "ASIA", "OCE", "AFR"] as RegionFilter[]).map(r => (
                <button
                  key={r}
                  onClick={() => setRegionFilter(r)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-mono rounded-md border transition-all",
                    regionFilter === r
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
                  )}
                >
                  {r === "all" ? "Wszystkie" : r}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <select
                value={nationalityFilter}
                onChange={e => setNationalityFilter(e.target.value)}
                className="px-2 py-1 text-xs font-mono rounded-md border border-border bg-secondary/50 text-foreground focus:outline-none focus:border-primary/50"
              >
                <option value="all">Wszystkie narodowości</option>
                {allNationalities.map(n => (
                  <option key={n} value={n}>{countryFlag(n)} {n}</option>
                ))}
              </select>
              {nationalityFilter !== "all" && (
                <span className="text-xs text-muted-foreground font-mono">
                  {filtered.length} drużyn
                </span>
              )}
            </div>

            <div className="ml-auto text-xs font-mono text-muted-foreground">
              Pokazano <span className="text-foreground font-bold">{filtered.length}</span> z {sorted.length}
            </div>
          </div>
        </div>

        {/* === MAIN TABLE === */}
        <div className="bg-card/80 border border-border rounded-xl overflow-hidden backdrop-blur-sm">
          {/* Header — desktop only */}
          <div className="hidden md:grid grid-cols-[50px_60px_110px_1fr_70px_80px_70px_60px_50px] gap-2 px-4 py-2.5 bg-gradient-to-r from-secondary/60 to-secondary/20 border-b border-primary/20 text-xs font-mono text-primary/60 uppercase tracking-[0.2em]">
            <div className="text-center">#</div>
            <div className="text-center">Trend</div>
            <div className="text-center">Punkty</div>
            <div>Team_ID</div>
            <div className="text-center">Class</div>
            <div className="text-center">Region</div>
            <div className="text-center">Forma</div>
            <div className="text-right">Skład</div>
            <div className="text-right">Akcje</div>
          </div>




          {filtered.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground font-mono">
              Brak drużyn spełniających kryteria filtrów.
            </div>
          )}

          {filtered.map((team, i) => {
            const globalRank = sorted.findIndex(t => t.name === team.name) + 1;
            const isEditing = editingTeam === team.name;
            const tier = tierFor(globalRank);
            const trend = trendFor(team.name, globalRank);

            const RankBadge = (
              <span className={cn(
                "inline-flex items-center justify-center rounded-md font-black text-xs border",
                globalRank <= 3 ? "w-7 h-7" : "w-6 h-6",
                globalRank === 1 && "text-[hsl(var(--gold))] border-[hsl(var(--gold)/0.4)] bg-[hsl(var(--gold)/0.1)]",
                globalRank === 2 && "text-[hsl(var(--silver))] border-[hsl(var(--silver)/0.4)] bg-[hsl(var(--silver)/0.1)]",
                globalRank === 3 && "text-[hsl(var(--bronze))] border-[hsl(var(--bronze)/0.4)] bg-[hsl(var(--bronze)/0.1)]",
                globalRank > 3 && "text-muted-foreground border-border bg-secondary/40",
              )}>
                {globalRank}
              </span>
            );

            const PointsPill = (
              <span className={cn(
                "inline-flex items-baseline gap-1 rounded-md px-2 py-1 font-mono border",
                globalRank <= 3
                  ? "bg-gradient-to-r from-primary/15 to-accent/15 border-primary/40 text-foreground"
                  : globalRank <= 15
                    ? "bg-primary/10 border-primary/25 text-foreground"
                    : "bg-secondary/60 border-border text-foreground"
              )}>
                <span className="text-sm font-black tracking-tight">{team.points.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider">pkt</span>
              </span>
            );

            const isOpen = expandedTeam === team.name;

            return (
              <div key={team.name} className={cn("border-t border-border/40", isOpen && "bg-secondary/20")}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.008, 0.4) }}
                onClick={() => setExpandedTeam(isOpen ? null : team.name)}
                className={cn(
                  "items-center hover:bg-secondary/30 transition-colors group cursor-pointer border-l-2",
                  globalRank === 1 ? "border-l-[hsl(var(--gold))]" : globalRank === 2 ? "border-l-[hsl(var(--silver))]" : globalRank === 3 ? "border-l-[hsl(var(--bronze))]" : isOpen ? "border-l-primary" : "border-l-transparent",
                  // Mobile: compact 3-column row
                  "grid grid-cols-[36px_1fr_auto] gap-2 px-3 py-2",
                  // Desktop: full table
                  "md:grid-cols-[50px_60px_110px_1fr_70px_80px_70px_60px_50px] md:gap-2 md:px-4 md:py-2.5",
                  globalRank <= 3 && "bg-primary/[0.03]"
                )}
              >
                {/* Rank */}
                <div className="text-center font-mono flex md:block justify-center">
                  {RankBadge}
                </div>

                {/* Trend — desktop */}
                <div className="hidden md:flex justify-center">
                  <TrendBadge trend={trend} compact />
                </div>

                {/* Points — desktop */}
                <div className="hidden md:flex justify-center" onClick={e => { if (isEditing) e.stopPropagation(); }}>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={editPoints}
                      onChange={e => setEditPoints(e.target.value)}
                      className="h-7 w-24 text-xs"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === "Enter") handleInlineEdit(team.name);
                        if (e.key === "Escape") setEditingTeam(null);
                      }}
                    />
                  ) : PointsPill}
                </div>



                {/* Team */}
                <div className="min-w-0 flex items-center gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelectTeam?.(team.name); }}
                    className="flex items-center gap-2 md:gap-2.5 group/team text-left min-w-0 flex-1"
                  >
                    <TeamLogo teamName={team.name} size={28} rounded="md" />
                    <div className="min-w-0">
                      <div className="font-heading font-bold text-foreground group-hover/team:text-primary transition-colors truncate text-sm md:text-base uppercase tracking-tight">
                        {team.name}
                      </div>
                      <div className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                        <span>{countryFlag(team.country)}</span>
                        <span className="truncate">{team.country}</span>
                        <span className="md:hidden text-border">•</span>
                        <span className="md:hidden">{team.region}</span>
                        <span className="md:hidden text-border">•</span>
                        <span className={cn("md:hidden font-bold", tier.color)}>{tier.label}</span>
                      </div>
                    </div>
                  </button>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform", isOpen && "rotate-180 text-primary")} />
                </div>

                {/* Tier — desktop */}
                <div className="hidden md:flex justify-center">
                  <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-black border", tier.bg, tier.color)}>
                    {tier.label}
                  </span>
                </div>

                {/* Region — desktop */}
                <div className="hidden md:block text-center text-xs text-muted-foreground font-mono">{team.region}</div>

                {/* Forma (sparkline) — desktop */}
                <div className="hidden md:flex justify-center items-center">
                  <Sparkline team={team.name} />
                </div>




                {/* Roster — desktop */}
                <div className="hidden md:block text-right text-xs font-mono text-muted-foreground">
                  {team.roster.length}
                </div>

                {/* Actions — desktop */}
                <div className="hidden md:flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  {isEditing ? (
                    <>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleInlineEdit(team.name)}>
                        <Check className="w-3 h-3 text-[hsl(var(--win))]" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingTeam(null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => { setEditingTeam(team.name); setEditPoints(team.points.toString()); }}
                    >
                      <Edit3 className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                {/* Mobile: trend + points, wyrównane w kolumnach */}
                <div className="md:hidden flex items-center gap-2">
                  <span className="w-8 flex justify-end"><TrendBadge trend={trend} compact /></span>
                  <span className="w-[92px] flex justify-end">{PointsPill}</span>
                </div>

              </motion.div>

              {/* Rozwijane szczegóły */}
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="overflow-hidden border-l-2 border-l-primary bg-background/40"
                >
                  <div className="px-4 py-3 grid gap-3 md:grid-cols-[1fr_260px]">
                    <div>
                      <p className="text-xs font-mono uppercase tracking-[0.2em] text-primary/60 mb-2">Skład</p>
                      <div className="flex flex-wrap gap-1.5">
                        {team.roster.length === 0 && <span className="text-xs font-mono text-muted-foreground">Brak zawodników</span>}
                        {team.roster.map(p => (
                          <button
                            key={p}
                            onClick={() => onSelectPlayer?.(p)}
                            className="px-2 py-1 rounded-md border border-border bg-card text-xs font-heading font-bold hover:border-primary/50 hover:text-primary transition-colors"
                          >
                            {countryFlag(playerNationalities[p] || team.country)} {p}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 content-start">
                      {[
                        { k: "Pozycja", v: `#${globalRank}` },
                        { k: "Punkty", v: team.points.toLocaleString() },
                        { k: "Tier", v: tier.label },
                        { k: "Region", v: team.region },
                      ].map(s => (
                        <div key={s.k} className="rounded-md border border-border bg-card/70 px-2.5 py-1.5">
                          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{s.k}</div>
                          <div className="font-heading font-black text-sm text-foreground">{s.v}</div>
                        </div>
                      ))}
                      <button
                        onClick={() => onSelectTeam?.(team.name)}
                        className="col-span-2 py-1.5 rounded-md border border-primary/40 bg-primary/10 text-primary text-xs font-mono uppercase tracking-[0.2em] hover:bg-primary/20 transition-colors"
                      >
                        Profil drużyny
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
              </div>
            );
          })}

        </div>

        {/* === REGION DISTRIBUTION === */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-heading font-bold text-foreground uppercase tracking-wider">Rozkład regionów</h3>
            </div>
            <div className="space-y-2">
              {stats.regionsRanked.map(([region, count]) => {
                const pct = (count / sorted.length) * 100;
                return (
                  <div key={region}>
                    <div className="flex items-center justify-between text-xs font-mono mb-1">
                      <span className="text-foreground font-bold">{region}</span>
                      <span className="text-muted-foreground">{count} drużyn ({pct.toFixed(1)}%)</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6 }}
                        className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-heading font-bold text-foreground uppercase tracking-wider">
                  Historia zmian
                </h3>
                <span className="text-xs font-mono text-muted-foreground">({adjustments.length})</span>
              </div>
              {adjustments.length > 6 && (
                <button
                  onClick={() => setShowHistory(s => !s)}
                  className="text-xs font-mono uppercase text-muted-foreground hover:text-primary transition-colors"
                >
                  {showHistory ? "Zwiń" : "Pokaż wszystkie"}
                </button>
              )}
            </div>
            {adjustments.length === 0 ? (
              <p className="text-xs text-muted-foreground font-mono py-4 text-center">
                Brak ręcznych korekt punktów.
              </p>
            ) : (
              <div className={cn("space-y-1.5 overflow-y-auto pr-1", showHistory ? "max-h-[420px]" : "max-h-48")}>
                {adjustments.slice(0, showHistory ? 999 : 6).map(adj => (
                  <div key={adj.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-secondary/40 rounded-md text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn(
                        "w-5 h-5 rounded flex items-center justify-center shrink-0",
                        adj.points > 0 ? "bg-[hsl(var(--win)/0.15)]" : "bg-[hsl(var(--loss)/0.15)]"
                      )}>
                        {adj.points > 0 ? (
                          <ChevronUp className="w-3 h-3 text-[hsl(var(--win))]" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-[hsl(var(--loss))]" />
                        )}
                      </div>
                      <span className="font-bold text-foreground truncate">{adj.team}</span>
                      <span className={cn("font-mono font-bold shrink-0", adj.points > 0 ? "text-[hsl(var(--win))]" : "text-[hsl(var(--loss))]")}>
                        {adj.points > 0 ? "+" : ""}{adj.points}
                      </span>
                      <span className="text-muted-foreground truncate">{adj.reason}</span>
                    </div>
                    <span className="text-muted-foreground font-mono shrink-0 text-xs">
                      {new Date(adj.date).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

// === Helper components ===

const StatCard = ({ icon, label, value, hint, accent }: {
  icon: React.ReactNode; label: string; value: string; hint?: string; accent?: boolean;
}) => (
  <div className={cn(
    "rounded-xl border bg-card/80 backdrop-blur-sm p-3 transition-all hover:border-primary/40",
    accent ? "border-primary/30" : "border-border"
  )}>
    <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
      {icon} {label}
    </div>
    <div className="font-heading font-black text-foreground text-lg leading-tight truncate">{value}</div>
    {hint && <div className="text-xs font-mono text-muted-foreground mt-0.5 truncate">{hint}</div>}
  </div>
);

const TrendBadge = ({ trend, compact }: {
  trend: { dir: "up" | "down" | "same" | "new"; diff: number };
  compact?: boolean;
}) => {
  if (trend.dir === "new") {
    return (
      <span className={cn(
        "inline-flex items-center gap-0.5 rounded font-mono font-bold border",
        compact ? "px-1 py-0 text-xs" : "px-1.5 py-0.5 text-xs",
        "bg-primary/15 text-primary border-primary/30"
      )}>NEW</span>
    );
  }
  if (trend.dir === "same") {
    return <Minus className={cn("text-muted-foreground", compact ? "w-3 h-3" : "w-3.5 h-3.5")} />;
  }
  const isUp = trend.dir === "up";
  const Icon = isUp ? TrendingUp : TrendingDown;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 rounded font-mono font-bold",
      compact ? "px-1 py-0 text-xs" : "px-1.5 py-0.5 text-xs",
      isUp ? "text-[hsl(var(--win))]" : "text-[hsl(var(--loss))]"
    )}>
      <Icon className={cn(compact ? "w-2.5 h-2.5" : "w-3 h-3")} />
      {trend.diff}
    </span>
  );
};

export default RankingPanel;
