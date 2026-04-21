import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Users, Plus, Edit3, Check, X, Search, ChevronUp, ChevronDown, Globe, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { TeamData, RankingAdjustment } from "@/lib/types";
import { saveToStorage, loadFromStorage } from "@/lib/storage";
import { teamDatabase } from "@/data/tournaments";
import { countryFlag } from "@/lib/flags";
import { playerNationalities } from "@/data/playerNationalities";

type RegionFilter = "all" | "EU" | "US" | "LATAM" | "ASIA" | "OCE" | "AFR";

const RANKING_KEY = "ranking_data";
const ADJUSTMENTS_KEY = "ranking_adjustments";

interface RankingPanelProps {
  onSelectTeam?: (name: string) => void;
  onSelectPlayer?: (name: string) => void;
}

const RankingPanel = ({ onSelectTeam, onSelectPlayer }: RankingPanelProps) => {
  const [teams, setTeams] = useState<TeamData[]>(() => {
    const saved = loadFromStorage<TeamData[] | null>(RANKING_KEY, null);
    if (saved) return saved;
    return teamDatabase.map(t => ({ ...t }));
  });
  const [adjustments, setAdjustments] = useState<RankingAdjustment[]>(() =>
    loadFromStorage<RankingAdjustment[]>(ADJUSTMENTS_KEY, [])
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

  useEffect(() => { saveToStorage(RANKING_KEY, teams); }, [teams]);
  useEffect(() => { saveToStorage(ADJUSTMENTS_KEY, adjustments); }, [adjustments]);

  const sorted = useMemo(() => [...teams].sort((a, b) => b.points - a.points), [teams]);

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
    setAdjTeam("");
    setAdjPoints("");
    setAdjReason("");
    setShowAdjust(false);
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

  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-heading font-bold text-foreground">Ranking ACSR</h2>
          </div>
          <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" /> Dodaj punkty
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
                  <Input
                    type="number"
                    placeholder="+100 lub -50"
                    value={adjPoints}
                    onChange={e => setAdjPoints(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-mono text-muted-foreground mb-1 block">Powód (opcjonalnie)</label>
                  <Input
                    placeholder="np. Wygrana turnieju, kara..."
                    value={adjReason}
                    onChange={e => setAdjReason(e.target.value)}
                  />
                </div>
                <Button onClick={handleAdjust} className="w-full">
                  Zastosuj zmianę
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search + Filters */}
        <div className="space-y-3 mb-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Szukaj drużyny..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>

          <div className="flex items-start gap-6 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Globe className="w-4 h-4 text-muted-foreground" />
              {(["all", "EU", "US", "LATAM", "ASIA", "OCE", "AFR"] as RegionFilter[]).map(r => (
                <button
                  key={r}
                  onClick={() => setRegionFilter(r)}
                  className={cn(
                    "px-3 py-1 text-xs font-mono rounded border transition-colors",
                    regionFilter === r
                      ? "bg-primary/20 text-primary border-primary/40"
                      : "text-muted-foreground border-border hover:text-foreground"
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
                className="px-2 py-1 text-xs font-mono rounded border border-border bg-secondary/50 text-foreground focus:outline-none focus:border-primary/50"
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
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 gap-1 px-4 py-2 bg-secondary/50 text-xs font-mono text-muted-foreground uppercase">
            <div className="col-span-1">#</div>
            <div className="col-span-5">Drużyna</div>
            <div className="col-span-2">Region</div>
            <div className="col-span-2 text-right">Punkty</div>
            <div className="col-span-2 text-right">Akcje</div>
          </div>
          {filtered.map((team, i) => {
            const globalRank = sorted.findIndex(t => t.name === team.name) + 1;
            const isEditing = editingTeam === team.name;
            return (
              <motion.div
                key={team.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.01, 0.5) }}
                className={cn(
                  "grid grid-cols-12 gap-1 px-4 py-2.5 border-t border-border/50 items-center text-sm hover:bg-secondary/30 transition-colors",
                  globalRank <= 3 && "bg-primary/5"
                )}
              >
                <div className="col-span-1 font-mono text-muted-foreground text-xs">
                  {globalRank <= 3 ? (
                    <span className={cn(
                      "font-bold",
                      globalRank === 1 && "text-[hsl(var(--gold))]",
                      globalRank === 2 && "text-[hsl(var(--silver))]",
                      globalRank === 3 && "text-[hsl(var(--bronze))]",
                    )}>
                      {globalRank}
                    </span>
                  ) : globalRank}
                </div>
                <div className="col-span-5">
                  <button
                    onClick={() => onSelectTeam?.(team.name)}
                    className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                  >
                    <span className="text-xs">{countryFlag(team.country)}</span>
                    {team.name}
                  </button>
                </div>
                <div className="col-span-2 text-xs text-muted-foreground font-mono">{team.region}</div>
                <div className="col-span-2 text-right">
                  {isEditing ? (
                    <Input
                      type="number"
                      value={editPoints}
                      onChange={e => setEditPoints(e.target.value)}
                      className="h-7 w-20 text-xs ml-auto"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === "Enter") handleInlineEdit(team.name);
                        if (e.key === "Escape") setEditingTeam(null);
                      }}
                    />
                  ) : (
                    <span className="font-mono font-semibold text-foreground">{team.points}</span>
                  )}
                </div>
                <div className="col-span-2 flex justify-end gap-1">
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

        {/* History */}
        {adjustments.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-heading font-semibold text-muted-foreground mb-3">
              Ostatnie zmiany ({adjustments.length})
            </h3>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {adjustments.slice(0, 20).map(adj => (
                <div key={adj.id} className="flex items-center justify-between px-3 py-1.5 bg-card border border-border/50 rounded text-xs">
                  <div className="flex items-center gap-2">
                    {adj.points > 0 ? (
                      <ChevronUp className="w-3 h-3 text-[hsl(var(--win))]" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-[hsl(var(--loss))]" />
                    )}
                    <span className="font-medium text-foreground">{adj.team}</span>
                    <span className={cn("font-mono", adj.points > 0 ? "text-[hsl(var(--win))]" : "text-[hsl(var(--loss))]")}>
                      {adj.points > 0 ? "+" : ""}{adj.points}
                    </span>
                    <span className="text-muted-foreground">{adj.reason}</span>
                  </div>
                  <span className="text-muted-foreground font-mono">
                    {new Date(adj.date).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default RankingPanel;
