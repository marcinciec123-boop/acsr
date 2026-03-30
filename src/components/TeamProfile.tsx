import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, Users, Globe, TrendingUp, Medal, MapPin, User, ArrowRightLeft } from "lucide-react";
import { teamDatabase, type SeasonTeamStanding } from "@/data/tournaments";
import { playerNationalities } from "@/data/playerNationalities";
import { playerRealNames } from "@/data/playerRealNames";
import { transfers } from "@/data/history";
import { countryFlag } from "@/lib/flags";
import { cn } from "@/lib/utils";

interface TeamProfileProps {
  teamName: string;
  onBack: () => void;
  seasonStanding?: SeasonTeamStanding;
  onSelectPlayer?: (playerName: string) => void;
}

const getAvatarColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "from-blue-500 to-blue-700",
    "from-emerald-500 to-emerald-700",
    "from-purple-500 to-purple-700",
    "from-amber-500 to-amber-700",
    "from-rose-500 to-rose-700",
    "from-cyan-500 to-cyan-700",
    "from-indigo-500 to-indigo-700",
    "from-teal-500 to-teal-700",
  ];
  return colors[Math.abs(hash) % colors.length];
};

const TeamProfile = ({ teamName, onBack, seasonStanding, onSelectPlayer }: TeamProfileProps) => {
  const team = teamDatabase.find((t) => t.name === teamName);
  const globalRank = team ? teamDatabase.indexOf(team) + 1 : 0;
  const tier = globalRank <= 10 ? "Tier 1" : globalRank <= 30 ? "Tier 2" : globalRank <= 60 ? "Tier 3" : "Tier 4";
  const tierColor = globalRank <= 10 ? "text-accent" : globalRank <= 30 ? "text-primary" : globalRank <= 60 ? "text-silver" : "text-muted-foreground";

  // Transfers related to this team
  const teamTransfers = useMemo(() => {
    return transfers.filter(t => t.oldTeam === teamName || t.newTeam === teamName);
  }, [teamName]);

  if (!team) {
    return (
      <section className="py-12">
        <div className="container mx-auto px-4">
          <button onClick={onBack} className="flex items-center gap-2 text-primary mb-6 hover:underline">
            <ArrowLeft className="w-4 h-4" /> Powrót
          </button>
          <p className="text-muted-foreground">Drużyna nie znaleziona.</p>
        </div>
      </section>
    );
  }

  const placementLabel = (p: number) => {
    if (p === 1) return "🥇";
    if (p === 2) return "🥈";
    if (p <= 4) return "🥉";
    return `#${p}`;
  };

  return (
    <section className="py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <button onClick={onBack} className="flex items-center gap-2 text-primary mb-6 hover:underline font-mono text-sm">
          <ArrowLeft className="w-4 h-4" /> Powrót do rankingu
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-lg p-6 mb-6"
        >
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-lg bg-secondary/50 border border-border flex items-center justify-center text-4xl shrink-0">
              {countryFlag(team.country)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-heading font-bold text-foreground">{team.name}</h1>
                <span className={cn("text-sm font-heading font-bold px-2 py-0.5 rounded border", tierColor,
                  globalRank <= 10 ? "border-accent/40 bg-accent/10" : globalRank <= 30 ? "border-primary/40 bg-primary/10" : "border-border bg-muted"
                )}>
                  {tier}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" /> {team.region}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {countryFlag(team.country)} {team.country}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-mono text-muted-foreground uppercase">Ranking ACSR</p>
              <p className={cn("text-4xl font-heading font-bold", globalRank <= 3 ? "text-accent" : "text-primary")}>#{globalRank}</p>
              <p className="font-mono text-primary font-bold text-lg">{team.points.toLocaleString()} pkt</p>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Ranking", value: `#${globalRank}`, icon: TrendingUp },
            { label: "Punkty ACSR", value: team.points.toLocaleString(), icon: Medal },
            { label: "Wygrane", value: seasonStanding?.wins?.toString() || "0", icon: Trophy },
            { label: "Turnieje", value: seasonStanding?.tournaments?.toString() || "0", icon: Users },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-lg p-4 text-center"
            >
              <stat.icon className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="text-xs font-mono text-muted-foreground uppercase">{stat.label}</p>
              <p className="text-xl font-heading font-bold text-foreground">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Roster */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card border border-border rounded-lg p-6 mb-6"
        >
          <h2 className="text-lg font-heading font-bold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Roster
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {team.roster.map((player, i) => {
              const playerCountry = playerNationalities[player] || team.country;
              const realName = playerRealNames[player];
              const avatarGradient = getAvatarColor(player);
              return (
                <motion.div
                  key={player}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                  onClick={() => onSelectPlayer?.(player)}
                  className={cn(
                    "bg-secondary/30 border border-border rounded-lg p-4 text-center hover:border-primary/40 transition-colors group",
                    onSelectPlayer && "cursor-pointer"
                  )}
                >
                  <div className={cn(
                    "w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center text-white bg-gradient-to-br shadow-lg",
                    avatarGradient
                  )}>
                    <User className="w-6 h-6" />
                  </div>
                  <p className="font-heading font-bold text-foreground text-sm">{player}</p>
                  {realName && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {realName.firstName} {realName.lastName}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                    <span>{countryFlag(playerCountry)}</span>
                    <span>{playerCountry}</span>
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Transfer History */}
        {teamTransfers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-card border border-border rounded-lg p-6 mb-6"
          >
            <h2 className="text-lg font-heading font-bold text-foreground mb-4 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary" /> Ruchy kadrowe
            </h2>
            <div className="space-y-2">
              {teamTransfers.map((t, i) => {
                const isJoin = t.newTeam === teamName;
                return (
                  <div key={`${t.player}-${i}`} className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg border border-border/50">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      isJoin ? "bg-win/20 text-win" : "bg-loss/20 text-loss"
                    )}>
                      {isJoin ? "+" : "−"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-bold text-foreground text-sm">
                        {playerNationalities[t.player] && (
                          <span className="mr-1">{countryFlag(playerNationalities[t.player])}</span>
                        )}
                        {t.player}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isJoin
                          ? t.oldTeam === "-" ? "Free Agent → Dołączył" : `z ${t.oldTeam}`
                          : t.newTeam === "-" ? "Odszedł → Free Agent" : `do ${t.newTeam}`
                        }
                      </p>
                    </div>
                    <span className={cn(
                      "text-xs font-mono font-bold px-2 py-0.5 rounded",
                      isJoin ? "bg-win/10 text-win" : "bg-loss/10 text-loss"
                    )}>
                      {isJoin ? "IN" : "OUT"}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Season History */}
        {seasonStanding && seasonStanding.pointHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border rounded-lg p-6"
          >
            <h2 className="text-lg font-heading font-bold text-foreground mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" /> Wyniki turniejowe (sezon 2026)
            </h2>
            <div className="space-y-2">
              {seasonStanding.pointHistory.map((h) => (
                <div
                  key={h.tournamentId}
                  className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{placementLabel(h.placement)}</span>
                    <div>
                      <p className="font-heading font-bold text-foreground text-sm">{h.tournamentName}</p>
                      <p className="text-xs text-muted-foreground">Miejsce: #{h.placement}</p>
                    </div>
                  </div>
                  <span className={cn("font-mono font-bold text-sm", h.points >= 0 ? "text-primary" : "text-destructive")}>
                    {h.points >= 0 ? "+" : ""}{h.points} pkt
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
              <span className="font-mono text-sm text-muted-foreground">Łącznie sezonowo</span>
              <span className="font-heading font-bold text-primary text-lg">{seasonStanding.totalPoints.toLocaleString()} pkt</span>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default TeamProfile;
