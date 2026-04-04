import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Users, ChevronDown, ChevronUp, Globe, Search, X, User, TrendingUp } from "lucide-react";
import { teamDatabase, type TeamData } from "@/data/tournaments";
import { playerNationalities } from "@/data/playerNationalities";
import { countryFlag } from "@/lib/flags";
import { cn } from "@/lib/utils";

const getRankBadge = (rank: number) => {
  if (rank === 1) return "bg-accent/20 text-accent border-accent/40";
  if (rank === 2) return "bg-silver/20 text-silver border-silver/40";
  if (rank === 3) return "bg-bronze/20 text-bronze border-bronze/40";
  return "bg-muted text-muted-foreground border-border";
};

const tierLabel = (rank: number) => {
  if (rank <= 10) return { label: "Tier 1", color: "text-accent" };
  if (rank <= 30) return { label: "Tier 2", color: "text-primary" };
  if (rank <= 60) return { label: "Tier 3", color: "text-silver" };
  return { label: "Tier 4", color: "text-muted-foreground" };
};

type RegionFilter = "all" | "EU" | "US" | "LATAM" | "ASIA" | "OCE" | "AFR";

const allPlayerCountries = [...new Set(Object.values(playerNationalities))].sort();

interface PlayerRankingsProps {
  onSelectTeam?: (teamName: string) => void;
  onSelectPlayer?: (playerName: string) => void;
  dynamicRanking?: TeamData[];
}

