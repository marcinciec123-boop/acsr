import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  ArrowLeft, Trophy, MapPin, Calendar, DollarSign, Users as UsersIcon, Trash2,
  Award, Send, ArrowUp, ArrowDown, Shuffle, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TournamentData, MatchResult } from "@/lib/types";
import { formatLabel, computeGroupStandings } from "@/lib/tournamentBuilder";

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
  onAddBracketMatch: (phaseId: string, round: string) => void;
  onMoveBracketMatch: (phaseId: string, matchId: string, dir: -1 | 1) => void;
  onReseedPhase?: (phaseId: string, teams: string[]) => void;
  onSetStatus: (status: "upcoming" | "live" | "completed") => void;
  onDelete: () => void;
  onOpenMatch: (phaseId: string, matchId: string, groupId?: string) => void;
  mainTournaments?: TournamentData[];
  onPromoteWinners?: (winners: string[], targetTournamentId: string) => void;
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

/** Compute top-N team names per region/global based on bracket finals + group standings */
const computeQualifierWinners = (t: TournamentData): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  if (!t.qualifierConfig) return result;
  const { scope, regions, slotsPerRegion } = t.qualifierConfig;

  // For each region (or "GLOBAL"), find phases tagged with that region (or all phases if global/no tag)
  regions.forEach(regionKey => {
    const slots = slotsPerRegion[regionKey] || 0;
    if (slots <= 0) return;
    const matchingPhases = t.phases.filter(p =>
      scope === "global" ? true : (p.region === regionKey || !p.region)
    );

    // 1) Try to extract from bracket Final winners first
    const winners: string[] = [];
    matchingPhases.forEach(p => {
      if (p.bracket && p.bracket.length > 0) {
        // Find the last round (likely "Final" or biggest index)
        const rounds = Array.from(new Set(p.bracket.map(m => m.round || "Match")));
        const finalRound = rounds.find(r => r.toLowerCase().includes("final")) || rounds[rounds.length - 1];
        const finals = p.bracket.filter(m => (m.round || "Match") === finalRound);
        finals.forEach(m => {
          if (m.score1 + m.score2 === 0) return;
          const w = m.score1 > m.score2 ? m.team1 : m.team2;
          if (w && w !== "BYE" && w !== "TBD" && !winners.includes(w)) winners.push(w);
        });
      }
      if (p.groups) {
        p.groups.forEach(g => {
          const standings = computeGroupStandings(g);
          standings.slice(0, slots).forEach(s => {
            if (s.team && !winners.includes(s.team)) winners.push(s.team);
          });
        });
      }
    });
    result[regionKey] = winners.slice(0, slots);
  });
  return result;
};

