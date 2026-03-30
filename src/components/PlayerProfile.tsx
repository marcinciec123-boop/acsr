import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, User, Globe, ArrowRightLeft, Trophy, MapPin, Shield } from "lucide-react";
import { teamDatabase, type SeasonTeamStanding } from "@/data/tournaments";
import { playerNationalities } from "@/data/playerNationalities";
import { playerRealNames } from "@/data/playerRealNames";
import { getAllTransfers } from "@/data/history";
import { countryFlag } from "@/lib/flags";
import { cn } from "@/lib/utils";

interface PlayerProfileProps {
  playerName: string;
  onBack: () => void;
  onSelectTeam: (team: string) => void;
  seasonStandings: SeasonTeamStanding[];
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

const PlayerProfile = ({ playerName, onBack, onSelectTeam, seasonStandings }: PlayerProfileProps) => {
  const country = playerNationalities[playerName] || "??";
  const realName = playerRealNames[playerName];

  // Find current team
  const currentTeam = useMemo(() => {
    return teamDatabase.find(t => t.roster.includes(playerName));
  }, [playerName]);

  const teamRank = currentTeam ? teamDatabase.indexOf(currentTeam) + 1 : null;

  // Transfer history
  const playerTransfers = useMemo(() => {
    return getAllTransfers().filter(t => t.player === playerName);
  }, [playerName]);

  // Season stats via team
  const teamStanding = currentTeam
    ? seasonStandings.find(s => s.team === currentTeam.name)
    : null;

  const avatarGradient = getAvatarColor(playerName);

  return (
    <section className="py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <button onClick={onBack} className="flex items-center gap-2 text-primary mb-6 hover:underline font-mono text-sm">
          <ArrowLeft className="w-4 h-4" /> Powrót
        </button>

        {/* Player header card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-lg p-6 mb-6"
        >
          <div className="flex items-center gap-6">
            <div className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center text-white bg-gradient-to-br shadow-lg shrink-0",
              avatarGradient
            )}>
              <User className="w-10 h-10" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-heading font-bold text-foreground">{playerName}</h1>
              {realName && (
                <p className="text-muted-foreground text-sm mt-0.5">
                  {realName.firstName} {realName.lastName}
                </p>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" /> {countryFlag(country)} {country}
                </span>
                {currentTeam && (
                  <button
                    onClick={() => onSelectTeam(currentTeam.name)}
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    {countryFlag(currentTeam.country)} {currentTeam.name}
                    {teamRank && <span className="font-mono text-xs">(#{teamRank})</span>}
                  </button>
                )}
                {!currentTeam && (
                  <span className="flex items-center gap-1 text-muted-foreground italic">
                    <Shield className="w-3.5 h-3.5" /> Free Agent
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Info cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Narodowość", value: `${countryFlag(country)} ${country}`, icon: MapPin },
            { label: "Drużyna", value: currentTeam?.name || "Free Agent", icon: Shield },
            { label: "Ranking drużyny", value: teamRank ? `#${teamRank}` : "—", icon: Trophy },
            { label: "Transfery", value: playerTransfers.length.toString(), icon: ArrowRightLeft },
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
              <p className="text-lg font-heading font-bold text-foreground truncate">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Team season stats */}
        {teamStanding && teamStanding.pointHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-card border border-border rounded-lg p-6 mb-6"
          >
            <h2 className="text-lg font-heading font-bold text-foreground mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" /> Wyniki z drużyną (sezon 2026)
            </h2>
            <div className="space-y-2">
              {teamStanding.pointHistory.map(h => (
                <div key={h.tournamentId} className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg border border-border/50">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{h.placement === 1 ? "🥇" : h.placement === 2 ? "🥈" : h.placement <= 4 ? "🥉" : `#${h.placement}`}</span>
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
          </motion.div>
        )}

        {/* Transfer history */}
        {playerTransfers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-card border border-border rounded-lg p-6"
          >
            <h2 className="text-lg font-heading font-bold text-foreground mb-4 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary" /> Historia transferów
            </h2>
            <div className="space-y-2">
              {playerTransfers.map((t, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg border border-border/50">
                  <ArrowRightLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      {t.oldTeam === "-" ? (
                        <span className="text-muted-foreground italic">Free Agent</span>
                      ) : (
                        <span className="text-loss font-heading font-bold">{t.oldTeam}</span>
                      )}
                      <span className="text-primary font-bold">→</span>
                      {t.newTeam === "-" ? (
                        <span className="text-muted-foreground italic">Free Agent</span>
                      ) : (
                        <span className="text-win font-heading font-bold">{t.newTeam}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {playerTransfers.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card border border-border rounded-lg p-8 text-center"
          >
            <ArrowRightLeft className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-muted-foreground font-mono text-sm">Brak historii transferów</p>
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default PlayerProfile;
