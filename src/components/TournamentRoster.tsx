import { motion } from "framer-motion";
import { Crown, Shield, Trophy, Users, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Tournament } from "@/data/tournaments";

interface TournamentRosterProps {
  tournament: Tournament;
  participants: string[];
}

const TournamentRoster = ({ tournament, participants }: TournamentRosterProps) => {
  const invitedTeams = tournament.invitedTeams || [];
  const manualInvites = tournament.manualInvites || [];
  const qualifiedTeams = tournament.qualifiedTeams || [];
  const config = tournament.qualification;

  // If no qualification info, just show all participants
  const hasQualInfo = invitedTeams.length > 0 || qualifiedTeams.length > 0 || manualInvites.length > 0;

  if (!hasQualInfo && config.qualifierType === "none") {
    return (
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <h3 className="font-heading font-bold text-foreground flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-primary" />
          Skład turnieju ({participants.length})
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {participants.map((t, i) => (
            <motion.div
              key={t}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="px-3 py-2 bg-secondary/50 border border-border/50 rounded text-sm font-mono text-foreground flex items-center gap-2"
            >
              <span className="text-[10px] text-muted-foreground">#{i + 1}</span>
              {t}
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-6 space-y-4">
      <h3 className="font-heading font-bold text-foreground flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" />
        Skład turnieju ({participants.length} drużyn)
      </h3>

      {/* Ranking invites */}
      {invitedTeams.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-3.5 h-3.5 text-win" />
            <span className="text-xs font-mono text-win uppercase tracking-wider">
              Z rankingu ({invitedTeams.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {invitedTeams.map((t, i) => (
              <motion.span
                key={t}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.02 }}
                className="px-2 py-1 bg-win/10 text-win border border-win/20 rounded text-xs font-mono"
              >
                {t}
              </motion.span>
            ))}
          </div>
        </div>
      )}

      {/* Manual invites */}
      {manualInvites.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <UserPlus className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-mono text-accent uppercase tracking-wider">
              Ręczne zaproszenia ({manualInvites.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {manualInvites.map((t, i) => (
              <motion.span
                key={t}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.02 }}
                className="px-2 py-1 bg-accent/10 text-accent border border-accent/20 rounded text-xs font-mono"
              >
                {t}
              </motion.span>
            ))}
          </div>
        </div>
      )}

      {/* Qualified teams */}
      {qualifiedTeams.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-mono text-primary uppercase tracking-wider">
              Z kwalifikacji ({qualifiedTeams.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {qualifiedTeams.map((t, i) => (
              <motion.span
                key={t}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.02 }}
                className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-mono"
              >
                {t}
              </motion.span>
            ))}
          </div>
        </div>
      )}

      {/* Remaining (ranking-filled for B-tier) */}
      {invitedTeams.length === 0 && qualifiedTeams.length === 0 && manualInvites.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {participants.map((t, i) => (
            <span key={t} className="px-2 py-1 bg-secondary/50 text-foreground border border-border/50 rounded text-xs font-mono">
              #{i + 1} {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default TournamentRoster;
