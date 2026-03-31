import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Star, Trophy, Calendar, TrendingUp, User } from "lucide-react";
import { teamDatabase, type TournamentSimulation, type Tournament } from "@/data/tournaments";
import { type MatchStats, calculateRating } from "@/lib/playerStats";
import { cn } from "@/lib/utils";
import { collectAllMatches } from "@/lib/eloSystem";

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

function getPlayerRatingsFromStats(
  allMatchStats: Record<string, MatchStats>,
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
    .sort((a, b) => b.rating - a.rating);
}

// Generate ratings for all teams based on simulated tournament results
function generateRatingsFromSims(
  simResults: Record<string, TournamentSimulation>,
  tournaments: Tournament[],
  filter: TimeFilter
): PlayerRatingEntry[] {
  const entries: PlayerRatingEntry[] = [];
  const playerMap: Record<string, { ratings: number[]; kills: number; deaths: number; adr: number[]; team: string }> = {};

  // Filter tournaments by time
  const completedTournaments = tournaments.filter(t => simResults[t.id]);
  let filteredTournaments = completedTournaments;
  
  if (filter === "last-tournament" && completedTournaments.length > 0) {
    filteredTournaments = [completedTournaments[completedTournaments.length - 1]];
  } else if (filter === "month") {
    // Last 3 tournaments
    filteredTournaments = completedTournaments.slice(-3);
  }

  // For each tournament, generate ratings for participating players
  for (const t of filteredTournaments) {
    const sim = simResults[t.id];
    if (!sim) continue;

    const allMatches = collectAllMatches(sim);
    const matchCountPerTeam: Record<string, number> = {};
    const winsPerTeam: Record<string, number> = {};

    for (const m of allMatches) {
      matchCountPerTeam[m.team1] = (matchCountPerTeam[m.team1] || 0) + 1;
      matchCountPerTeam[m.team2] = (matchCountPerTeam[m.team2] || 0) + 1;
      if (m.winner) {
        winsPerTeam[m.winner] = (winsPerTeam[m.winner] || 0) + 1;
      }
    }

    // Generate plausible player stats based on team performance
    for (const placement of sim.placements) {
      const teamData = teamDatabase.find(td => td.name === placement.team);
      if (!teamData) continue;

      const teamMatches = matchCountPerTeam[placement.team] || 1;
      const teamWins = winsPerTeam[placement.team] || 0;
      const winRate = teamMatches > 0 ? teamWins / teamMatches : 0.5;

      for (const player of teamData.roster) {
        if (!playerMap[player]) {
          playerMap[player] = { ratings: [], kills: 0, deaths: 0, adr: [], team: placement.team };
        }
        const entry = playerMap[player];
        // Generate plausible rating based on placement and win rate
        const baseRating = 0.85 + winRate * 0.4 + (1 - placement.placement / sim.placements.length) * 0.2;
        const variance = (Math.random() - 0.5) * 0.2;
        const rating = Math.max(0.5, Math.min(1.8, baseRating + variance));
        
        entry.ratings.push(rating);
        const matchKills = Math.floor(15 + rating * 8 + Math.random() * 5) * teamMatches;
        const matchDeaths = Math.floor(12 + (2 - rating) * 5 + Math.random() * 4) * teamMatches;
        entry.kills += matchKills;
        entry.deaths += matchDeaths;
        entry.adr.push(60 + rating * 25 + Math.random() * 15);
        entry.team = placement.team;
      }
    }
  }

  for (const [name, data] of Object.entries(playerMap)) {
    entries.push({
      name,
      team: data.team,
      rating: Math.round((data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length) * 100) / 100,
      matches: data.ratings.length,
      kills: data.kills,
      deaths: data.deaths,
      adr: Math.round(data.adr.reduce((a, b) => a + b, 0) / data.adr.length),
    });
  }

  return entries.sort((a, b) => b.rating - a.rating).slice(0, 100);
}

// Generate fallback rankings for teams that haven't played
function generateBaseRatings(): PlayerRatingEntry[] {
  const entries: PlayerRatingEntry[] = [];
  for (const team of teamDatabase) {
    for (const player of team.roster) {
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

const PlayerRatingRankings = ({ simResults, tournaments, allMatchStats, onSelectPlayer }: PlayerRatingRankingsProps) => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("year");

  const completedCount = Object.keys(simResults).length;

  // Get ratings from actual match stats (manually entered)
  const manualRatings = useMemo(() => getPlayerRatingsFromStats(allMatchStats), [allMatchStats]);

  // Get ratings from simulation results
  const simRatings = useMemo(() => generateRatingsFromSims(simResults, tournaments, timeFilter), [simResults, tournaments, timeFilter]);

  // Base fallback
  const baseRatings = useMemo(() => generateBaseRatings(), []);

  // Merge: manual > sim > base
  const ratings = useMemo(() => {
    const manualNames = new Set(manualRatings.map(p => p.name));
    const simFiltered = simRatings.filter(p => !manualNames.has(p.name));
    const combined = [...manualRatings, ...simFiltered];
    
    if (combined.length >= 20) return combined.sort((a, b) => b.rating - a.rating).slice(0, 100);
    
    const combinedNames = new Set(combined.map(p => p.name));
    const remaining = baseRatings.filter(p => !combinedNames.has(p.name));
    return [...combined, ...remaining].sort((a, b) => b.rating - a.rating).slice(0, 100);
  }, [manualRatings, simRatings, baseRatings]);

  const filterButtons: { key: TimeFilter; label: string; icon: typeof Calendar }[] = [
    { key: "last-tournament", label: "Ostatni turniej", icon: Trophy },
    { key: "month", label: "Miesiąc", icon: Calendar },
    { key: "year", label: "Rok", icon: TrendingUp },
  ];

  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <Star className="w-6 h-6 text-accent" />
            <h2 className="text-3xl font-heading font-bold text-foreground">Top 100 Graczy</h2>
          </div>
          <p className="text-muted-foreground text-sm font-mono mb-6">
            {completedCount > 0 
              ? `Bazowane na ${completedCount} rozegranych turniejach`
              : "Rozegraj turnieje, aby zobaczyć dokładniejsze statystyki"
            }
          </p>

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