export const TournamentDetailPage = ({
  tournament: t, allTeams, onBack, onUpdateMatch, onDeleteBracketMatch,
  onAddBracketMatch, onMoveBracketMatch, onReseedPhase, onSetStatus, onDelete, onOpenMatch,
  mainTournaments = [], onPromoteWinners,
}: Props) => {
  const totalMatches = t.phases.reduce((sum, p) =>
    sum + (p.bracket?.length || 0) + (p.groups?.reduce((s, g) => s + g.matches.length, 0) || 0), 0
  );

  const isQualifier = t.kind === "qualifier" && !!t.qualifierConfig;
  const winnersByRegion = useMemo(() => isQualifier ? computeQualifierWinners(t) : {}, [t, isQualifier]);
  const [linkedTarget, setLinkedTarget] = useState<string>(t.qualifierConfig?.linkedTournamentId || "");

  const promoted = t.qualifierConfig?.promotedTeams || [];
  const allWinners = Object.values(winnersByRegion).flat();
  const pendingPromotion = allWinners.filter(w => !promoted.includes(w));

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

        {/* Qualifier panel */}
        {isQualifier && (
          <div className="bg-gradient-to-br from-[hsl(var(--gold))]/5 to-card border border-[hsl(var(--gold))]/30 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-[hsl(var(--gold))]" />
              <h3 className="text-xs font-heading font-bold uppercase text-[hsl(var(--gold))] tracking-wider">
                Kwalifikacja {t.qualifierConfig!.scope === "global" ? "globalna" : "regionalna"}
              </h3>
              <span className="text-[10px] font-mono text-muted-foreground">
                • {Object.values(t.qualifierConfig!.slotsPerRegion).reduce((a, b) => a + b, 0)} miejsc do zdobycia
              </span>
            </div>

            <div className="space-y-3">
              {t.qualifierConfig!.regions.map(regionKey => {
                const slots = t.qualifierConfig!.slotsPerRegion[regionKey] || 0;
                const winners = winnersByRegion[regionKey] || [];
                return (
                  <div key={regionKey} className="bg-card/60 border border-border rounded-md p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono font-bold text-foreground">
                        {regionKey === "GLOBAL" ? "🌍 Globalna pula" : `📍 ${regionKey}`}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {winners.length}/{slots} miejsc obsadzonych
                      </span>
                    </div>
                    {winners.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground font-mono italic">
                        Brak rozegranych meczów — wpisz wyniki, aby wyłonić zwycięzców.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {winners.map((w, i) => (
                          <span key={w} className={cn(
                            "text-[11px] font-mono px-2 py-1 rounded border flex items-center gap-1.5",
                            promoted.includes(w)
                              ? "bg-[hsl(var(--win))]/15 border-[hsl(var(--win))]/40 text-[hsl(var(--win))]"
                              : "bg-primary/10 border-primary/30 text-primary"
                          )}>
                            <span className="opacity-60">#{i + 1}</span>
                            {w}
                            {promoted.includes(w) && <span className="text-[9px]">✓ awansował</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {onPromoteWinners && (
              <div className="mt-4 pt-4 border-t border-[hsl(var(--gold))]/20 space-y-2">
                <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                  Awansuj zwycięzców do turnieju głównego
                </label>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={linkedTarget}
                    onChange={e => setLinkedTarget(e.target.value)}
                    className="flex-1 min-w-[200px] px-2 py-1.5 rounded bg-card border border-border text-xs font-mono"
                  >
                    <option value="">— wybierz turniej główny —</option>
                    {mainTournaments.map(mt => (
                      <option key={mt.id} value={mt.id}>{mt.name}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (linkedTarget && pendingPromotion.length > 0) {
                        onPromoteWinners(pendingPromotion, linkedTarget);
                      }
                    }}
                    disabled={!linkedTarget || pendingPromotion.length === 0}
                    className="gap-1.5"
                  >
                    <Send className="w-3 h-3" />
                    Awansuj {pendingPromotion.length} drużyn
                  </Button>
                </div>
                {pendingPromotion.length === 0 && allWinners.length > 0 && (
                  <p className="text-[10px] font-mono text-muted-foreground">
                    ✓ Wszyscy zwycięzcy zostali już awansowani.
                  </p>
                )}
              </div>
            )}
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
                        onOpenMatch={(mid) => onOpenMatch(phase.id, mid, g.id)}
                      />
                    ))}
                  </div>
                )}
                {phase.bracket && phase.bracket.length > 0 && (
                  <BracketView
                    matches={phase.bracket}
                    allTeams={[...t.participants, ...allTeams]}
                    onUpdate={(mid, s1, s2, t1, t2, round) =>
                      onUpdateMatch(phase.id, mid, {
                        score1: s1, score2: s2,
                        ...(t1 !== undefined && { team1: t1 }),
                        ...(t2 !== undefined && { team2: t2 }),
                        ...(round !== undefined && { round }),
                      })
                    }
                    onDelete={(mid) => onDeleteBracketMatch(phase.id, mid)}
                    onMove={(mid, dir) => onMoveBracketMatch(phase.id, mid, dir)}
                    onAdd={(round) => onAddBracketMatch(phase.id, round)}
                    onOpenMatch={(mid) => onOpenMatch(phase.id, mid)}
                  />
                )}
                {(!phase.groups || phase.groups.length === 0) && (!phase.bracket || phase.bracket.length === 0) && (
                  <div className="text-center py-4">
                    <p className="text-xs text-muted-foreground font-mono mb-3">
                      Brak meczów w tej fazie.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAddBracketMatch(phase.id, "Round 1")}
                    >
                      + Dodaj pierwszy mecz
                    </Button>
                  </div>
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
