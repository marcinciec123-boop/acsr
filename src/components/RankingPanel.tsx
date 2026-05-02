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

type RegionFilter = "all" | "EU" | "US" | "LATAM" | "ASIA" | "OCE" | "AFR";

const RANKING_KEY = "ranking_data";
const ADJUSTMENTS_KEY = "ranking_adjustments";
const SNAPSHOT_KEY = "ranking_snapshot_prev"; // poprzednia migawka do trendów

interface RankingPanelProps {
  onSelectTeam?: (name: string) => void;
  onSelectPlayer?: (name: string) => void;
}

const tierFor = (rank: number) => {
  if (rank <= 5) return { label: "S", color: "text-accent", bg: "bg-accent/15 border-accent/40" };
  if (rank <= 15) return { label: "A", color: "text-primary", bg: "bg-primary/15 border-primary/40" };
  if (rank <= 35) return { label: "B", color: "text-[hsl(var(--silver))]", bg: "bg-[hsl(var(--silver)/0.15)] border-[hsl(var(--silver)/0.4)]" };
  return { label: "C", color: "text-muted-foreground", bg: "bg-muted/40 border-border" };
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

  useEffect(() => { saveToStorage(RANKING_KEY, teams); }, [teams]);
  useEffect(() => { saveToStorage(ADJUSTMENTS_KEY, adjustments); }, [adjustments]);

  const sorted = useMemo(() => [...teams].sort((a, b) => b.points - a.points), [teams]);

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

  const maxPoints = sorted[0]?.points || 1;

  const handleAdjust = () => {
    const pts = parseInt(adjPoints);
    if (!adjTeam || isNaN(pts)) return;
    const adj: RankingAdjustment = {
      id: Date.now().toString(36),
      team: adjTeam,
      points: pts,
      reason: adjReason.trim() || (pts > 0 ? "Dodanie punktów" : "Odjęcie punktów"),
      date: new Date().toISOString(),
    };
    setTeams(prev => prev.map(t =>
      t.name === adjTeam ? { ...t, points: Math.max(0, t.points + pts) } : t
    ));
    setAdjustments(prev => [adj, ...prev]);
    setAdjTeam(""); setAdjPoints(""); setAdjReason(""); setShowAdjust(false);
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
      date: new Date().toISOString(),
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
    <section className="py-6">
      <div className="container mx-auto px-4">
        {/* === ACTION BAR === */}
        <div className="flex items-center justify-end gap-2 mb-4">
          <Button size="sm" variant="outline" onClick={captureSnapshot} className="gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            Zapisz migawkę
          </Button>
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
        </div>

        {/* === PODIUM TOP 3 === */}
        {top3.length === 3 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            {[1, 0, 2].map((idx, displayIdx) => {
              const team = top3[idx];
              if (!team) return null;
              const rank = idx + 1;
              const meta =
                rank === 1 ? { icon: Crown, color: "text-[hsl(var(--gold))]", border: "border-[hsl(var(--gold)/0.5)]", glow: "shadow-[0_0_30px_hsl(var(--gold)/0.15)]", label: "Mistrz" }
                : rank === 2 ? { icon: Medal, color: "text-[hsl(var(--silver))]", border: "border-[hsl(var(--silver)/0.5)]", glow: "shadow-[0_0_20px_hsl(var(--silver)/0.1)]", label: "Wicemistrz" }
                : { icon: Award, color: "text-[hsl(var(--bronze))]", border: "border-[hsl(var(--bronze)/0.5)]", glow: "shadow-[0_0_20px_hsl(var(--bronze)/0.1)]", label: "3. miejsce" };
              const Icon = meta.icon;
              const trend = trendFor(team.name, rank);
              return (
                <motion.button
                  key={team.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: displayIdx * 0.08 }}
                  onClick={() => onSelectTeam?.(team.name)}
                  className={cn(
                    "group relative bg-card border rounded-xl p-4 text-left hover:border-primary/60 transition-all hover:-translate-y-0.5",
                    meta.border, meta.glow,
                    rank === 1 && "md:scale-105 md:order-2 md:py-6",
                    rank === 2 && "md:order-1",
                    rank === 3 && "md:order-3",
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("w-5 h-5", meta.color)} />
                      <span className={cn("text-xs font-mono uppercase tracking-wider", meta.color)}>#{rank} • {meta.label}</span>
                    </div>
                    <TrendBadge trend={trend} />
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <TeamLogo teamName={team.name} size={rank === 1 ? 56 : 48} />
                    <div className="min-w-0">
                      <div className="font-heading font-black text-foreground truncate group-hover:text-primary transition-colors">
                        {team.name}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                        <span>{countryFlag(team.country)}</span>
                        <span>{team.country}</span>
                        <span className="text-border">•</span>
                        <span>{team.region}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <div className={cn("text-2xl font-mono font-black", meta.color)}>
                        {team.points.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">punktów</div>
                    </div>
                    <div className="text-right text-[10px] font-mono text-muted-foreground">
                      <div>{team.roster.length} graczy</div>
                      <div>{Math.round((team.points / maxPoints) * 100)}% lidera</div>
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
                  <div className="px-3 py-1.5 text-[10px] font-mono uppercase text-muted-foreground tracking-wider border-b border-border/50 bg-secondary/40">
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
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[60px_60px_1fr_90px_90px_1fr_90px_60px] gap-2 px-4 py-2.5 bg-gradient-to-r from-secondary/60 to-secondary/30 border-b border-border text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            <div className="text-center">#</div>
            <div className="text-center">Trend</div>
            <div>Drużyna</div>
            <div className="text-center">Tier</div>
            <div className="text-center">Region</div>
            <div>Punkty</div>
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
            const pct = (team.points / maxPoints) * 100;

            return (
              <motion.div
                key={team.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.008, 0.4) }}
                className={cn(
                  "grid grid-cols-[60px_60px_1fr_90px_90px_1fr_90px_60px] gap-2 px-4 py-2.5 border-t border-border/40 items-center text-sm hover:bg-secondary/30 transition-colors group",
                  globalRank <= 3 && "bg-primary/[0.03]"
                )}
              >
                <div className="text-center font-mono">
                  {globalRank <= 3 ? (
                    <span className={cn(
                      "inline-flex items-center justify-center w-7 h-7 rounded-md font-black text-xs border",
                      globalRank === 1 && "text-[hsl(var(--gold))] border-[hsl(var(--gold)/0.4)] bg-[hsl(var(--gold)/0.1)]",
                      globalRank === 2 && "text-[hsl(var(--silver))] border-[hsl(var(--silver)/0.4)] bg-[hsl(var(--silver)/0.1)]",
                      globalRank === 3 && "text-[hsl(var(--bronze))] border-[hsl(var(--bronze)/0.4)] bg-[hsl(var(--bronze)/0.1)]",
                    )}>
                      {globalRank}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">{globalRank}</span>
                  )}
                </div>

                <div className="flex justify-center">
                  <TrendBadge trend={trend} compact />
                </div>

                <div className="min-w-0">
                  <button
                    onClick={() => onSelectTeam?.(team.name)}
                    className="flex items-center gap-2.5 group/team text-left min-w-0 w-full"
                  >
                    <TeamLogo teamName={team.name} size={32} rounded="md" />
                    <div className="min-w-0">
                      <div className="font-heading font-bold text-foreground group-hover/team:text-primary transition-colors truncate">
                        {team.name}
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                        <span>{countryFlag(team.country)}</span>
                        <span className="truncate">{team.country}</span>
                      </div>
                    </div>
                  </button>
                </div>

                <div className="flex justify-center">
                  <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-black border", tier.bg, tier.color)}>
                    {tier.label}
                  </span>
                </div>

                <div className="text-center text-xs text-muted-foreground font-mono">{team.region}</div>

                <div className="space-y-1">
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
                  ) : (
                    <>
                      <div className="font-mono font-bold text-foreground text-sm">{team.points.toLocaleString()}</div>
                      <div className="h-1 w-full max-w-[140px] bg-secondary rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            globalRank <= 3 ? "bg-gradient-to-r from-primary to-accent" :
                            globalRank <= 15 ? "bg-primary/70" :
                            "bg-muted-foreground/40"
                          )}
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="text-right text-xs font-mono text-muted-foreground">
                  {team.roster.length}
                </div>

                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
              </motion.div>
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
                  className="text-[10px] font-mono uppercase text-muted-foreground hover:text-primary transition-colors"
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
                    <span className="text-muted-foreground font-mono shrink-0 text-[10px]">
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
    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
      {icon} {label}
    </div>
    <div className="font-heading font-black text-foreground text-lg leading-tight truncate">{value}</div>
    {hint && <div className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">{hint}</div>}
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
        compact ? "px-1 py-0 text-[9px]" : "px-1.5 py-0.5 text-[10px]",
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
      compact ? "px-1 py-0 text-[9px]" : "px-1.5 py-0.5 text-[10px]",
      isUp ? "text-[hsl(var(--win))]" : "text-[hsl(var(--loss))]"
    )}>
      <Icon className={cn(compact ? "w-2.5 h-2.5" : "w-3 h-3")} />
      {trend.diff}
    </span>
  );
};

export default RankingPanel;
