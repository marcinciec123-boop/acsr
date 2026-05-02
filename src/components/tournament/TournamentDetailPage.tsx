import { motion } from "framer-motion";
import { useMemo, useState, useEffect } from "react";
import {
  ArrowLeft, Trophy, MapPin, Calendar, DollarSign, Users as UsersIcon, Trash2,
  Award, Send, ArrowUp, ArrowDown, Shuffle, Save, Radio, CheckCircle2, Clock,
  Layers, ArrowRight,
} from "lucide-react";
import { computePhaseWinners, getPhaseFinishStatus } from "@/lib/phaseWinners";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TournamentData, MatchResult } from "@/lib/types";
import { formatLabel, computeGroupStandings } from "@/lib/tournamentBuilder";
import { getTeamFlag, isPlaceholder } from "@/lib/teamHelpers";

import { BracketView } from "./BracketView";
import { GroupTable } from "./GroupTable";
import { GroupAssignmentPanel } from "./GroupAssignmentPanel";
import { SwissView } from "./SwissView";
import { TournamentLineupPanel } from "./TournamentLineupPanel";

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
  onAddBracketMatches?: (
    phaseId: string,
    matches: { team1: string; team2: string; bo: 1 | 3 | 5; round: string }[],
  ) => void;
  onMoveBracketMatch: (phaseId: string, matchId: string, dir: -1 | 1) => void;
  onReseedPhase?: (phaseId: string, teams: string[]) => void;
  onAssignGroups?: (phaseId: string, assignment: Record<string, string[]>) => void;
  onShuffleGroups?: (phaseId: string) => void;
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

