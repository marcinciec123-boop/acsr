import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Star, Trophy, Calendar, TrendingUp, User } from "lucide-react";
import { teamDatabase, type TournamentSimulation, type Tournament } from "@/data/tournaments";
import { type MatchStats, calculateRating } from "@/lib/playerStats";
import { cn } from "@/lib/utils";

interface PlayerRatingRankingsProps {
  simResults: Record<string, TournamentSimulation>;
  tournaments: Tournament[];
  allMatchStats: Record<string, MatchStats>;
  onSelectPlayer?: (name: string) => void;
}

type TimeFilter = "last-tournament" | "month" | "year";

interface PlayerRatingEntry {
  name: string;
  team: string;
  rating: number;
  matches: number;
  kills: number;
  deaths: number;
  adr: number;
}

function getPlayerRatings(
  allMatchStats: Record<string, MatchStats>,
  _filter: TimeFilter
): PlayerRatingEntry[] {
  const playerData: Record<string, { ratings: number[]; kills: number; deaths: number; adr: number[]; team: string }> = {};

  for (const stats of Object.values(allMatchStats)) {
    const processPlayers = (players: typeof stats.team1Stats, team: string) => {
      for (const p of players) {
        if (!playerData[p.playerName]) {
          playerData[p.playerName] = { ratings: [], kills: 0, deaths: 0, adr: [], team };
        }
        const entry = playerData[p.playerName];
        const rating = p.rating || calculateRating(p);
        entry.ratings.push(rating);
        entry.kills += p.kills;
        entry.deaths += p.deaths;
        entry.adr.push(p.adr);
        entry.team = team;
      }
    };

    processPlayers(stats.team1Stats, stats.team1Stats[0]?.team || "");
    processPlayers(stats.team2Stats, stats.team2Stats[0]?.team || "");
  }

  return Object.entries(playerData)
    .map(([name, data]) => ({
      name,
      team: data.team,
      rating: data.ratings.length > 0
        ? data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length
        : 0,
      matches: data.ratings.length,
      kills: data.kills,
      deaths: data.deaths,
      adr: data.adr.length > 0 ? data.adr.reduce((a, b) => a + b, 0) / data.adr.length : 0,
    }))
    .filter(p => p.matches > 0)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 100);
}

// Generate mock stats for all teams to fill rankings
function generateAutoRatings(): PlayerRatingEntry[] {
  const entries: PlayerRatingEntry[] = [];
  for (const team of teamDatabase) {
    for (const player of team.roster) {
      // Generate a plausible rating based on team ranking
      const teamIdx = teamDatabase.indexOf(team);
      const baseRating = 1.15 - (teamIdx / teamDatabase.length) * 0.4;
      const variance = (Math.random() - 0.5) * 0.3;
      const rating = Math.max(0.5, Math.min(1.8, baseRating + variance));
      
      entries.push({
        name: player,
        team: team.name,
        rating: Math.round(rating * 100) / 100,
        matches: Math.floor(5 + Math.random() * 20),
        kills: Math.floor(50 + Math.random() * 200),
        deaths: Math.floor(40 + Math.random() * 180),
        adr: Math.round(60 + Math.random() * 40),
      });
    }
  }
  return entries.sort((a, b) => b.rating - a.rating).slice(0, 100);
}

const getRatingColor = (rating: number) => {
  if (rating >= 1.3) return "text-accent";
  if (rating >= 1.15) return "text-win";
  if (rating >= 1.0) return "text-primary";
  if (rating >= 0.85) return "text-foreground";
  return "text-muted-foreground";
};

const PlayerRatingRankings = ({ allMatchStats, onSelectPlayer }: PlayerRatingRankingsProps) => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("year");

  const playedRatings = useMemo(() => getPlayerRatings(allMatchStats, timeFilter), [allMatchStats, timeFilter]);
  const autoRatings = useMemo(() => generateAutoRatings(), []);

  // Merge: played ratings take priority, fill remaining from auto
  const ratings = useMemo(() => {
    if (playedRatings.length >= 20) return playedRatings;
    const playedNames = new Set(playedRatings.map(p => p.name));
    const remaining = autoRatings.filter(p => !playedNames.has(p.name));
    return [...playedRatings, ...remaining].sort((a, b) => b.rating - a.rating).slice(0, 100);
  }, [playedRatings, autoRatings]);

  const filterButtons: { key: TimeFilter; label: string; icon: typeof Calendar }[] = [
    { key: "last-tournament", label: "Ostatni turniej", icon: Trophy },
    { key: "month", label: "Miesiąc", icon: Calendar },
    { key: "year", label: "Rok", icon: TrendingUp },
  ];

  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <Star className="w-6 h-6 text-accent" />
            <h2 className="text-3xl font-heading font-bold text-foreground">Top 100 Graczy</h2>
          </div>

          {/* Time filter */}
          <div className="flex gap-2 mb-6">
            {filterButtons.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTimeFilter(key)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-mono transition-colors border",
                  timeFilter === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/50 text-muted-foreground border-border hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Rankings table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[50px_1fr_1fr_80px_80px_80px_80px_80px] gap-1 px-4 py-2.5 bg-secondary/50 text-xs font-mono text-muted-foreground uppercase">
              <div>#</div>
              <div>Gracz</div>
              <div>Drużyna</div>
              <div className="text-center">Rating</div>
              <div className="text-center">Mecze</div>
              <div className="text-center">K</div>
              <div className="text-center">D</div>
              <div className="text-center">ADR</div>
            </div>

            {ratings.map((player, idx) => (
              <motion.div
                key={player.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.01 }}
                onClick={() => onSelectPlayer?.(player.name)}
                className={cn(
                  "grid grid-cols-[50px_1fr_1fr_80px_80px_80px_80px_80px] gap-1 px-4 py-2.5 border-t border-border/50 items-center text-sm hover:bg-secondary/30 transition-colors cursor-pointer",
                  idx === 0 && "bg-accent/5",
                  idx === 1 && "bg-silver/5",
                  idx === 2 && "bg-bronze/5"
                )}
              >
                <div className={cn(
                  "font-mono font-bold",
                  idx === 0 ? "text-accent" : idx === 1 ? "text-silver" : idx === 2 ? "text-bronze" : "text-muted-foreground"
                )}>
                  {idx + 1}
                </div>
                <div className="font-medium text-foreground flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  {player.name}
                </div>
                <div className="text-muted-foreground text-xs font-mono truncate">{player.team}</div>
                <div className={cn("text-center font-mono font-bold", getRatingColor(player.rating))}>
                  {player.rating.toFixed(2)}
                </div>
                <div className="text-center font-mono text-muted-foreground">{player.matches}</div>
                <div className="text-center font-mono text-foreground">{player.kills}</div>
                <div className="text-center font-mono text-muted-foreground">{player.deaths}</div>
                <div className="text-center font-mono text-foreground">{Math.round(player.adr)}</div>
              </motion.div>
            ))}

            {ratings.length === 0 && (
              <div className="p-8 text-center text-muted-foreground font-mono text-sm">
                Brak danych — rozegraj turnieje, aby zobaczyć ranking graczy
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default PlayerRatingRankings;
