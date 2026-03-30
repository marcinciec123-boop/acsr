import { useState } from "react";
import { motion } from "framer-motion";
import { Users, ChevronDown, ChevronUp, Globe } from "lucide-react";
import { teamDatabase } from "@/data/tournaments";
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

const PlayerRankings = () => {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<RegionFilter>("all");

  const filtered = regionFilter === "all"
    ? teamDatabase
    : teamDatabase.filter(t => t.region === regionFilter);

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-6 h-6 text-primary" />
          <h2 className="text-3xl font-heading font-bold text-foreground">ACSR World Ranking</h2>
          <span className="text-sm font-mono text-muted-foreground ml-2">{teamDatabase.length} drużyn</span>
        </div>

        {/* Region filter */}
        <div className="flex items-center gap-2 flex-wrap mb-6">
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
                    <span className="font-heading font-bold text-foreground">{team.name}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                  </div>

                  <span className="font-mono font-bold text-primary text-right">{team.points.toLocaleString()}</span>
                  <span className="text-center text-sm text-muted-foreground font-mono">{team.country}</span>
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
                      {team.roster.map(player => (
                        <span
                          key={player}
                          className="px-3 py-1.5 bg-card border border-border rounded text-sm font-heading font-bold text-foreground"
                        >
                          {player}
                        </span>
                      ))}
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
