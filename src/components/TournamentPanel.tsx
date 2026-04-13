import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Plus, Edit3, Trash2, Check, X, ChevronDown, ChevronUp, 
  Calendar, MapPin, DollarSign, Users as UsersIcon, Medal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { TournamentData, MatchResult } from "@/lib/types";
import { saveToStorage, loadFromStorage } from "@/lib/storage";
import { teamDatabase } from "@/data/tournaments";

const STORAGE_KEY = "tournaments_data";

const TournamentPanel = () => {
  const [tournaments, setTournaments] = useState<TournamentData[]>(() =>
    loadFromStorage<TournamentData[]>(STORAGE_KEY, [])
  );
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showMatchDialog, setShowMatchDialog] = useState<string | null>(null);

  // New tournament form
  const [newName, setNewName] = useState("");
  const [newOrg, setNewOrg] = useState("");
  const [newPrize, setNewPrize] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newTier, setNewTier] = useState<"S" | "A" | "B" | "C">("A");
  const [newTeams, setNewTeams] = useState("8");
  const [newFormat, setNewFormat] = useState("BO3 Single Elimination");

  // Match form
  const [matchTeam1, setMatchTeam1] = useState("");
  const [matchTeam2, setMatchTeam2] = useState("");
  const [matchScore1, setMatchScore1] = useState("");
  const [matchScore2, setMatchScore2] = useState("");

  useEffect(() => { saveToStorage(STORAGE_KEY, tournaments); }, [tournaments]);

  const allTeams = teamDatabase.map(t => t.name).sort();

  const handleCreate = () => {
    if (!newName.trim()) return;
    const t: TournamentData = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: newName.trim(),
      organizer: newOrg.trim(),
      prizePool: newPrize.trim() || "$0",
      startDate: newStart,
      endDate: newEnd,
      location: newLocation.trim(),
      tier: newTier,
      teams: parseInt(newTeams) || 8,
      format: newFormat.trim(),
      status: "upcoming",
      participants: [],
      matches: [],
      placements: [],
    };
    setTournaments(prev => [t, ...prev]);
    setNewName(""); setNewOrg(""); setNewPrize(""); setNewStart(""); setNewEnd("");
    setNewLocation(""); setNewTier("A"); setNewTeams("8"); setNewFormat("BO3 Single Elimination");
    setShowCreate(false);
  };

  const handleAddMatch = (tournamentId: string) => {
    if (!matchTeam1 || !matchTeam2 || matchTeam1 === matchTeam2) return;
    const s1 = parseInt(matchScore1) || 0;
    const s2 = parseInt(matchScore2) || 0;
    const match: MatchResult = {
      id: Date.now().toString(36),
      team1: matchTeam1,
      team2: matchTeam2,
      score1: s1,
      score2: s2,
    };
    setTournaments(prev => prev.map(t =>
      t.id === tournamentId
        ? {
            ...t,
            matches: [...t.matches, match],
            status: "live" as const,
            participants: Array.from(new Set([...t.participants, matchTeam1, matchTeam2])),
          }
        : t
    ));
    setMatchTeam1(""); setMatchTeam2(""); setMatchScore1(""); setMatchScore2("");
    setShowMatchDialog(null);
  };

  const handleDeleteMatch = (tournamentId: string, matchId: string) => {
    setTournaments(prev => prev.map(t =>
      t.id === tournamentId
        ? { ...t, matches: t.matches.filter(m => m.id !== matchId) }
        : t
    ));
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

  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-heading font-bold text-foreground">Turnieje</h2>
          </div>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Nowy turniej
          </Button>
        </div>

        {/* Create form */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6"
            >
              <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                <Input placeholder="Nazwa turnieju..." value={newName} onChange={e => setNewName(e.target.value)} />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Organizator..." value={newOrg} onChange={e => setNewOrg(e.target.value)} />
                  <Input placeholder="Pula nagród (np. $500,000)..." value={newPrize} onChange={e => setNewPrize(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-mono text-muted-foreground mb-1 block">Start</label>
                    <Input type="date" value={newStart} onChange={e => setNewStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-muted-foreground mb-1 block">Koniec</label>
                    <Input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
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
                  <Input type="number" placeholder="Ilość drużyn" value={newTeams} onChange={e => setNewTeams(e.target.value)} />
                </div>
                <Input placeholder="Format (np. BO3 Double Elimination)..." value={newFormat} onChange={e => setNewFormat(e.target.value)} />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Anuluj</Button>
                  <Button size="sm" onClick={handleCreate}>Utwórz turniej</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tournament list */}
        {tournaments.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-mono text-sm">Brak turniejów. Utwórz pierwszy!</p>
          </div>
        )}
        <div className="space-y-3">
          {tournaments.map(t => {
            const isExpanded = expandedId === t.id;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-card border border-border rounded-lg overflow-hidden"
              >
                {/* Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border", tierColor(t.tier))}>
                      {t.tier}
                    </span>
                    <span className="font-heading font-semibold text-foreground text-sm">{t.name}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-mono", statusBadge(t.status))}>
                      {statusLabel(t.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-mono hidden sm:block">
                      {t.matches.length} mecz(ów)
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Expanded content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-4">
                        {/* Info */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {t.startDate || "—"} → {t.endDate || "—"}
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <MapPin className="w-3 h-3" /> {t.location || "—"}
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <DollarSign className="w-3 h-3" /> {t.prizePool}
                          </div>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <UsersIcon className="w-3 h-3" /> {t.teams} drużyn • {t.format}
                          </div>
                        </div>

                        {/* Matches */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-heading font-semibold text-muted-foreground uppercase">Mecze</h4>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => setShowMatchDialog(t.id)}
                            >
                              <Plus className="w-3 h-3" /> Dodaj mecz
                            </Button>
                          </div>
                          {t.matches.length === 0 ? (
                            <p className="text-xs text-muted-foreground font-mono">Brak meczów</p>
                          ) : (
                            <div className="space-y-1">
                              {t.matches.map(m => (
                                <div key={m.id} className="flex items-center justify-between px-3 py-1.5 bg-secondary/30 rounded text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className={cn("font-medium", m.score1 > m.score2 ? "text-foreground" : "text-muted-foreground")}>
                                      {m.team1}
                                    </span>
                                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-background">
                                      {m.score1} : {m.score2}
                                    </span>
                                    <span className={cn("font-medium", m.score2 > m.score1 ? "text-foreground" : "text-muted-foreground")}>
                                      {m.team2}
                                    </span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive"
                                    onClick={() => handleDeleteMatch(t.id, m.id)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                          {t.status !== "live" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleSetStatus(t.id, "live")}>
                              Rozpocznij
                            </Button>
                          )}
                          {t.status !== "completed" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleSetStatus(t.id, "completed")}>
                              Zakończ
                            </Button>
                          )}
                          {t.status === "completed" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleSetStatus(t.id, "upcoming")}>
                              Resetuj status
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-destructive hover:text-destructive ml-auto"
                            onClick={() => handleDelete(t.id)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> Usuń
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Add match dialog */}
        <Dialog open={showMatchDialog !== null} onOpenChange={() => setShowMatchDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dodaj mecz</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono text-muted-foreground mb-1 block">Drużyna 1</label>
                  <select
                    value={matchTeam1}
                    onChange={e => setMatchTeam1(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground text-sm font-mono"
                  >
                    <option value="">Wybierz...</option>
                    {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-mono text-muted-foreground mb-1 block">Drużyna 2</label>
                  <select
                    value={matchTeam2}
                    onChange={e => setMatchTeam2(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground text-sm font-mono"
                  >
                    <option value="">Wybierz...</option>
                    {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono text-muted-foreground mb-1 block">Wynik 1</label>
                  <Input type="number" min="0" value={matchScore1} onChange={e => setMatchScore1(e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-mono text-muted-foreground mb-1 block">Wynik 2</label>
                  <Input type="number" min="0" value={matchScore2} onChange={e => setMatchScore2(e.target.value)} placeholder="0" />
                </div>
              </div>
              <Button onClick={() => showMatchDialog && handleAddMatch(showMatchDialog)} className="w-full">
                Dodaj mecz
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
};

export default TournamentPanel;
