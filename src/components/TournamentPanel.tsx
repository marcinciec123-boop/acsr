import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Trophy, Plus, Trash2, ChevronRight,
  Calendar, MapPin, DollarSign, Users as UsersIcon,
  Layers, GitBranch, Grid3x3, Shuffle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { TournamentData, TournamentPhase, PhaseFormat, MatchResult } from "@/lib/types";
import { saveToStorage, loadFromStorage } from "@/lib/storage";
import { teamDatabase } from "@/data/tournaments";
import { buildPhase, formatLabel, shuffle } from "@/lib/tournamentBuilder";
import { TournamentDetailPage } from "./tournament/TournamentDetailPage";

const STORAGE_KEY = "tournaments_data";

const PHASE_FORMATS: { value: PhaseFormat; label: string; icon: typeof GitBranch }[] = [
  { value: "single-elim", label: "Single Elimination", icon: GitBranch },
  { value: "double-elim", label: "Double Elimination", icon: GitBranch },
  { value: "swiss", label: "Swiss System", icon: Layers },
  { value: "round-robin", label: "Round Robin (Groups)", icon: Grid3x3 },
  { value: "gsl-groups", label: "GSL Groups", icon: Grid3x3 },
  { value: "showmatch", label: "Showmatch", icon: Trophy },
];

interface PhaseDraft {
  name: string;
  format: PhaseFormat;
  bo: 1 | 3 | 5;
  groupCount: number;
  advanceCount: number;
}

const TournamentPanel = () => {
  const [tournaments, setTournaments] = useState<TournamentData[]>(() =>
    loadFromStorage<TournamentData[]>(STORAGE_KEY, [])
  );
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  };

  const toggleTeam = (name: string) => {
    setSelectedTeams(prev =>
      prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
    );
  };

  const seedRandom = () => setSelectedTeams(prev => shuffle(prev));

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
    };
    setTournaments(prev => [t, ...prev]);
    resetForm();
    setShowCreate(false);
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
              groups: p.groups.map(g => g.id !== groupId ? g : {
                ...g,
                matches: g.matches.map(m => m.id !== matchId ? m : { ...m, ...patch }),
              }),
            };
          }
          if (p.bracket) {
            return {
              ...p,
              bracket: p.bracket.map(m => m.id !== matchId ? m : { ...m, ...patch }),
            };
          }
          return p;
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

  const handleSetStatus = (id: string, status: "upcoming" | "live" | "completed") => {
    setTournaments(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  };

  const handleDelete = (id: string) => {
    setTournaments(prev => prev.filter(t => t.id !== id));
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
        onBack={() => setSelectedId(null)}
        onUpdateMatch={(phaseId, matchId, patch, groupId) =>
          updatePhaseMatch(selectedTournament.id, phaseId, matchId, patch, groupId)
        }
        onDeleteBracketMatch={(phaseId, matchId) =>
          deleteBracketMatch(selectedTournament.id, phaseId, matchId)
        }
        onSetStatus={(s) => handleSetStatus(selectedTournament.id, s)}
        onDelete={() => handleDelete(selectedTournament.id)}
        onOpenMatch={(phaseId, matchId, groupId) => setSelectedMatchRef({ phaseId, matchId, groupId })}
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
                    <p className="text-[10px] font-mono text-muted-foreground mb-1.5">Rozstawienie (kolejność = seed):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTeams.map((t, i) => (
                        <button
                          key={t}
                          onClick={() => toggleTeam(t)}
                          className="text-[11px] px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 hover:bg-destructive/20 hover:text-destructive hover:border-destructive/40 font-mono"
                        >
                          #{i + 1} {t} ✕
                        </button>
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

              {/* Phases */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider">
                    3. Fazy turnieju ({phaseDrafts.length})
                  </h3>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addPhaseDraft}>
                    <Plus className="w-3 h-3" /> Dodaj fazę
                  </Button>
                </div>
                <div className="space-y-2">
                  {phaseDrafts.map((draft, idx) => {
                    const showGroups = draft.format === "round-robin" || draft.format === "gsl-groups";
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
