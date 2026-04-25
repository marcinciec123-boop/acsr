import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { User, Search, Globe, Trophy, Activity, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TeamData } from "@/lib/types";
import { loadFromStorage } from "@/lib/storage";
import { teamDatabase } from "@/data/tournaments";
import { countryFlag } from "@/lib/flags";
import { playerNationalities } from "@/data/playerNationalities";
import { playerRealNames } from "@/data/playerRealNames";
import { playerRoles, roleColors, roleIcons } from "@/data/playerRoles";
import { computeCareerStats } from "@/lib/playerCareerStats";
import { getRatingColor } from "@/lib/playerStats";

type RegionFilter = "all" | "EU" | "US" | "LATAM" | "ASIA" | "OCE" | "AFR";
type SortMode = "rating" | "matches" | "team" | "name";

interface PlayersPanelProps {
  onSelectPlayer: (name: string) => void;
  onSelectTeam?: (name: string) => void;
}

interface PlayerRow {
  name: string;
  team: TeamData;
  country: string;
  realName?: { firstName: string; lastName: string };
  role?: string;
  rating: number;
  matches: number;
  kdr: number;
  adr: number;
}

const PlayersPanel = ({ onSelectPlayer, onSelectTeam }: PlayersPanelProps) => {
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState<RegionFilter>("all");
  const [nationality, setNationality] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortMode>("rating");
  const [onlyWithStats, setOnlyWithStats] = useState(false);

  const teams = useMemo(() => {
    const stored = loadFromStorage<TeamData[] | null>("ranking_data", null);
    return stored && stored.length > 0 ? stored : teamDatabase.map(t => ({ ...t }));
  }, []);

  const rows = useMemo<PlayerRow[]>(() => {
    const out: PlayerRow[] = [];
    for (const t of teams) {
      for (const p of t.roster) {
        const career = computeCareerStats(p);
        out.push({
          name: p,
          team: t,
          country: playerNationalities[p] || t.country,
          realName: playerRealNames[p],
          role: playerRoles[p],
          rating: career.careerRating,
          matches: career.matchesPlayed,
          kdr: career.kdRatio,
          adr: career.avgAdr,
        });
      }
    }
    return out;
  }, [teams]);

  const allNationalities = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => set.add(r.country));
    return Array.from(set).sort();
  }, [rows]);

  const allRoles = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.role) set.add(r.role); });
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter(r => {
      if (q) {
        const real = r.realName ? `${r.realName.firstName} ${r.realName.lastName}`.toLowerCase() : "";
        if (!r.name.toLowerCase().includes(q) && !real.includes(q) && !r.team.name.toLowerCase().includes(q)) return false;
      }
      if (region !== "all" && r.team.region !== region) return false;
      if (nationality !== "all" && r.country !== nationality) return false;
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (onlyWithStats && r.matches === 0) return false;
      return true;
    });
    list.sort((a, b) => {
      switch (sort) {
        case "rating": {
          // Players with stats first, then by rating
          if (a.matches === 0 && b.matches > 0) return 1;
          if (b.matches === 0 && a.matches > 0) return -1;
          return b.rating - a.rating;
        }
        case "matches": return b.matches - a.matches;
        case "team": return a.team.name.localeCompare(b.team.name);
        case "name": return a.name.localeCompare(b.name);
      }
    });
    return list;
  }, [rows, search, region, nationality, roleFilter, sort, onlyWithStats]);

  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-heading font-bold text-foreground">Gracze</h2>
            <span className="text-xs font-mono text-muted-foreground">
              ({filtered.length}/{rows.length})
            </span>
          </div>
        </div>

        {/* Search + filters */}
        <div className="space-y-3 mb-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Szukaj nicku, imienia lub drużyny..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Globe className="w-4 h-4 text-muted-foreground" />
              {(["all", "EU", "US", "LATAM", "ASIA", "OCE", "AFR"] as RegionFilter[]).map(r => (
                <button
                  key={r}
                  onClick={() => setRegion(r)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-mono rounded border transition-colors",
                    region === r
                      ? "bg-primary/20 text-primary border-primary/40"
                      : "text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {r === "all" ? "Wszystkie" : r}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={nationality}
                onChange={e => setNationality(e.target.value)}
                className="px-2 py-1 text-xs font-mono rounded border border-border bg-secondary/50 text-foreground"
              >
                <option value="all">Wszystkie narodowości</option>
                {allNationalities.map(n => (
                  <option key={n} value={n}>{countryFlag(n)} {n}</option>
                ))}
              </select>
            </div>

            {allRoles.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={roleFilter}
                  onChange={e => setRoleFilter(e.target.value)}
                  className="px-2 py-1 text-xs font-mono rounded border border-border bg-secondary/50 text-foreground"
                >
                  <option value="all">Wszystkie role</option>
                  {allRoles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                value={sort}
                onChange={e => setSort(e.target.value as SortMode)}
                className="px-2 py-1 text-xs font-mono rounded border border-border bg-secondary/50 text-foreground"
              >
                <option value="rating">Sortuj: Rating</option>
                <option value="matches">Sortuj: Mecze</option>
                <option value="team">Sortuj: Drużyna</option>
                <option value="name">Sortuj: Nick A-Z</option>
              </select>
            </div>

            <label className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyWithStats}
                onChange={e => setOnlyWithStats(e.target.checked)}
                className="accent-primary"
              />
              Tylko ze statystykami
            </label>
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-lg p-10 text-center">
            <User className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm font-mono text-muted-foreground">Brak graczy spełniających filtry.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {filtered.map((p, i) => (
              <motion.button
                key={`${p.team.name}-${p.name}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.005, 0.4) }}
                onClick={() => onSelectPlayer(p.name)}
                className="group bg-card border border-border rounded-lg p-3 text-left hover:border-primary/50 hover:bg-secondary/40 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-base shrink-0">{countryFlag(p.country)}</span>
                    <span className="font-heading font-bold text-foreground truncate group-hover:text-primary transition-colors">
                      {p.name}
                    </span>
                  </div>
                  {p.role && (
                    <span className={cn(
                      "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0",
                      roleColors[p.role] || "border-border text-muted-foreground",
                    )}>
                      {roleIcons[p.role]}
                    </span>
                  )}
                </div>
                {p.realName && (
                  <p className="text-[10px] text-muted-foreground font-mono truncate mb-1">
                    {p.realName.firstName} {p.realName.lastName}
                  </p>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onSelectTeam?.(p.team.name); }}
                  className="text-[11px] font-mono text-muted-foreground hover:text-primary transition-colors truncate block w-full text-left mb-2"
                  title={p.team.name}
                >
                  {countryFlag(p.team.country)} {p.team.name}
                </button>
                <div className="flex items-center justify-between gap-1 pt-2 border-t border-border/40">
                  {p.matches > 0 ? (
                    <>
                      <div className="text-center">
                        <p className="text-[9px] font-mono uppercase text-muted-foreground/60">Rating</p>
                        <p className={cn("text-sm font-bold tabular-nums leading-tight", getRatingColor(p.rating))}>
                          {p.rating.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-mono uppercase text-muted-foreground/60">K/D</p>
                        <p className="text-sm font-bold tabular-nums text-foreground leading-tight">
                          {p.kdr.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-mono uppercase text-muted-foreground/60">M</p>
                        <p className="text-sm font-bold tabular-nums text-foreground leading-tight">
                          {p.matches}
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-[10px] font-mono text-muted-foreground/50 italic mx-auto">
                      Brak meczów
                    </p>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default PlayersPanel;