const PlayerRankings = ({ onSelectTeam, onSelectPlayer, dynamicRanking }: PlayerRankingsProps) => {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");
  const [nationalityFilter, setNationalityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showPlayerSearch, setShowPlayerSearch] = useState(false);

  // Use dynamic ranking if available, otherwise base teamDatabase
  const rankingSource = dynamicRanking && dynamicRanking.length > 0 ? dynamicRanking : teamDatabase;

  // Player search results
  const playerResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results: { player: string; country: string; team: string; teamRank: number }[] = [];
    rankingSource.forEach((team, idx) => {
      team.roster.forEach(player => {
        if (player.toLowerCase().includes(q)) {
          results.push({
            player,
            country: playerNationalities[player] || team.country,
            team: team.name,
            teamRank: idx + 1,
          });
        }
      });
    });
    return results.slice(0, 20);
  }, [searchQuery, rankingSource]);

  // Filter teams
  const filtered = useMemo(() => {
    let teams = rankingSource;
    if (regionFilter !== "all") {
      teams = teams.filter(t => t.region === regionFilter);
    }
    if (nationalityFilter !== "all") {
      teams = teams.filter(t =>
        t.roster.some(p => (playerNationalities[p] || t.country) === nationalityFilter)
      );
    }
    return teams;
  }, [regionFilter, nationalityFilter, rankingSource]);

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Users className="w-6 h-6 text-primary" />
          <h2 className="text-3xl font-heading font-bold text-foreground">ACSR World Ranking</h2>
          <span className="text-sm font-mono text-muted-foreground ml-2">{rankingSource.length} drużyn</span>
          <button
            onClick={() => setShowPlayerSearch(!showPlayerSearch)}
            className={cn(
              "ml-auto flex items-center gap-2 px-3 py-1.5 text-xs font-mono rounded border transition-colors",
              showPlayerSearch ? "bg-primary/20 text-primary border-primary/40" : "text-muted-foreground border-border hover:text-foreground"
            )}
          >
            <Search className="w-3.5 h-3.5" />
            Szukaj gracza
          </button>
        </div>

        {/* Player search */}
        {showPlayerSearch && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-6"
          >
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Wpisz nick gracza..."
                  className="w-full pl-10 pr-10 py-2 bg-secondary/50 border border-border rounded-md text-foreground font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>

              {playerResults.length > 0 && (
                <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
                  {playerResults.map((r) => (
                    <button
                      key={`${r.team}-${r.player}`}
                     onClick={() => onSelectPlayer?.(r.player)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-muted/30 transition-colors text-left"
                    >
                      <User className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-lg shrink-0">{countryFlag(r.country)}</span>
                      <div className="min-w-0 flex-1">
                        <span className="font-heading font-bold text-foreground text-sm">{r.player}</span>
                        <span className="text-xs text-muted-foreground ml-2">({r.country})</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs text-muted-foreground font-mono">#{r.teamRank}</span>
                        <span className="text-xs text-foreground font-heading ml-2">{r.team}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.trim() && playerResults.length === 0 && (
                <p className="mt-3 text-sm text-muted-foreground text-center py-2">Nie znaleziono gracza „{searchQuery}"</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Filters row */}
        <div className="flex items-start gap-6 flex-wrap mb-6">
          {/* Region filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <Globe className="w-4 h-4 text-muted-foreground" />
            {(["all", "EU", "US", "LATAM", "ASIA", "OCE", "AFR"] as RegionFilter[]).map(r => (
              <button
                key={r}
                onClick={() => setRegionFilter(r)}
                className={cn(
                  "px-3 py-1 text-xs font-mono rounded border transition-colors",
                  regionFilter === r ? "bg-primary/20 text-primary border-primary/40" : "text-muted-foreground border-border hover:text-foreground"
                )}
              >
                {r === "all" ? "Wszystkie" : r}
              </button>
            ))}
          </div>

          {/* Nationality filter */}
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <select
              value={nationalityFilter}
              onChange={(e) => setNationalityFilter(e.target.value)}
              className="px-2 py-1 text-xs font-mono rounded border border-border bg-secondary/50 text-foreground focus:outline-none focus:border-primary/50"
            >
              <option value="all">Wszystkie narodowości</option>
              {allPlayerCountries.map(c => (
                <option key={c} value={c}>{countryFlag(c)} {c}</option>
              ))}
            </select>
            {nationalityFilter !== "all" && (
              <span className="text-xs text-muted-foreground font-mono">
                {filtered.length} drużyn z graczami z {countryFlag(nationalityFilter)} {nationalityFilter}
              </span>
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[60px_1fr_100px_80px_80px_120px] gap-2 px-4 py-3 bg-secondary/50 border-b border-border text-xs font-mono text-muted-foreground uppercase tracking-wider">
            <span className="text-center">#</span>
            <span>Drużyna</span>
            <span className="text-right">Punkty</span>
            <span className="text-center">Kraj</span>
            <span className="text-center">Region</span>
            <span className="text-center">Tier</span>
          </div>

          {filtered.map((team, index) => {
            const globalRank = teamDatabase.indexOf(team) + 1;
            const tier = tierLabel(globalRank);
            const isExpanded = expandedTeam === team.name;

            return (
              <motion.div
                key={team.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.01 }}
              >
                <button
                  onClick={() => setExpandedTeam(isExpanded ? null : team.name)}
                  className={cn(
                    "w-full grid grid-cols-[60px_1fr_100px_80px_80px_120px] gap-2 px-4 py-3 items-center border-b border-border/50 hover:bg-muted/30 transition-colors text-left",
                    globalRank <= 3 && "bg-primary/5",
                    isExpanded && "bg-muted/20"
                  )}
                >
                  <span className="text-center">
                    <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded text-sm font-bold border", getRankBadge(globalRank))}>
                      {globalRank}
                    </span>
                  </span>

                  <div className="flex items-center gap-2">
                    <span className="text-lg">{countryFlag(team.country)}</span>
                    <span
                      className="font-heading font-bold text-foreground hover:text-primary cursor-pointer transition-colors"
                      onClick={(e) => { e.stopPropagation(); onSelectTeam?.(team.name); }}
                    >
                      {team.name}
                    </span>
                    {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                  </div>

                  <span className="font-mono font-bold text-primary text-right">{team.points.toLocaleString()}</span>
                  <span className="text-center text-sm text-muted-foreground font-mono">{countryFlag(team.country)} {team.country}</span>
                  <span className="text-center text-sm text-muted-foreground font-mono">{team.region}</span>
                  <span className={cn("text-center text-sm font-heading font-bold", tier.color)}>{tier.label}</span>
                </button>

                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="bg-muted/10 border-b border-border px-4 py-3"
                  >
                    <p className="text-xs font-mono text-muted-foreground uppercase mb-2">Roster</p>
                    <div className="flex flex-wrap gap-2">
                      {team.roster.map(player => {
                        const playerCountry = playerNationalities[player] || team.country;
                        const isHighlighted = nationalityFilter !== "all" && playerCountry === nationalityFilter;
                        return (
                          <span
                            key={player}
                            className={cn(
                              "px-3 py-1.5 bg-card border rounded text-sm font-heading font-bold text-foreground",
                              isHighlighted ? "border-primary/60 bg-primary/10" : "border-border"
                            )}
                          >
                            {countryFlag(playerCountry)} {player}
                          </span>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PlayerRankings;