/** Inline editor for assigning real teams to a phase's seed list (resets first-round pairings on save). */
const PhaseSeedingPanel = ({
  phaseTeams, allTeams, slotCount, onSave,
}: {
  phaseTeams: string[];
  allTeams: string[];
  slotCount: number;
  onSave: (teams: string[]) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(() => {
    const base = [...phaseTeams];
    while (base.length < slotCount) base.push("");
    return base.slice(0, slotCount);
  });
  const [search, setSearch] = useState("");

  const move = (idx: number, dir: -1 | 1) => {
    setDraft(prev => {
      const next = [...prev];
      const tgt = idx + dir;
      if (tgt < 0 || tgt >= next.length) return prev;
      [next[idx], next[tgt]] = [next[tgt], next[idx]];
      return next;
    });
  };

  const setSlot = (idx: number, team: string) => {
    setDraft(prev => prev.map((v, i) => i === idx ? team : v));
  };

  const shuffleDraft = () => {
    setDraft(prev => {
      const a = [...prev];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    });
  };

  const filtered = allTeams.filter(x => x.toLowerCase().includes(search.toLowerCase()));

  if (!open) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-[11px] gap-1"
        onClick={() => setOpen(true)}
      >
        <UsersIcon className="w-3 h-3" /> Rozstaw drużyny ({phaseTeams.filter(x => x && !x.startsWith("TBD")).length}/{slotCount})
      </Button>
    );
  }

  return (
    <div className="bg-secondary/30 border border-primary/30 rounded-md p-3 mt-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase text-primary tracking-wider">
          Rozstawienie ({slotCount} slotów)
        </span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1" onClick={shuffleDraft}>
            <Shuffle className="w-3 h-3" /> Losuj
          </Button>
          <Button
            size="sm"
            className="h-7 text-[10px] gap-1"
            onClick={() => { onSave(draft); setOpen(false); }}
          >
            <Save className="w-3 h-3" /> Zapisz i zresetuj rundę 1
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setOpen(false)}>
            Anuluj
          </Button>
        </div>
      </div>

      <Input
        placeholder="Filtruj drużyny w listach poniżej..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="h-7 text-xs"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[260px] overflow-y-auto pr-1">
        {draft.map((team, i) => (
          <div key={i} className="flex items-center gap-1 bg-card border border-border rounded px-1.5 py-1">
            <span className="text-[10px] font-mono text-primary w-6 shrink-0">#{i + 1}</span>
            <select
              value={team}
              onChange={e => setSlot(i, e.target.value)}
              className="flex-1 min-w-0 px-1 py-0.5 rounded bg-secondary/50 border border-border text-[11px] font-mono"
            >
              <option value="">— TBD —</option>
              <option value="BYE">BYE</option>
              {filtered.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <button
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="text-muted-foreground hover:text-primary disabled:opacity-20"
              title="W górę"
            >
              <ArrowUp className="w-3 h-3" />
            </button>
            <button
              onClick={() => move(i, 1)}
              disabled={i === draft.length - 1}
              className="text-muted-foreground hover:text-primary disabled:opacity-20"
              title="W dół"
            >
              <ArrowDown className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <p className="text-[10px] font-mono text-muted-foreground">
        💡 Zapisanie nadpisze drużyny w meczach pierwszej rundy tej fazy i wyzeruje wyniki rundy 1.
      </p>
    </div>
  );
};

export const TournamentDetailPage = ({
  tournament: t, allTeams, onBack, onUpdateMatch, onDeleteBracketMatch,
  onAddBracketMatch, onAddBracketMatches, onMoveBracketMatch, onReseedPhase, onAssignGroups, onShuffleGroups,
  onSetStatus, onDelete, onOpenMatch,
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

  // Active phase tab — defaults to first phase, persists across re-renders for this tournament
  const [activePhaseId, setActivePhaseId] = useState<string>(() => t.phases[0]?.id || "");
  useEffect(() => {
    if (!t.phases.find(p => p.id === activePhaseId) && t.phases[0]) {
      setActivePhaseId(t.phases[0].id);
    }
  }, [t.phases, activePhaseId]);

  // Phase progress helper for tab badges
  const phaseProgress = (phase: typeof t.phases[number]) => {
    const bracketDone = phase.bracket?.filter(m => m.score1 + m.score2 > 0).length || 0;
    const bracketTotal = phase.bracket?.length || 0;
    const groupDone = phase.groups?.reduce((s, g) => s + g.matches.filter(m => m.score1 + m.score2 > 0).length, 0) || 0;
    const groupTotal = phase.groups?.reduce((s, g) => s + g.matches.length, 0) || 0;
    const done = bracketDone + groupDone;
    const total = bracketTotal + groupTotal;
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  };

  return (
    <section className="py-6">
      <div className="container mx-auto px-4 max-w-[1400px]">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Powrót do listy
        </Button>

        {/* Hero header — Liquipedia-style banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-gradient-to-br from-primary/10 via-card to-card border border-border rounded-xl overflow-hidden mb-6"
        >
          {/* Tier accent bar */}
          <div className={cn(
            "h-1.5 w-full",
            t.tier === "S" ? "bg-gradient-to-r from-[hsl(var(--gold))] via-[hsl(var(--accent))] to-[hsl(var(--gold))]" :
            t.tier === "A" ? "bg-gradient-to-r from-primary via-[hsl(190_100%_45%)] to-primary" :
            t.tier === "B" ? "bg-gradient-to-r from-[hsl(var(--silver))] via-muted to-[hsl(var(--silver))]" :
            "bg-gradient-to-r from-muted to-secondary"
          )} />

          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={cn("text-xs font-mono font-bold px-2.5 py-1 rounded border", tierColor(t.tier))}>
                {t.tier}-TIER
              </span>
              <span className={cn(
                "text-xs px-2.5 py-1 rounded border font-mono inline-flex items-center gap-1.5",
                statusBadge(t.status)
              )}>
                {t.status === "live" && <Radio className="w-3 h-3 animate-pulse" />}
                {t.status === "completed" && <CheckCircle2 className="w-3 h-3" />}
                {t.status === "upcoming" && <Clock className="w-3 h-3" />}
                {statusLabel(t.status)}
              </span>
              <span className="text-xs px-2.5 py-1 rounded border border-border bg-secondary/50 font-mono text-muted-foreground">
                {t.phases.length} {t.phases.length === 1 ? "faza" : "faz"} • {totalMatches} {totalMatches === 1 ? "mecz" : "meczów"}
              </span>
            </div>

            <div className="flex items-start gap-4 mb-2">
              <div className="hidden sm:flex w-14 h-14 rounded-lg bg-primary/15 border border-primary/30 items-center justify-center shrink-0">
                <Trophy className="w-7 h-7 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-4xl font-heading font-bold text-foreground leading-tight">{t.name}</h1>
                {t.organizer && (
                  <p className="text-sm text-muted-foreground mt-1">
                    organizowany przez <span className="text-foreground font-medium">{t.organizer}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-5 border-t border-border/50">
              <div className="bg-card/40 border border-border/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  <Calendar className="w-3 h-3" /> Daty
                </div>
                <p className="text-sm font-mono text-foreground leading-tight">
                  {t.startDate || "—"}<br/>
                  <span className="text-muted-foreground">→</span> {t.endDate || "—"}
                </p>
              </div>
              <div className="bg-card/40 border border-border/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  <MapPin className="w-3 h-3" /> Lokalizacja
                </div>
                <p className="text-sm font-mono text-foreground">{t.location || "—"}</p>
              </div>
              <div className="bg-[hsl(var(--gold))]/5 border border-[hsl(var(--gold))]/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[hsl(var(--gold))]/80 mb-1">
                  <DollarSign className="w-3 h-3" /> Pula nagród
                </div>
                <p className="text-base font-heading font-bold text-[hsl(var(--gold))]">{t.prizePool}</p>
              </div>
              <div className="bg-card/40 border border-border/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  <UsersIcon className="w-3 h-3" /> Drużyny
                </div>
                <p className="text-base font-heading font-bold text-foreground">{t.teams}</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Format</div>
              <p className="text-sm font-mono text-foreground">{t.format}</p>
            </div>
          </div>
        </motion.div>

        {/* Participants — with flags */}
        {t.participants.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider mb-3 flex items-center gap-2">
              <UsersIcon className="w-3.5 h-3.5" />
              Uczestnicy ({t.participants.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {t.participants.map((p, i) => {
                const flag = !isPlaceholder(p) ? getTeamFlag(p) : "";
                return (
                  <span
                    key={p}
                    className="text-xs font-mono px-2 py-1 rounded border border-border bg-secondary/40 text-foreground flex items-center gap-1.5 hover:border-primary/40 transition-colors"
                  >
                    <span className="text-muted-foreground">#{i + 1}</span>
                    {flag && <span>{flag}</span>}
                    {p}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Lineup picker — substitutions per tournament */}
        <TournamentLineupPanel tournamentId={t.id} participants={t.participants} />

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

        {/* Phases — tabbed: each phase gets its own dedicated panel */}
        {t.phases.length > 0 && (
          <div className="space-y-4">
            {/* Phase tab navigation */}
            <div className="bg-card border border-border rounded-lg p-2">
              <div className="flex items-center gap-1.5 mb-2 px-2 pt-1">
                <Layers className="w-3.5 h-3.5 text-primary" />
                <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider">
                  Fazy turnieju ({t.phases.length})
                </h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {t.phases.map((phase, idx) => {
                  const { done, total, pct } = phaseProgress(phase);
                  const isActive = phase.id === activePhaseId;
                  const isDone = total > 0 && done === total;
                  return (
                    <button
                      key={phase.id}
                      onClick={() => setActivePhaseId(phase.id)}
                      className={cn(
                        "group relative flex-1 min-w-[180px] text-left px-3 py-2.5 rounded-md border transition-all",
                        isActive
                          ? "bg-primary/10 border-primary text-foreground shadow-sm"
                          : "bg-secondary/30 border-border hover:border-primary/40 hover:bg-secondary/50 text-muted-foreground"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={cn(
                          "text-[10px] font-mono tracking-wider",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}>
                          FAZA {idx + 1}
                        </span>
                        {isDone && <CheckCircle2 className="w-3 h-3 text-[hsl(var(--win))]" />}
                      </div>
                      <div className={cn(
                        "text-sm font-heading font-bold leading-tight mb-1.5 truncate",
                        isActive ? "text-foreground" : "text-foreground/80"
                      )}>
                        {phase.name}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground truncate">
                          {formatLabel(phase.format)} • BO{phase.bo}
                        </span>
                        {total > 0 && (
                          <span className={cn(
                            "text-[10px] font-mono tabular-nums shrink-0",
                            isDone ? "text-[hsl(var(--win))]" : isActive ? "text-primary" : "text-muted-foreground"
                          )}>
                            {done}/{total}
                          </span>
                        )}
                      </div>
                      {/* Progress bar */}
                      {total > 0 && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-border/50 rounded-b-md overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all",
                              isDone ? "bg-[hsl(var(--win))]" : "bg-primary"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active phase panel — full width, breathing room */}
            {t.phases.map((phase, idx) => {
              if (phase.id !== activePhaseId) return null;
              return (
                <motion.div
                  key={phase.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-card border border-border rounded-lg overflow-hidden"
                >
                  <div className="bg-gradient-to-r from-primary/10 via-secondary/40 to-secondary/40 px-5 py-4 flex items-center justify-between border-b border-border/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                        <span className="text-sm font-heading font-bold text-primary">{idx + 1}</span>
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-lg font-heading font-bold text-foreground leading-tight truncate">{phase.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                            {formatLabel(phase.format)}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">BO{phase.bo}</span>
                          {phase.advanceCount ? (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              • Awansuje: <span className="text-foreground">{phase.advanceCount}</span>
                            </span>
                          ) : null}
                          {phase.teams.length > 0 && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              • {phase.teams.filter(x => x && !x.startsWith("TBD")).length}/{phase.teams.length} drużyn
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-5 sm:p-6 space-y-5">
                    {/* Promote winners → next phase */}
                    {(() => {
                      const nextPhase = t.phases[idx + 1];
                      if (!nextPhase || !onReseedPhase) return null;
                      const status = getPhaseFinishStatus(phase);
                      const winners = computePhaseWinners(phase);
                      const expected = nextPhase.teams.length || winners.length;
                      const alreadySeeded = nextPhase.teams.filter(x => x && !x.startsWith("TBD")).length;
                      const allSeeded = alreadySeeded >= expected && expected > 0
                        && winners.every(w => nextPhase.teams.includes(w));
                      if (allSeeded) return null;
                      return (
                        <div className={cn(
                          "flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-md border",
                          status.finished
                            ? "bg-[hsl(var(--win))]/10 border-[hsl(var(--win))]/40"
                            : "bg-secondary/40 border-border"
                        )}>
                          <div className="flex items-center gap-2 min-w-0">
                            <ArrowRight className={cn(
                              "w-4 h-4 shrink-0",
                              status.finished ? "text-[hsl(var(--win))]" : "text-muted-foreground"
                            )} />
                            <div className="min-w-0">
                              <div className="text-xs font-heading font-bold">
                                {status.finished
                                  ? `Faza zakończona — gotowe do awansu (${winners.length} drużyn)`
                                  : `Awansuje do: ${nextPhase.name}`}
                              </div>
                              <div className="text-[10px] font-mono text-muted-foreground truncate">
                                {winners.length > 0
                                  ? winners.join(" • ")
                                  : "Brak rozstrzygniętych zwycięzców."}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            disabled={winners.length === 0}
                            onClick={() => {
                              const padded = [...winners];
                              while (padded.length < expected) padded.push(`TBD-P${idx + 1}-${padded.length + 1}`);
                              onReseedPhase(nextPhase.id, padded);
                              setActivePhaseId(nextPhase.id);
                            }}
                            className="gap-1.5 h-8"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Awansuj do {nextPhase.name}
                          </Button>
                        </div>
                      );
                    })()}

                    {/* Seeding panel */}
                    {onReseedPhase && phase.bracket && phase.bracket.length > 0 && (
                      <PhaseSeedingPanel
                        phaseTeams={phase.teams}
                        allTeams={Array.from(new Set([...t.participants, ...allTeams])).sort()}
                        slotCount={Math.max(
                          phase.teams.length,
                          (phase.bracket.filter(m => m.round === phase.bracket![0].round).length) * 2
                        )}
                        onSave={(teams) => onReseedPhase(phase.id, teams.filter(Boolean))}
                      />
                    )}
                    {phase.groups && phase.groups.length > 0 && onAssignGroups && onShuffleGroups && (
                      <GroupAssignmentPanel
                        phase={phase}
                        availableTeams={Array.from(new Set(t.participants)).sort()}
                        onSave={(assignment) => onAssignGroups(phase.id, assignment)}
                        onShuffle={() => onShuffleGroups(phase.id)}
                      />
                    )}
                    {phase.groups && phase.groups.length > 0 && (() => {
                      const perGroup = phase.advanceCount && phase.groups.length > 0
                        ? Math.max(1, Math.ceil(phase.advanceCount / phase.groups.length))
                        : (phase.format === "gsl-de-groups" || phase.format === "gsl-groups" ? 2 : 2);
                      return (
                        <div className="grid md:grid-cols-2 gap-4">
                          {phase.groups.map(g => (
                            <GroupTable
                              format={phase.format}
                              advancePerGroup={perGroup}
                              key={g.id}
                              group={g}
                              onMatchUpdate={(mid, s1, s2) =>
                                onUpdateMatch(phase.id, mid, { score1: s1, score2: s2 }, g.id)
                              }
                              onOpenMatch={(mid) => onOpenMatch(phase.id, mid, g.id)}
                            />
                          ))}
                        </div>
                      );
                    })()}
                    {phase.bracket && phase.bracket.length > 0 && phase.format === "swiss" && (
                      <SwissView
                        phaseTeams={phase.teams}
                        matches={phase.bracket}
                        bo={phase.bo}
                        advanceCount={phase.advanceCount}
                        onUpdate={(mid, s1, s2, t1, t2) =>
                          onUpdateMatch(phase.id, mid, {
                            score1: s1, score2: s2,
                            ...(t1 !== undefined && { team1: t1 }),
                            ...(t2 !== undefined && { team2: t2 }),
                          })
                        }
                        onDelete={(mid) => onDeleteBracketMatch(phase.id, mid)}
                        onOpenMatch={(mid) => onOpenMatch(phase.id, mid)}
                        onGenerateNextRound={(pairings) => {
                          if (onAddBracketMatches) {
                            onAddBracketMatches(phase.id, pairings);
                          } else {
                            pairings.forEach(p => onAddBracketMatch(phase.id, p.round));
                          }
                        }}
                      />
                    )}
                    {phase.bracket && phase.bracket.length > 0 && phase.format !== "swiss" && (
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
                      <div className="text-center py-8">
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
              );
            })}
          </div>
        )}

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
