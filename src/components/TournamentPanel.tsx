import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Trophy, Plus, Trash2, ChevronRight,
  Calendar, MapPin, DollarSign, Users as UsersIcon,
  Layers, GitBranch, Grid3x3, Shuffle, ArrowUp, ArrowDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { TournamentData, TournamentPhase, PhaseFormat, MatchResult, QualifierConfig } from "@/lib/types";
import { saveToStorage, loadFromStorage } from "@/lib/storage";
import { teamDatabase } from "@/data/tournaments";
import { buildPhase, formatLabel, shuffle, propagateGSLDEGroup } from "@/lib/tournamentBuilder";
import { TournamentDetailPage } from "./tournament/TournamentDetailPage";
import { MatchDetailPage } from "./tournament/MatchDetailPage";

interface SelectedMatchRef {
  phaseId: string;
  matchId: string;
  groupId?: string;
}

const STORAGE_KEY = "tournaments_data";

const PHASE_FORMATS: { value: PhaseFormat; label: string; icon: typeof GitBranch }[] = [
  { value: "single-elim", label: "Single Elimination", icon: GitBranch },
  { value: "double-elim", label: "Double Elimination", icon: GitBranch },
  { value: "swiss", label: "Swiss System", icon: Layers },
  { value: "round-robin", label: "Round Robin (Groups)", icon: Grid3x3 },
  { value: "gsl-groups", label: "GSL Groups (4 teams)", icon: Grid3x3 },
  { value: "gsl-de-groups", label: "IEM-style Groups (8 teams, DE)", icon: Grid3x3 },
  { value: "showmatch", label: "Showmatch", icon: Trophy },
];

const REGIONS: { code: string; label: string }[] = [
  { code: "EU", label: "Europa" },
  { code: "US", label: "Ameryka Płn" },
  { code: "LATAM", label: "Ameryka Płd" },
  { code: "ASIA", label: "Azja" },
  { code: "OCE", label: "Oceania" },
  { code: "AFR", label: "Afryka" },
];

interface PhaseDraft {
  name: string;
  format: PhaseFormat;
  bo: 1 | 3 | 5;
  groupCount: number;
  advanceCount: number;
  /** How many teams are pre-seeded into this phase (rest are TBD).
   *  0 means: use the previous phase's advanceCount (or all participants for phase 1). */
  seededCount: number;
}

