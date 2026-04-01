import { motion } from "framer-motion";
import { Trophy, Medal, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { type SeasonTeamStanding, type TeamData, teamDatabase } from "@/data/tournaments";
import { countryFlag } from "@/lib/flags";
import { useState } from "react";

interface SeasonStandingsProps {
  standings: SeasonTeamStanding[];
  dynamicRanking: TeamData[];
  onSelectTeam?: (teamName: string) => void;
}


const placementLabel = (p: number) => {
  if (p === 1) return "🥇";
  if (p === 2) return "🥈";
  if (p === 3 || p === 4) return "🥉";
  return `#${p}`;
};

const SeasonStandings = ({ standings, onSelectTeam }: SeasonStandingsProps) => {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const getTeamFlag = (name: string) => {
    const t = teamDatabase.find(td => td.name === name);
    return t ? countryFlag(t.country) : "🏳️";
  };

  if (standings.length === 0) {
    return (
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-primary" />
            <h2 className="text-3xl font-heading font-bold text-foreground">Ranking Sezonowy</h2>
          </div>
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-muted-foreground font-mono">Zagraj turnieje, aby zobaczyć ranking sezonowy.</p>
            <p className="text-muted-foreground/60 text-sm mt-2">Przejdź do zakładki Turnieje → Symulacja Sezonu</p>
          </div>
        </div>
      </section>
    );
  }

  const maxPoints = standings[0]?.totalPoints || 1;

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-6 h-6 text-primary" />
          <h2 className="text-3xl font-heading font-bold text-foreground">Ranking Sezonowy</h2>
          <span className="text-sm font-mono text-muted-foreground ml-2">
            {standings.length} drużyn • {standings.reduce((sum, s) => sum + s.tournaments, 0) / standings.length > 0 ? `${standings[0]?.tournaments || 0} turniejów` : ""}
          </span>
        </div>

        {/* Top 3 Podium */}
        {standings.length >= 3 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[standings[1], standings[0], standings[2]].map((team, i) => {
              const rank = i === 0 ? 2 : i === 1 ? 1 : 3;
              const heights = ["h-32", "h-40", "h-24"];
              const colors = [
                "border-silver/40 bg-silver/5",
                "border-accent/40 bg-accent/5",
                "border-bronze/40 bg-bronze/5",
              ];
              const textColors = ["text-silver", "text-accent", "text-bronze"];

              return (
                <motion.div
                  key={team.team}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className="flex flex-col items-center"
                >
                  <div className={cn("w-full rounded-t-lg border-t-2 border-x-2 flex flex-col items-center justify-end p-4", heights[i], colors[i])}>
                    <Medal className={cn("w-6 h-6 mb-2", textColors[i])} />
                    <p className={cn("font-heading font-bold text-lg", textColors[i])}>#{rank}</p>
                    <p className="font-heading font-bold text-foreground text-sm truncate w-full text-center">{getTeamFlag(team.team)} {team.team}</p>
                    <p className="font-mono text-primary font-bold">{team.totalPoints.toLocaleString()} pkt</p>
                    <p className="text-xs text-muted-foreground">{team.wins}W / {team.tournaments}T</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Full Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[60px_1fr_100px_80px_80px_80px_200px] gap-2 px-4 py-3 border-b border-border text-xs font-mono text-muted-foreground uppercase tracking-wider">
            <span>#</span>
            <span>Drużyna</span>
            <span className="text-right">Punkty</span>
            <span className="text-center">Turnieje</span>
            <span className="text-center">Wygrane</span>
            <span className="text-center">Top 4</span>
            <span>Pasek</span>
          </div>

          {standings.map((team, i) => {
            const isExpanded = expandedTeam === team.team;
            return (
              <motion.div
                key={team.team}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
              >
                <button
                  onClick={() => setExpandedTeam(isExpanded ? null : team.team)}
                  className={cn(
                    "w-full grid grid-cols-[60px_1fr_100px_80px_80px_80px_200px] gap-2 px-4 py-3 items-center border-b border-border/50 hover:bg-muted/30 transition-colors text-left",
                    i < 3 && "bg-primary/5",
                    isExpanded && "bg-muted/20"
                  )}
                >
                  <span className={cn(
                    "font-heading font-bold text-lg",
                    i === 0 ? "text-accent" : i === 1 ? "text-silver" : i === 2 ? "text-bronze" : "text-muted-foreground"
                  )}>
                    {i + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getTeamFlag(team.team)}</span>
                    <span
                      className="font-heading font-bold text-foreground hover:text-primary cursor-pointer transition-colors"
                      onClick={(e) => { e.stopPropagation(); onSelectTeam?.(team.team); }}
                    >
                      {team.team}
                    </span>
                    {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                  </div>
                  <span className="font-mono font-bold text-primary text-right">{team.totalPoints.toLocaleString()}</span>
                  <span className="font-mono text-muted-foreground text-center">{team.tournaments}</span>
                  <span className="font-mono text-win text-center">{team.wins}</span>
                  <span className="font-mono text-foreground text-center">{team.top4}</span>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full gradient-primary rounded-full transition-all duration-500"
                      style={{ width: `${(team.totalPoints / maxPoints) * 100}%` }}
                    />
                  </div>
                </button>

                {/* Expanded history */}
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-muted/10 border-b border-border px-4 py-3"
                  >
                    <p className="text-xs font-mono text-muted-foreground uppercase mb-2">Historia turniejów</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {team.pointHistory.map((h) => (
                        <div
                          key={h.tournamentId}
                          className="flex items-center justify-between p-2 bg-card rounded border border-border/50 text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span>{placementLabel(h.placement)}</span>
                            <span className="text-foreground font-medium truncate">{h.tournamentName}</span>
                          </div>
                          <span className="font-mono text-primary font-bold ml-2 shrink-0">+{h.points}</span>
                        </div>
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

export default SeasonStandings;
