import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Medal, Award, TrendingUp, ChevronDown, ChevronUp, Users, DollarSign, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { Tournament, TournamentSimulation } from "@/data/tournaments";
import type { TeamData } from "@/lib/types";
import { teamDatabase } from "@/data/tournaments";
import { resolveLineup } from "@/lib/tournamentLineups";
import { distributePrizePool, parsePrizePool, formatMoney } from "@/lib/prizeDistribution";
import { loadFromStorage } from "@/lib/storage";
import { countryFlag } from "@/lib/flags";
import TeamLogo from "@/components/TeamLogo";
import { cn } from "@/lib/utils";

interface Props {
  tournament: Tournament;
  simulation: TournamentSimulation;
  /** Optional ranking snapshot BEFORE the tournament (name → rank). If omitted we still show the current rank. */
  prevRankSnapshot?: Record<string, number>;
}

const FullResultsPanel = ({ tournament, simulation, prevRankSnapshot }: Props) => {
  const placements = useMemo(
    () => simulation.placements.slice().sort((a, b) => a.placement - b.placement),
    [simulation.placements],
  );

  const totalPool = parsePrizePool(tournament.prizePool);
  const prizeMap = useMemo(
    () => distributePrizePool(totalPool, tournament.teams || placements.length),
    [totalPool, tournament.teams, placements.length],
  );

  // Current ranking (post-tournament, since ranking is applied when tournament ends)
  const currentTeams = loadFromStorage<TeamData[] | null>("ranking_data", null) || teamDatabase;
  const currentRankMap = useMemo(() => {
    const sorted = [...currentTeams].filter(t => !(t as unknown as { isNational?: boolean }).isNational).sort((a, b) => b.points - a.points);
    const map: Record<string, number> = {};
    sorted.forEach((t, i) => { map[t.name] = i + 1; });
    return map;
  }, [currentTeams]);

  const [expanded, setExpanded] = useState<string | null>(null);

  const placementMedal = (place: number) => {
    if (place === 1) return { Icon: Crown, cls: "text-[hsl(var(--gold))]" };
    if (place === 2) return { Icon: Medal, cls: "text-[hsl(var(--silver))]" };
    if (place === 3) return { Icon: Award, cls: "text-[hsl(var(--bronze))]" };
    return { Icon: null as any, cls: "text-muted-foreground" };
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-r from-primary/10 via-secondary/40 to-transparent border-b border-border flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h3 className="font-heading font-black text-sm text-foreground uppercase tracking-wider">
          Pełne wyniki turnieju
        </h3>
        <span className="ml-auto text-xs font-mono text-muted-foreground">
          Pula: {tournament.prizePool}
        </span>
      </div>

      {/* Column headers — desktop */}
      <div className="hidden md:grid grid-cols-[60px_1fr_90px_100px_120px_40px] gap-2 px-4 py-2 bg-secondary/40 text-xs font-mono text-muted-foreground uppercase tracking-widest">
        <div className="text-center">Miejsce</div>
        <div>Drużyna</div>
        <div className="text-right">Pkt VRS</div>
        <div className="text-right">Nagroda</div>
        <div className="text-center">Rank</div>
        <div />
      </div>

      <div className="divide-y divide-border/40">
        {placements.map((p, i) => {
          const medal = placementMedal(p.placement);
          const prize = prizeMap[p.placement] || 0;
          const rankNow = currentRankMap[p.team];
          const rankBefore = prevRankSnapshot?.[p.team];
          const rankDiff = rankBefore && rankNow ? rankBefore - rankNow : 0;
          const teamData = teamDatabase.find(t => t.name === p.team);
          const lineup = resolveLineup(tournament.id, p.team);
          const isOpen = expanded === p.team;

          return (
            <motion.div
              key={p.team}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className={cn(
                "text-sm",
                p.placement === 1 && "bg-[hsl(var(--gold)/0.05)]",
                p.placement === 2 && "bg-[hsl(var(--silver)/0.04)]",
                p.placement === 3 && "bg-[hsl(var(--bronze)/0.04)]",
              )}
            >
              <button
                onClick={() => setExpanded(isOpen ? null : p.team)}
                className="w-full grid grid-cols-[40px_1fr_auto] md:grid-cols-[60px_1fr_90px_100px_120px_40px] gap-2 px-3 md:px-4 py-2.5 items-center hover:bg-secondary/30 transition-colors text-left"
              >
                {/* Placement */}
                <div className="flex items-center justify-center gap-1">
                  {medal.Icon && <medal.Icon className={cn("w-4 h-4", medal.cls)} />}
                  <span className={cn("font-mono font-black text-xs md:text-sm", medal.cls)}>
                    #{p.placement}
                  </span>
                </div>

                {/* Team */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <TeamLogo teamName={p.team} size={28} rounded="md" />
                  <div className="min-w-0">
                    <div className="font-heading font-bold text-foreground truncate">{p.team}</div>
                    <div className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                      {teamData && <span>{countryFlag(teamData.country)}</span>}
                      {teamData && <span>{teamData.country}</span>}
                      <span className="md:hidden text-border">•</span>
                      <span className={cn("md:hidden font-mono", p.points >= 0 ? "text-[hsl(var(--win))]" : "text-[hsl(var(--loss))]")}>
                        {p.points > 0 ? "+" : ""}{p.points} pkt
                      </span>
                      {prize > 0 && (
                        <>
                          <span className="md:hidden text-border">•</span>
                          <span className="md:hidden">{formatMoney(prize)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Points — desktop */}
                <div className={cn(
                  "hidden md:block text-right font-mono font-bold",
                  p.points > 0 ? "text-[hsl(var(--win))]" : p.points < 0 ? "text-[hsl(var(--loss))]" : "text-muted-foreground",
                )}>
                  {p.points > 0 ? "+" : ""}{p.points}
                </div>

                {/* Prize — desktop */}
                <div className="hidden md:flex items-center justify-end gap-1 text-xs font-mono text-foreground">
                  {prize > 0 && <DollarSign className="w-3 h-3 text-accent" />}
                  {formatMoney(prize)}
                </div>

                {/* Post-tournament rank — desktop */}
                <div className="hidden md:flex items-center justify-center gap-1.5 text-xs font-mono">
                  <span className="font-bold text-foreground">#{rankNow ?? "—"}</span>
                  {rankDiff > 0 && (
                    <span className="flex items-center gap-0.5 text-[hsl(var(--win))]">
                      <ArrowUpRight className="w-3 h-3" />{rankDiff}
                    </span>
                  )}
                  {rankDiff < 0 && (
                    <span className="flex items-center gap-0.5 text-[hsl(var(--loss))]">
                      <ArrowDownRight className="w-3 h-3" />{Math.abs(rankDiff)}
                    </span>
                  )}
                  {rankDiff === 0 && rankBefore && (
                    <Minus className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>

                {/* Chevron */}
                <div className="flex items-center justify-end">
                  {isOpen
                    ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-3 pt-1 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                  <div>
                    <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Users className="w-3 h-3" /> Skład grający w turnieju
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {lineup.length === 0
                        ? <span className="text-xs text-muted-foreground font-mono">Brak danych o składzie</span>
                        : lineup.map(pl => (
                            <span key={pl} className="text-xs font-mono px-2 py-0.5 rounded-md bg-secondary/60 border border-border text-foreground">
                              {pl}
                            </span>
                          ))
                      }
                    </div>
                  </div>
                  <div className="md:hidden text-xs font-mono">
                    <span className="text-muted-foreground">Rank po turnieju: </span>
                    <span className="font-bold text-foreground">#{rankNow ?? "—"}</span>
                    {rankDiff !== 0 && rankBefore && (
                      <span className={cn(
                        "ml-1.5",
                        rankDiff > 0 ? "text-[hsl(var(--win))]" : "text-[hsl(var(--loss))]"
                      )}>
                        ({rankDiff > 0 ? "+" : ""}{rankDiff})
                      </span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {totalPool > 0 && (
        <div className="px-4 py-2 border-t border-border/60 bg-secondary/30 text-xs font-mono text-muted-foreground text-right">
          Rozdystrybuowano: {formatMoney(
            Object.values(prizeMap).reduce((s, v) => s + v, 0)
          )} z {tournament.prizePool}
        </div>
      )}
    </div>
  );
};

export default FullResultsPanel;