const TournamentPanel = () => {
  const [tournaments, setTournaments] = useState<TournamentData[]>(() =>
    loadFromStorage<TournamentData[]>(STORAGE_KEY, [])
  );
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMatchRef, setSelectedMatchRef] = useState<SelectedMatchRef | null>(null);

  // Tournament meta
  const [newName, setNewName] = useState("");
  const [newOrg, setNewOrg] = useState("");
  const [newPrize, setNewPrize] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newTier, setNewTier] = useState<"S" | "A" | "B" | "C">("A");

  // Participants
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [teamSearch, setTeamSearch] = useState("");

  // Phases (custom builder)
  const [phaseDrafts, setPhaseDrafts] = useState<PhaseDraft[]>([
    { name: "Playoffs", format: "single-elim", bo: 3, groupCount: 1, advanceCount: 0 },
  ]);

  // Qualifier config
  const [isQualifier, setIsQualifier] = useState(false);
  const [qualScope, setQualScope] = useState<"global" | "regional">("regional");
  const [qualRegions, setQualRegions] = useState<string[]>(["EU"]);
  const [qualSlots, setQualSlots] = useState<Record<string, number>>({ EU: 2, GLOBAL: 2 });
  const [qualLinkedTo, setQualLinkedTo] = useState<string>("");

  useEffect(() => { saveToStorage(STORAGE_KEY, tournaments); }, [tournaments]);

  const allTeams = useMemo(() => teamDatabase.map(t => t.name).sort(), []);
  const filteredTeams = useMemo(
    () => allTeams.filter(t => t.toLowerCase().includes(teamSearch.toLowerCase())),
    [allTeams, teamSearch]
  );

  const resetForm = () => {
    setNewName(""); setNewOrg(""); setNewPrize(""); setNewStart(""); setNewEnd("");
    setNewLocation(""); setNewTier("A");
    setSelectedTeams([]); setTeamSearch("");
    setPhaseDrafts([{ name: "Playoffs", format: "single-elim", bo: 3, groupCount: 1, advanceCount: 0 }]);
    setIsQualifier(false);
    setQualScope("regional");
    setQualRegions(["EU"]);
    setQualSlots({ EU: 2, GLOBAL: 2 });
    setQualLinkedTo("");
  };

  const toggleQualRegion = (code: string) => {
    setQualRegions(prev => {
      const next = prev.includes(code) ? prev.filter(r => r !== code) : [...prev, code];
      setQualSlots(s => ({ ...s, [code]: s[code] ?? 2 }));
      return next;
    });
  };

  const toggleTeam = (name: string) => {
    setSelectedTeams(prev =>
      prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
    );
  };

  const seedRandom = () => setSelectedTeams(prev => shuffle(prev));

  const moveSeed = (idx: number, dir: -1 | 1) => {
    setSelectedTeams(prev => {
      const next = [...prev];
      const tgt = idx + dir;
      if (tgt < 0 || tgt >= next.length) return prev;
      [next[idx], next[tgt]] = [next[tgt], next[idx]];
      return next;
    });
  };

  const addPhaseDraft = () => {
    setPhaseDrafts(prev => [
      ...prev,
      { name: `Phase ${prev.length + 1}`, format: "single-elim", bo: 3, groupCount: 2, advanceCount: 4 },
    ]);
  };

  const updatePhaseDraft = (idx: number, patch: Partial<PhaseDraft>) => {
    setPhaseDrafts(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
  };

  const removePhaseDraft = (idx: number) => {
    setPhaseDrafts(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreate = () => {
    if (!newName.trim() || selectedTeams.length < 2 || phaseDrafts.length === 0) return;

    // Build phases sequentially: first phase gets all selected teams,
    // subsequent phases get `advanceCount` placeholder slots
    const phases: TournamentPhase[] = [];
    let teamsForPhase = [...selectedTeams];
    phaseDrafts.forEach((draft, idx) => {
      const phase = buildPhase(draft.name, draft.format, teamsForPhase, {
        bo: draft.bo,
        groupCount: draft.groupCount,
        advanceCount: draft.advanceCount,
      });
      phases.push(phase);
      // Next phase gets placeholder TBD teams equal to advanceCount
      if (idx < phaseDrafts.length - 1) {
        const nextCount = draft.advanceCount || teamsForPhase.length;
        teamsForPhase = Array.from({ length: nextCount }, (_, i) => `TBD-${idx}-${i + 1}`);
      }
    });

    let qualifierConfig: QualifierConfig | undefined;
    if (isQualifier) {
      const regs = qualScope === "global" ? ["GLOBAL"] : qualRegions;
      const slots: Record<string, number> = {};
      regs.forEach(r => { slots[r] = Math.max(1, qualSlots[r] ?? 1); });
      qualifierConfig = {
        scope: qualScope,
        regions: regs,
        slotsPerRegion: slots,
        linkedTournamentId: qualLinkedTo || undefined,
        promotedTeams: [],
      };
    }

    const t: TournamentData = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: newName.trim(),
      organizer: newOrg.trim(),
      prizePool: newPrize.trim() || "$0",
      startDate: newStart,
      endDate: newEnd,
      location: newLocation.trim(),
      tier: newTier,
      teams: selectedTeams.length,
      format: phaseDrafts.map(p => formatLabel(p.format)).join(" → "),
      status: "upcoming",
      participants: selectedTeams,
      phases,
      placements: [],
      kind: isQualifier ? "qualifier" : "main",
      qualifierConfig,
    };
    setTournaments(prev => [t, ...prev]);
    resetForm();
    setShowCreate(false);
  };

  /** Propagate winner/loser of a bracket match into linked next matches (winnerTo / loserTo). */
  const propagateBracket = (bracket: MatchResult[], sourceId: string): MatchResult[] => {
    const src = bracket.find(m => m.id === sourceId);
    if (!src) return bracket;
    const total = (src.score1 || 0) + (src.score2 || 0);
    const decided = total > 0 && src.score1 !== src.score2 && !!src.team1 && !!src.team2;
    const winner = decided ? (src.score1 > src.score2 ? src.team1 : src.team2) : "";
    const loser = decided ? (src.score1 > src.score2 ? src.team2 : src.team1) : "";

    const placeInto = (target: MatchResult, team: string): MatchResult => {
      // Choose the first empty / TBD slot; if both filled and neither matches, prefer slot1
      const slot1Empty = !target.team1 || target.team1.startsWith("TBD") || target.team1 === "BYE";
      const slot2Empty = !target.team2 || target.team2.startsWith("TBD") || target.team2 === "BYE";
      if (slot1Empty && target.team2 !== team) return { ...target, team1: team };
      if (slot2Empty && target.team1 !== team) return { ...target, team2: team };
      return target;
    };

    return bracket.map(m => {
      if (m.id === src.winnerTo && winner) return placeInto(m, winner);
      if (m.id === src.loserTo && loser) return placeInto(m, loser);
      return m;
    });
  };

  const updatePhaseMatch = (
    tournamentId: string,
    phaseId: string,
    matchId: string,
    patch: Partial<MatchResult>,
    groupId?: string,
  ) => {
    setTournaments(prev => prev.map(t => {
      if (t.id !== tournamentId) return t;
      return {
        ...t,
        phases: t.phases.map(p => {
          if (p.id !== phaseId) return p;
          if (groupId && p.groups) {
            return {
              ...p,
              groups: p.groups.map(g => {
                if (g.id !== groupId) return g;
                let nextMatches = g.matches.map(m => m.id !== matchId ? m : { ...m, ...patch });
                // Auto-propagate winners/losers within IEM-DE groups
                if (p.format === "gsl-de-groups") {
                  nextMatches = propagateGSLDEGroup([...nextMatches]);
                }
                return { ...g, matches: nextMatches };
              }),
            };
          }
          if (p.bracket) {
            const updated = p.bracket.map(m => m.id !== matchId ? m : { ...m, ...patch });
            return { ...p, bracket: propagateBracket(updated, matchId) };
          }
          return p;
        }),
      };
    }));
  };

  /** Manually assign a team to a TBD slot in any phase's first round (or any match) */
  const assignSeed = (
    tournamentId: string,
    phaseId: string,
    matchId: string,
    slot: "team1" | "team2",
    team: string,
    groupId?: string,
  ) => {
    updatePhaseMatch(tournamentId, phaseId, matchId, { [slot]: team } as Partial<MatchResult>, groupId);
  };

  /** Reseed an entire phase from a list of teams (rebuilds first-round pairings only for bracket; replaces team list for groups). */
  const reseedPhase = (tournamentId: string, phaseId: string, teams: string[]) => {
    setTournaments(prev => prev.map(t => {
      if (t.id !== tournamentId) return t;
      return {
        ...t,
        phases: t.phases.map(p => {
          if (p.id !== phaseId) return p;
          // Bracket: assign teams to first-round matches in pairs
          if (p.bracket && p.bracket.length > 0) {
            // Identify first round (preserve insertion order)
            const firstRound = p.bracket[0].round;
            const firstRoundIds = p.bracket.filter(m => m.round === firstRound).map(m => m.id);
            const newBracket = p.bracket.map(m => {
              const idx = firstRoundIds.indexOf(m.id);
              if (idx === -1) return m;
              const t1 = teams[idx * 2] ?? "";
              const t2 = teams[idx * 2 + 1] ?? "";
              return { ...m, team1: t1, team2: t2, score1: 0, score2: 0 };
            });
            return { ...p, teams: [...teams], bracket: newBracket };
          }
          return { ...p, teams: [...teams] };
        }),
      };
    }));
  };

  const deleteBracketMatch = (tournamentId: string, phaseId: string, matchId: string) => {
    setTournaments(prev => prev.map(t => {
      if (t.id !== tournamentId) return t;
      return {
        ...t,
        phases: t.phases.map(p => p.id !== phaseId ? p : {
          ...p,
          bracket: p.bracket?.filter(m => m.id !== matchId),
        }),
      };
    }));
  };

  const addBracketMatch = (tournamentId: string, phaseId: string, round: string) => {
    const newMatch: MatchResult = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      team1: "",
      team2: "",
      score1: 0,
      score2: 0,
      round,
      bo: 3,
    };
    setTournaments(prev => prev.map(t => {
      if (t.id !== tournamentId) return t;
      return {
        ...t,
        phases: t.phases.map(p => {
          if (p.id !== phaseId) return p;
          newMatch.bo = p.bo;
          return { ...p, bracket: [...(p.bracket || []), newMatch] };
        }),
      };
    }));
  };

  const moveBracketMatch = (tournamentId: string, phaseId: string, matchId: string, dir: -1 | 1) => {
    setTournaments(prev => prev.map(t => {
      if (t.id !== tournamentId) return t;
      return {
        ...t,
        phases: t.phases.map(p => {
          if (p.id !== phaseId || !p.bracket) return p;
          const idx = p.bracket.findIndex(m => m.id === matchId);
          const tgt = idx + dir;
          if (idx === -1 || tgt < 0 || tgt >= p.bracket.length) return p;
          const next = [...p.bracket];
          [next[idx], next[tgt]] = [next[tgt], next[idx]];
          return { ...p, bracket: next };
        }),
      };
    }));
  };

  const handleSetStatus = (id: string, status: "upcoming" | "live" | "completed") => {
    setTournaments(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  };

  const handleDelete = (id: string) => {
    setTournaments(prev => prev.filter(t => t.id !== id));
  };

  const handlePromoteWinners = (qualifierId: string, winners: string[], targetId: string) => {
    setTournaments(prev => prev.map(t => {
      if (t.id === qualifierId && t.qualifierConfig) {
        return {
          ...t,
          qualifierConfig: {
            ...t.qualifierConfig,
            linkedTournamentId: targetId,
            promotedTeams: Array.from(new Set([...(t.qualifierConfig.promotedTeams || []), ...winners])),
          },
        };
      }
      if (t.id === targetId) {
        const newParticipants = [...t.participants];
        winners.forEach(w => { if (!newParticipants.includes(w)) newParticipants.push(w); });
        return { ...t, participants: newParticipants, teams: newParticipants.length };
      }
      return t;
    }));
  };

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

  const statusLabel = (s: string) => s === "live" ? "W trakcie" : s === "completed" ? "Zakończony" : "Nadchodzący";

  const selectedTournament = selectedId ? tournaments.find(t => t.id === selectedId) ?? null : null;

  // Find the currently-selected match (for MatchDetailPage)
  const selectedMatchInfo = useMemo(() => {
    if (!selectedTournament || !selectedMatchRef) return null;
    const phase = selectedTournament.phases.find(p => p.id === selectedMatchRef.phaseId);
    if (!phase) return null;
    let match: MatchResult | undefined;
    if (selectedMatchRef.groupId && phase.groups) {
      const g = phase.groups.find(g => g.id === selectedMatchRef.groupId);
      match = g?.matches.find(m => m.id === selectedMatchRef.matchId);
    } else if (phase.bracket) {
      match = phase.bracket.find(m => m.id === selectedMatchRef.matchId);
    }
    if (!match) return null;
    return { match, phaseName: phase.name, bo: (match.bo || phase.bo) as 1 | 3 | 5 };
  }, [selectedTournament, selectedMatchRef]);

  return (
    <>
    {selectedTournament && selectedMatchInfo ? (
      <MatchDetailPage
        match={selectedMatchInfo.match}
        phaseName={selectedMatchInfo.phaseName}
        bo={selectedMatchInfo.bo}
        onBack={() => setSelectedMatchRef(null)}
        onUpdate={(patch) => updatePhaseMatch(
          selectedTournament.id,
          selectedMatchRef!.phaseId,
          selectedMatchRef!.matchId,
          patch,
          selectedMatchRef!.groupId,
        )}
      />
    ) : selectedTournament ? (
      <TournamentDetailPage
        tournament={selectedTournament}
        allTeams={allTeams}
        onBack={() => { setSelectedId(null); setSelectedMatchRef(null); }}
        onUpdateMatch={(phaseId, matchId, patch, groupId) =>
          updatePhaseMatch(selectedTournament.id, phaseId, matchId, patch, groupId)
        }
        onDeleteBracketMatch={(phaseId, matchId) =>
          deleteBracketMatch(selectedTournament.id, phaseId, matchId)
        }
        onAddBracketMatch={(phaseId, round) =>
          addBracketMatch(selectedTournament.id, phaseId, round)
        }
        onMoveBracketMatch={(phaseId, matchId, dir) =>
          moveBracketMatch(selectedTournament.id, phaseId, matchId, dir)
        }
        onReseedPhase={(phaseId, teams) =>
          reseedPhase(selectedTournament.id, phaseId, teams)
        }
        onSetStatus={(s) => handleSetStatus(selectedTournament.id, s)}
        onDelete={() => handleDelete(selectedTournament.id)}
        onOpenMatch={(phaseId, matchId, groupId) => setSelectedMatchRef({ phaseId, matchId, groupId })}
        mainTournaments={tournaments.filter(x => x.kind !== "qualifier" && x.id !== selectedTournament.id)}
        onPromoteWinners={(winners, targetId) => handlePromoteWinners(selectedTournament.id, winners, targetId)}
      />
    ) : (
    <section className="py-6">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-heading font-bold text-foreground">Turnieje</h2>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Nowy turniej
          </Button>
        </div>

        {/* Tournament list */}
        {tournaments.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-mono text-sm">Brak turniejów. Utwórz pierwszy!</p>
          </div>
        )}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tournaments.map(t => {
            const totalMatches = t.phases.reduce((sum, p) =>
              sum + (p.bracket?.length || 0) + (p.groups?.reduce((s, g) => s + g.matches.length, 0) || 0), 0
            );
            return (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedId(t.id)}
                className="group bg-card border border-border rounded-lg p-4 text-left hover:border-primary/50 hover:bg-secondary/20 transition-all"
              >
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0", tierColor(t.tier))}>
                      {t.tier}
                    </span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-mono shrink-0", statusBadge(t.status))}>
                      {statusLabel(t.status)}
                    </span>
                    {t.kind === "qualifier" && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-[hsl(var(--gold))]/40 bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))] font-mono font-bold shrink-0">
                        QUAL {t.qualifierConfig?.scope === "global" ? "GLOBAL" : (t.qualifierConfig?.regions || []).join("+")}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </div>
                <h3 className="font-heading font-bold text-foreground text-base mb-1 truncate">{t.name}</h3>
                {t.organizer && (
                  <p className="text-xs text-muted-foreground mb-3 truncate">{t.organizer}</p>
                )}
                <div className="space-y-1 text-[11px] font-mono text-muted-foreground border-t border-border/40 pt-2">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" /> {t.startDate || "—"} → {t.endDate || "—"}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" /> {t.location || "—"}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-3 h-3 text-primary" />
                    <span className="text-primary">{t.prizePool}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <UsersIcon className="w-3 h-3" /> {t.teams} drużyn • {t.phases.length} faz • {totalMatches} mecz(ów)
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* CREATE DIALOG */}
        <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) resetForm(); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading">Kreator turnieju</DialogTitle>
            </DialogHeader>

            <div className="space-y-5 pt-2">
              {/* Meta */}
              <section className="space-y-3">
                <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider">1. Podstawowe info</h3>
                <Input placeholder="Nazwa turnieju..." value={newName} onChange={e => setNewName(e.target.value)} />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Organizator..." value={newOrg} onChange={e => setNewOrg(e.target.value)} />
                  <Input placeholder="Pula nagród (np. $500,000)..." value={newPrize} onChange={e => setNewPrize(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="date" value={newStart} onChange={e => setNewStart(e.target.value)} />
                  <Input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Lokalizacja..." value={newLocation} onChange={e => setNewLocation(e.target.value)} />
                  <select
                    value={newTier}
                    onChange={e => setNewTier(e.target.value as "S" | "A" | "B" | "C")}
                    className="px-3 py-2 rounded-md bg-card border border-border text-foreground text-sm font-mono"
                  >
                    <option value="S">Tier S</option>
                    <option value="A">Tier A</option>
                    <option value="B">Tier B</option>
                    <option value="C">Tier C</option>
                  </select>
                </div>
              </section>

              {/* Participants */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider">
                    2. Uczestnicy ({selectedTeams.length})
                  </h3>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={seedRandom} disabled={selectedTeams.length < 2}>
                    <Shuffle className="w-3 h-3" /> Losuj rozstawienie
                  </Button>
                </div>
                {selectedTeams.length > 0 && (
                  <div className="bg-secondary/30 border border-border rounded-md p-2">
                    <p className="text-[10px] font-mono text-muted-foreground mb-1.5">
                      Rozstawienie (kolejność = seed). Użyj ↑↓ aby przesunąć, ✕ aby usunąć:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {selectedTeams.map((t, i) => (
                        <div
                          key={t}
                          className="flex items-center gap-1 bg-card border border-border rounded px-2 py-1"
                        >
                          <span className="text-[10px] font-mono text-primary w-6 shrink-0">#{i + 1}</span>
                          <span className="text-[11px] font-mono flex-1 truncate text-foreground">{t}</span>
                          <button
                            onClick={() => moveSeed(i, -1)}
                            disabled={i === 0}
                            className="text-muted-foreground hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed"
                            title="W górę"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => moveSeed(i, 1)}
                            disabled={i === selectedTeams.length - 1}
                            className="text-muted-foreground hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed"
                            title="W dół"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => toggleTeam(t)}
                            className="text-muted-foreground hover:text-destructive"
                            title="Usuń"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <Input
                  placeholder="Szukaj drużyny..."
                  value={teamSearch}
                  onChange={e => setTeamSearch(e.target.value)}
                />
                <div className="max-h-40 overflow-y-auto border border-border rounded-md p-2 grid grid-cols-2 sm:grid-cols-3 gap-1">
                  {filteredTeams.slice(0, 60).map(name => {
                    const checked = selectedTeams.includes(name);
                    return (
                      <button
                        key={name}
                        onClick={() => toggleTeam(name)}
                        className={cn(
                          "text-[11px] text-left px-2 py-1 rounded font-mono truncate transition-colors",
                          checked
                            ? "bg-primary/20 text-primary border border-primary/40"
                            : "bg-secondary/30 text-muted-foreground hover:bg-secondary/60 border border-transparent"
                        )}
                      >
                        {checked ? "✓ " : "+ "}{name}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Qualifier toggle & config */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider">
                    3. Typ wydarzenia
                  </h3>
                  <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isQualifier}
                      onChange={e => setIsQualifier(e.target.checked)}
                      className="accent-primary"
                    />
                    To jest kwalifikacja
                  </label>
                </div>
                {isQualifier && (
                  <div className="bg-secondary/30 border border-border rounded-md p-3 space-y-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setQualScope("global")}
                        className={cn(
                          "flex-1 px-3 py-2 rounded text-xs font-mono border transition-colors",
                          qualScope === "global"
                            ? "bg-primary/15 text-primary border-primary/40"
                            : "bg-card text-muted-foreground border-border hover:text-foreground"
                        )}
                      >
                        🌍 Globalna (wszyscy razem)
                      </button>
                      <button
                        onClick={() => setQualScope("regional")}
                        className={cn(
                          "flex-1 px-3 py-2 rounded text-xs font-mono border transition-colors",
                          qualScope === "regional"
                            ? "bg-primary/15 text-primary border-primary/40"
                            : "bg-card text-muted-foreground border-border hover:text-foreground"
                        )}
                      >
                        📍 Regionalna (osobne sloty)
                      </button>
                    </div>

                    {qualScope === "regional" ? (
                      <div className="space-y-2">
                        <p className="text-[10px] font-mono text-muted-foreground">
                          Wybierz regiony i liczbę slotów awansu z każdego:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {REGIONS.map(r => {
                            const active = qualRegions.includes(r.code);
                            return (
                              <div key={r.code} className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded border",
                                active ? "bg-primary/10 border-primary/30" : "bg-card border-border"
                              )}>
                                <label className="flex items-center gap-2 flex-1 cursor-pointer text-xs font-mono">
                                  <input
                                    type="checkbox"
                                    checked={active}
                                    onChange={() => toggleQualRegion(r.code)}
                                    className="accent-primary"
                                  />
                                  <span className={active ? "text-foreground" : "text-muted-foreground"}>
                                    {r.label} <span className="text-[10px] opacity-60">({r.code})</span>
                                  </span>
                                </label>
                                {active && (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      min="1"
                                      value={qualSlots[r.code] ?? 1}
                                      onChange={e => setQualSlots(s => ({ ...s, [r.code]: parseInt(e.target.value) || 1 }))}
                                      className="w-14 h-7 text-center text-xs"
                                    />
                                    <span className="text-[10px] font-mono text-muted-foreground">slot</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-mono text-muted-foreground">Liczba slotów awansu:</label>
                        <Input
                          type="number"
                          min="1"
                          value={qualSlots.GLOBAL ?? 2}
                          onChange={e => setQualSlots(s => ({ ...s, GLOBAL: parseInt(e.target.value) || 1 }))}
                          className="w-20 h-7 text-center text-xs"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block mb-1">
                        Powiązany turniej główny (opcjonalnie)
                      </label>
                      <select
                        value={qualLinkedTo}
                        onChange={e => setQualLinkedTo(e.target.value)}
                        className="w-full px-2 py-1.5 rounded bg-card border border-border text-xs font-mono"
                      >
                        <option value="">— brak (wybierzesz później) —</option>
                        {tournaments.filter(x => x.kind !== "qualifier").map(x => (
                          <option key={x.id} value={x.id}>{x.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </section>

              {/* Phases */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider">
                    4. Fazy turnieju ({phaseDrafts.length})
                  </h3>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addPhaseDraft}>
                    <Plus className="w-3 h-3" /> Dodaj fazę
                  </Button>
                </div>
                <div className="space-y-2">
                  {phaseDrafts.map((draft, idx) => {
                    const showGroups = draft.format === "round-robin" || draft.format === "gsl-groups" || draft.format === "gsl-de-groups";
                    const showAdvance = idx < phaseDrafts.length - 1;
                    return (
                      <div key={idx} className="bg-secondary/30 border border-border rounded-md p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0">FAZA {idx + 1}</span>
                          <Input
                            placeholder="Nazwa fazy..."
                            value={draft.name}
                            onChange={e => updatePhaseDraft(idx, { name: e.target.value })}
                            className="h-8 text-sm flex-1"
                          />
                          {phaseDrafts.length > 1 && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removePhaseDraft(idx)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <select
                            value={draft.format}
                            onChange={e => updatePhaseDraft(idx, { format: e.target.value as PhaseFormat })}
                            className="px-2 py-1.5 rounded bg-card border border-border text-xs font-mono col-span-2"
                          >
                            {PHASE_FORMATS.map(f => (
                              <option key={f.value} value={f.value}>{f.label}</option>
                            ))}
                          </select>
                          <select
                            value={draft.bo}
                            onChange={e => updatePhaseDraft(idx, { bo: parseInt(e.target.value) as 1 | 3 | 5 })}
                            className="px-2 py-1.5 rounded bg-card border border-border text-xs font-mono"
                          >
                            <option value={1}>BO1</option>
                            <option value={3}>BO3</option>
                            <option value={5}>BO5</option>
                          </select>
                          {showGroups && (
                            <Input
                              type="number"
                              min="1"
                              placeholder="Liczba grup"
                              value={draft.groupCount}
                              onChange={e => updatePhaseDraft(idx, { groupCount: parseInt(e.target.value) || 1 })}
                              className="h-8 text-xs"
                            />
                          )}
                          {showAdvance && (
                            <Input
                              type="number"
                              min="1"
                              placeholder="Awansuje X drużyn"
                              value={draft.advanceCount}
                              onChange={e => updatePhaseDraft(idx, { advanceCount: parseInt(e.target.value) || 0 })}
                              className={cn("h-8 text-xs", !showGroups && "col-span-1")}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] font-mono text-muted-foreground">
                  💡 Możesz łączyć fazy: np. <span className="text-primary">Swiss → Single Elim</span> (Major), <span className="text-primary">Round Robin → Double Elim</span>, <span className="text-primary">GSL Groups → Single Elim</span>.
                </p>
              </section>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => { setShowCreate(false); resetForm(); }}>Anuluj</Button>
              <Button
                onClick={handleCreate}
                disabled={!newName.trim() || selectedTeams.length < 2 || phaseDrafts.length === 0}
              >
                Utwórz turniej
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
    )}
    </>
  );
};

export default TournamentPanel;
