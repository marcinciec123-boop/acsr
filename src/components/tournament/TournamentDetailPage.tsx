import { motion } from "framer-motion";
import {
  ArrowLeft, Trophy, MapPin, Calendar, DollarSign, Users as UsersIcon, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TournamentData, MatchResult } from "@/lib/types";
import { formatLabel } from "@/lib/tournamentBuilder";
import { BracketView } from "./BracketView";
import { GroupTable } from "./GroupTable";

interface Props {
  tournament: TournamentData;
  allTeams: string[];
  onBack: () => void;
  onUpdateMatch: (
    phaseId: string,
    matchId: string,
    patch: Partial<MatchResult>,
    groupId?: string,
  ) => void;
  onDeleteBracketMatch: (phaseId: string, matchId: string) => void;
  onSetStatus: (status: "upcoming" | "live" | "completed") => void;
  onDelete: () => void;
}

const tierColor = (tier: string) => {
  switch (tier) {
    case "S": return "text-[hsl(var(--gold))] border-[hsl(var(--gold))]/40 bg-[hsl(var(--gold))]/10";
    case "A": return "text-primary border-primary/40 bg-primary/10";
    case "B": return "text-[hsl(var(--silver))] border-[hsl(var(--silver))]/40 bg-[hsl(var(--silver))]/10";
    default: return "text-muted-foreground border-border bg-secondary/50";
  }
};

const statusBadge = (status: string) => {
  switch (status) {
    case "live": return "bg-[hsl(var(--win))]/20 text-[hsl(var(--win))] border-[hsl(var(--win))]/40";
    case "completed": return "bg-muted text-muted-foreground border-border";
    default: return "bg-primary/10 text-primary border-primary/30";
  }
};

const statusLabel = (s: string) =>
  s === "live" ? "W trakcie" : s === "completed" ? "Zakończony" : "Nadchodzący";

export const TournamentDetailPage = ({
  tournament: t, allTeams, onBack, onUpdateMatch, onDeleteBracketMatch, onSetStatus, onDelete,
}: Props) => {
  const totalMatches = t.phases.reduce((sum, p) =>
    sum + (p.bracket?.length || 0) + (p.groups?.reduce((s, g) => s + g.matches.length, 0) || 0), 0
  );

  return (
    <section className="py-6">
      <div className="container mx-auto px-4 max-w-6xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Powrót do listy
        </Button>

        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-card to-secondary/30 border border-border rounded-xl p-6 mb-6"
        >
          <div className="flex flex-wrap items-start gap-3 mb-3">
            <span className={cn("text-xs font-mono font-bold px-2 py-1 rounded border", tierColor(t.tier))}>
              TIER {t.tier}
            </span>
            <span className={cn("text-xs px-2 py-1 rounded border font-mono", statusBadge(t.status))}>
              {statusLabel(t.status)}
            </span>
            <span className="text-xs px-2 py-1 rounded border border-border bg-secondary/50 font-mono text-muted-foreground">
              {t.phases.length} faz • {totalMatches} mecz(ów)
            </span>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-7 h-7 text-primary shrink-0" />
            <h1 className="text-3xl font-heading font-bold text-foreground">{t.name}</h1>
          </div>
          {t.organizer && (
            <p className="text-sm text-muted-foreground mb-4">organizowany przez <span className="text-foreground">{t.organizer}</span></p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border/50">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                <Calendar className="w-3 h-3" /> Daty
              </div>
              <p className="text-sm font-mono text-foreground">{t.startDate || "—"}<br/>{t.endDate || "—"}</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                <MapPin className="w-3 h-3" /> Lokalizacja
              </div>
              <p className="text-sm font-mono text-foreground">{t.location || "—"}</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                <DollarSign className="w-3 h-3" /> Pula nagród
              </div>
              <p className="text-sm font-mono text-primary font-bold">{t.prizePool}</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                <UsersIcon className="w-3 h-3" /> Drużyny
              </div>
              <p className="text-sm font-mono text-foreground">{t.teams}</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Format</div>
            <p className="text-sm font-mono text-foreground">{t.format}</p>
          </div>
        </motion.div>

        {/* Participants */}
        {t.participants.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider mb-3">
              Uczestnicy ({t.participants.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {t.participants.map((p, i) => (
                <span
                  key={p}
                  className="text-xs font-mono px-2 py-1 rounded border border-border bg-secondary/40 text-foreground"
                >
                  <span className="text-muted-foreground mr-1">#{i + 1}</span>{p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Phases */}
        <div className="space-y-4">
          {t.phases.map((phase, idx) => (
            <motion.div
              key={phase.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-card border border-border rounded-lg overflow-hidden"
            >
              <div className="bg-secondary/40 px-4 py-3 flex items-center justify-between border-b border-border/50">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground">FAZA {idx + 1}</span>
                  <h4 className="text-base font-heading font-bold text-foreground">{phase.name}</h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                    {formatLabel(phase.format)} • BO{phase.bo}
                  </span>
                </div>
                {phase.advanceCount ? (
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Awansuje: {phase.advanceCount}
                  </span>
                ) : null}
              </div>
              <div className="p-4">
                {phase.groups && phase.groups.length > 0 && (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {phase.groups.map(g => (
                      <GroupTable
                        key={g.id}
                        group={g}
                        onMatchUpdate={(mid, s1, s2) =>
                          onUpdateMatch(phase.id, mid, { score1: s1, score2: s2 }, g.id)
                        }
                      />
                    ))}
                  </div>
                )}
                {phase.bracket && phase.bracket.length > 0 && (
                  <BracketView
                    matches={phase.bracket}
                    allTeams={[...t.participants, ...allTeams]}
                    onUpdate={(mid, s1, s2, t1, t2) =>
                      onUpdateMatch(phase.id, mid, {
                        score1: s1, score2: s2,
                        ...(t1 !== undefined && { team1: t1 }),
                        ...(t2 !== undefined && { team2: t2 }),
                      })
                    }
                    onDelete={(mid) => onDeleteBracketMatch(phase.id, mid)}
                  />
                )}
                {(!phase.groups || phase.groups.length === 0) && (!phase.bracket || phase.bracket.length === 0) && (
                  <p className="text-xs text-muted-foreground font-mono text-center py-4">
                    Brak meczów w tej fazie.
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-border/50">
          {t.status !== "live" && (
            <Button size="sm" variant="outline" onClick={() => onSetStatus("live")}>
              Rozpocznij
            </Button>
          )}
          {t.status !== "completed" && (
            <Button size="sm" variant="outline" onClick={() => onSetStatus("completed")}>
              Zakończ
            </Button>
          )}
          {t.status === "completed" && (
            <Button size="sm" variant="outline" onClick={() => onSetStatus("upcoming")}>
              Resetuj status
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive ml-auto"
            onClick={() => { onDelete(); onBack(); }}
          >
            <Trash2 className="w-4 h-4 mr-1.5" /> Usuń turniej
          </Button>
        </div>
      </div>
    </section>
  );
};
