import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, Users, Play, SkipForward, Edit3, Check, Shield, Crown, Plus, X, Search, UserPlus } from "lucide-react";
import { type Tournament, type MatchResult, type KnockoutRound, simulateMatch, teamDatabase } from "@/data/tournaments";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { type MatchStats, generateMatchStats } from "@/lib/playerStats";
import MatchStatsPanel from "@/components/MatchStatsPanel";

interface QualifierPlayProps {
  tournament: Tournament;
  invitedTeams: string[];
  qualifierPool: string[];
  qualifierSlots: number;
  onComplete: (qualifiedTeams: string[], manualInvites?: string[]) => void;
  onBack: () => void;
}

const getTeamRoster = (teamName: string): string[] => {
  const team = teamDatabase.find(t => t.name === teamName);
  return team?.roster || [teamName + "_p1", teamName + "_p2", teamName + "_p3", teamName + "_p4", teamName + "_p5"];
};

// Editable match component with stats
const EditableMatch = ({ match, index, onUpdate, onSimulate, resolved, matchStats, onUpdateStats }: {
  match: MatchResult; index: number;
  onUpdate: (index: number, match: MatchResult) => void;
  onSimulate: (index: number) => void;
  resolved: boolean;
  matchStats?: MatchStats | null;
  onUpdateStats?: (matchId: string, stats: MatchStats) => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [s1, setS1] = useState("0");
  const [s2, setS2] = useState("0");

  const confirmScore = () => {
    const score1 = parseInt(s1) || 0;
    const score2 = parseInt(s2) || 0;
    if (score1 === score2 || score1 < 0 || score2 < 0) return;
    const winner = score1 > score2 ? match.team1 : match.team2;
    onUpdate(index, { ...match, score1, score2, winner });
    setEditing(false);
    if (onUpdateStats) {
      const stats = generateMatchStats(match.team1, match.team2, getTeamRoster(match.team1), getTeamRoster(match.team2), score1, score2, match.bo);
      onUpdateStats(`${match.team1}-vs-${match.team2}`, stats);
    }
  };

  if (match.team2 === "BYE") {
    return (
      <div className="flex items-center bg-card border border-border/50 rounded-md overflow-hidden text-sm opacity-50">
        <div className="flex-1 px-3 py-2 text-right font-medium text-foreground">{match.team1}</div>
        <div className="px-3 py-2 font-mono text-xs bg-secondary min-w-[60px] text-center text-muted-foreground">BYE</div>
        <div className="flex-1 px-3 py-2 text-muted-foreground">—</div>
      </div>
    );
  }

  return (
    <div className={cn("bg-card border rounded-md overflow-hidden text-sm transition-all", resolved ? "border-win/20" : "border-primary/30")}>
      <div className="flex items-center">
        <div className={cn("flex-1 px-3 py-2 text-right truncate font-medium", resolved && match.winner === match.team1 ? "text-foreground font-bold" : "text-muted-foreground")}>
          {match.team1}
        </div>
        {editing ? (
          <div className="flex items-center gap-1 px-2 py-1 bg-secondary">
            <Input value={s1} onChange={(e) => setS1(e.target.value)} className="w-10 h-7 text-center font-mono text-xs p-0 bg-background" type="number" min="0" />
            <span className="text-muted-foreground text-xs">:</span>
            <Input value={s2} onChange={(e) => setS2(e.target.value)} className="w-10 h-7 text-center font-mono text-xs p-0 bg-background" type="number" min="0" />
            <button onClick={confirmScore} className="ml-1 p-1 rounded hover:bg-primary/20 text-primary"><Check className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <div className="px-3 py-2 font-mono text-xs bg-secondary min-w-[60px] text-center">
            {resolved ? (
              <>
                <span className={match.winner === match.team1 ? "text-primary font-bold" : "text-muted-foreground"}>{match.score1}</span>
                <span className="text-muted-foreground mx-1">:</span>
                <span className={match.winner === match.team2 ? "text-primary font-bold" : "text-muted-foreground"}>{match.score2}</span>
              </>
            ) : <span className="text-muted-foreground">vs</span>}
          </div>
        )}
        <div className={cn("flex-1 px-3 py-2 truncate font-medium", resolved && match.winner === match.team2 ? "text-foreground font-bold" : "text-muted-foreground")}>
          {match.team2}
        </div>
      </div>
      {!resolved && !editing && (
        <div className="flex border-t border-border/50">
          <button onClick={() => onSimulate(index)} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-mono text-primary hover:bg-primary/10 transition-colors">
            <Play className="w-3 h-3" /> Symuluj
          </button>
          <div className="w-px bg-border/50" />
          <button onClick={() => { setEditing(true); setS1("0"); setS2("0"); }} className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-mono text-accent hover:bg-accent/10 transition-colors">
            <Edit3 className="w-3 h-3" /> Wpisz wynik
          </button>
        </div>
      )}
      {/* Stats panel */}
      {resolved && (
        <MatchStatsPanel
          stats={matchStats || null}
          team1={match.team1}
          team2={match.team2}
          bo={match.bo}
          onUpdateStats={onUpdateStats ? (updated) => onUpdateStats(`${match.team1}-vs-${match.team2}`, updated) : undefined}
          onCreateStats={onUpdateStats ? () => {
            const stats = generateMatchStats(match.team1, match.team2, getTeamRoster(match.team1), getTeamRoster(match.team2), match.score1, match.score2, match.bo);
            onUpdateStats!(`${match.team1}-vs-${match.team2}`, stats);
          } : undefined}
        />
      )}
    </div>
  );
};

// Setup phase component for manual team selection
const QualifierSetup = ({ tournament, invitedTeams, qualifierPool, qualifierSlots, onStart, onSimulateAll, onBack }: {
  tournament: Tournament;
  invitedTeams: string[];
  qualifierPool: string[];
  qualifierSlots: number;
  onStart: (customPool: string[], manualInvites: string[]) => void;
  onSimulateAll: (customPool: string[], manualInvites: string[]) => void;
  onBack: () => void;
}) => {
  const manualInviteSlots = tournament.qualification.manualInviteSlots || 0;
  const [manualInvites, setManualInvites] = useState<string[]>([]);
  const [customPool, setCustomPool] = useState<string[]>(qualifierPool);
  const [search, setSearch] = useState("");
  const [poolSearch, setPoolSearch] = useState("");
  const [showInvitePicker, setShowInvitePicker] = useState(false);
  const [showPoolPicker, setShowPoolPicker] = useState(false);

  const allTeamNames = useMemo(() => teamDatabase.map(t => t.name), []);
  const usedTeams = useMemo(() => new Set([...invitedTeams, ...manualInvites, ...customPool]), [invitedTeams, manualInvites, customPool]);

  const availableForInvite = useMemo(() =>
    allTeamNames.filter(t => !usedTeams.has(t) && t.toLowerCase().includes(search.toLowerCase())),
    [allTeamNames, usedTeams, search]
  );

  const availableForPool = useMemo(() =>
    allTeamNames.filter(t => !new Set([...invitedTeams, ...manualInvites]).has(t) && !customPool.includes(t) && t.toLowerCase().includes(poolSearch.toLowerCase())),
    [allTeamNames, invitedTeams, manualInvites, customPool, poolSearch]
  );

  const addManualInvite = (team: string) => {
    if (manualInvites.length >= manualInviteSlots) return;
    setManualInvites(prev => [...prev, team]);
    setCustomPool(prev => prev.filter(t => t !== team));
  };

  const removeManualInvite = (team: string) => {
    setManualInvites(prev => prev.filter(t => t !== team));
  };

  const addToPool = (team: string) => {
    setCustomPool(prev => [...prev, team]);
  };

  const removeFromPool = (team: string) => {
    setCustomPool(prev => prev.filter(t => t !== team));
  };

  const qualType = tournament.qualification.qualifierType === "regional" ? "Regionalne" : "Open";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-md hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-primary" />
            <span className="text-xs font-mono text-primary uppercase tracking-wider">Konfiguracja kwalifikacji {qualType}</span>
          </div>
          <h2 className="text-2xl font-heading font-bold text-foreground">
            {tournament.name} — Kwalifikacje
          </h2>
        </div>
      </div>

      {/* Ranking-invited teams */}
      <div className="bg-card border border-win/20 rounded-lg p-4">
        <h3 className="font-heading font-bold text-foreground flex items-center gap-2 mb-3">
          <Crown className="w-4 h-4 text-accent" />
          Zaproszone z rankingu ({invitedTeams.length})
        </h3>
        <div className="flex flex-wrap gap-2">
          {invitedTeams.map(t => (
            <span key={t} className="px-2 py-1 bg-win/10 text-win border border-win/20 rounded text-xs font-mono">{t}</span>
          ))}
          {invitedTeams.length === 0 && (
            <span className="text-xs text-muted-foreground font-mono">Brak zaproszeń z rankingu — wszystkie miejsca przez kwalifikacje</span>
          )}
        </div>
      </div>

      {/* Manual invites section */}
      {manualInviteSlots > 0 && (
        <div className="bg-card border border-accent/20 rounded-lg p-4">
          <h3 className="font-heading font-bold text-foreground flex items-center gap-2 mb-3">
            <UserPlus className="w-4 h-4 text-accent" />
            Ręczne zaproszenia ({manualInvites.length}/{manualInviteSlots})
          </h3>
          <p className="text-muted-foreground text-xs mb-3">Wybierz drużyny do zaproszenia bezpośrednio do turnieju</p>

          <div className="flex flex-wrap gap-2 mb-3">
            {manualInvites.map(t => (
              <span key={t} className="px-2 py-1 bg-accent/10 text-accent border border-accent/20 rounded text-xs font-mono flex items-center gap-1">
                {t}
                <button onClick={() => removeManualInvite(t)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
              </span>
            ))}
            {manualInvites.length < manualInviteSlots && (
              <button
                onClick={() => setShowInvitePicker(!showInvitePicker)}
                className="px-2 py-1 border border-dashed border-accent/30 text-accent rounded text-xs font-mono flex items-center gap-1 hover:bg-accent/10 transition-colors"
              >
                <Plus className="w-3 h-3" /> Dodaj
              </button>
            )}
          </div>

          {showInvitePicker && manualInvites.length < manualInviteSlots && (
            <div className="border border-border rounded-md p-3 bg-background">
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Szukaj drużyny..."
                  className="pl-8 h-8 text-xs"
                />
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {availableForInvite.slice(0, 20).map(t => (
                  <button key={t} onClick={() => addManualInvite(t)} className="w-full text-left px-2 py-1.5 text-xs font-mono hover:bg-accent/10 rounded transition-colors text-foreground">
                    {t}
                  </button>
                ))}
                {availableForInvite.length === 0 && <p className="text-xs text-muted-foreground p-2">Brak wyników</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Qualifier pool */}
      <div className="bg-card border border-primary/20 rounded-lg p-4">
        <h3 className="font-heading font-bold text-foreground flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-primary" />
          Pula kwalifikacyjna ({customPool.length} drużyn → {qualifierSlots} miejsc)
        </h3>
        <p className="text-muted-foreground text-xs mb-3">Edytuj pulę drużyn walczących w kwalifikacjach</p>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {customPool.map((t, i) => (
            <span key={t} className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded text-xs font-mono flex items-center gap-1">
              <span className="text-muted-foreground text-[10px]">#{i + 1}</span>
              {t}
              <button onClick={() => removeFromPool(t)} className="hover:text-destructive ml-0.5"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>

        <button
          onClick={() => setShowPoolPicker(!showPoolPicker)}
          className="px-3 py-1.5 border border-dashed border-primary/30 text-primary rounded text-xs font-mono flex items-center gap-1 hover:bg-primary/10 transition-colors"
        >
          <Plus className="w-3 h-3" /> Dodaj drużynę do puli
        </button>

        {showPoolPicker && (
          <div className="border border-border rounded-md p-3 bg-background mt-2">
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={poolSearch}
                onChange={e => setPoolSearch(e.target.value)}
                placeholder="Szukaj drużyny..."
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {availableForPool.slice(0, 20).map(t => (
                <button key={t} onClick={() => addToPool(t)} className="w-full text-left px-2 py-1.5 text-xs font-mono hover:bg-primary/10 rounded transition-colors text-foreground">
                  {t}
                </button>
              ))}
              {availableForPool.length === 0 && <p className="text-xs text-muted-foreground p-2">Brak wyników</p>}
            </div>
          </div>
        )}
      </div>

      {/* Summary & actions */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="text-sm text-muted-foreground mb-4">
          <p>Łącznie w turnieju: <strong className="text-foreground">{invitedTeams.length + manualInvites.length + qualifierSlots}</strong> drużyn</p>
          <p>Z rankingu: <strong className="text-win">{invitedTeams.length}</strong> • Ręczne zaproszenia: <strong className="text-accent">{manualInvites.length}</strong> • Z kwalifikacji: <strong className="text-primary">{qualifierSlots}</strong></p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onStart(customPool, manualInvites)}
            className="flex items-center gap-2 px-6 py-3 gradient-primary text-primary-foreground rounded-md font-heading font-semibold hover:opacity-90 transition-opacity"
            disabled={customPool.length < qualifierSlots * 2}
          >
            <Play className="w-4 h-4" /> Rozegraj kwalifikacje
          </button>
          <button
            onClick={() => onSimulateAll(customPool, manualInvites)}
            className="flex items-center gap-2 px-6 py-3 border border-primary/30 text-primary rounded-md font-heading font-semibold hover:bg-primary/10 transition-colors"
            disabled={customPool.length < qualifierSlots * 2}
          >
            <SkipForward className="w-4 h-4" /> Symuluj kwalifikacje
          </button>
        </div>
      </div>
    </div>
  );
};

const QualifierPlay = ({ tournament, invitedTeams, qualifierPool, qualifierSlots, onComplete, onBack }: QualifierPlayProps) => {
  const [phase, setPhase] = useState<"setup" | "play" | "finished">("setup");
  const [activePool, setActivePool] = useState<string[]>(qualifierPool);
  const [activeManualInvites, setActiveManualInvites] = useState<string[]>([]);
  const [allMatchStats, setAllMatchStats] = useState<Record<string, MatchStats>>({});

  const teamsForBracket = activePool.slice(0, Math.max(qualifierSlots * 4, 8));

  // Pad to power of 2
  let size = 2;
  while (size < teamsForBracket.length) size *= 2;
  const padded = [...teamsForBracket];
  while (padded.length < size) padded.push("BYE");
  const totalRounds = Math.log2(size);

  const [completedRounds, setCompletedRounds] = useState<KnockoutRound[]>([]);
  const [currentMatches, setCurrentMatches] = useState<MatchResult[]>([]);
  const [resolved, setResolved] = useState<boolean[]>([]);
  const [qualifiedTeams, setQualifiedTeams] = useState<string[]>([]);
  const [roundName, setRoundName] = useState("");

  const handleUpdateStats = useCallback((matchId: string, stats: MatchStats) => {
    setAllMatchStats(prev => ({ ...prev, [matchId]: stats }));
  }, []);

  const getStatsForMatch = (m: MatchResult): MatchStats | null => {
    return allMatchStats[`${m.team1}-vs-${m.team2}`] || null;
  };

  const getRoundName = (idx: number) => {
    const remaining = size / Math.pow(2, idx);
    if (remaining === 2) return "Finał kwalifikacji";
    if (remaining === 4) return "Półfinały kwalifikacji";
    if (remaining === 8) return "Ćwierćfinały kwalifikacji";
    return `Runda ${idx + 1} kwalifikacji`;
  };

  const startBracket = useCallback((pool: string[]) => {
    const bracket = pool.slice(0, Math.max(qualifierSlots * 4, 8));
    let s = 2;
    while (s < bracket.length) s *= 2;
    const p = [...bracket];
    while (p.length < s) p.push("BYE");

    setRoundName(getRoundName(0));
    const matches: MatchResult[] = [];
    for (let i = 0; i < p.length; i += 2) {
      const t1 = p[i];
      const t2 = p[i + 1];
      if (t2 === "BYE") {
        matches.push({ team1: t1, team2: "BYE", score1: 2, score2: 0, winner: t1, bo: 1 });
      } else {
        matches.push({ team1: t1, team2: t2, score1: 0, score2: 0, winner: "", bo: 3 });
      }
    }
    setCurrentMatches(matches);
    setResolved(matches.map(m => m.team2 === "BYE"));
  }, [qualifierSlots]);

  const handleSetupStart = (customPool: string[], manualInvites: string[]) => {
    setActivePool(customPool);
    setActiveManualInvites(manualInvites);
    setPhase("play");
    startBracket(customPool);
  };

  const handleSetupSimulateAll = (customPool: string[], manualInvites: string[]) => {
    setActiveManualInvites(manualInvites);

    let teams = customPool.slice(0, Math.max(qualifierSlots * 4, 8));
    let s = 2;
    while (s < teams.length) s *= 2;
    while (teams.length < s) teams.push("BYE");
    const allRounds: KnockoutRound[] = [];
    let current = [...teams];

    while (current.length > qualifierSlots) {
      const matches: MatchResult[] = [];
      for (let i = 0; i < current.length; i += 2) {
        const t1 = current[i];
        const t2 = current[i + 1] || "BYE";
        if (t2 === "BYE") {
          matches.push({ team1: t1, team2: "BYE", score1: 2, score2: 0, winner: t1, bo: 3 });
        } else {
          const result = simulateMatch(t1, t2, 3);
          matches.push(result);
          // Generate stats for simulated matches
          const stats = generateMatchStats(t1, t2, getTeamRoster(t1), getTeamRoster(t2), result.score1, result.score2, 3);
          setAllMatchStats(prev => ({ ...prev, [`${t1}-vs-${t2}`]: stats }));
        }
      }
      allRounds.push({ name: `Runda ${allRounds.length + 1}`, matches });
      current = matches.map(m => m.winner);
    }

    setCompletedRounds(allRounds);
    setQualifiedTeams(current.slice(0, qualifierSlots));
    setCurrentMatches([]);
    setPhase("finished");
  };

  const updateMatch = useCallback((idx: number, match: MatchResult) => {
    setCurrentMatches(prev => { const n = [...prev]; n[idx] = match; return n; });
    setResolved(prev => { const n = [...prev]; n[idx] = true; return n; });
  }, []);

  const simulateOne = useCallback((idx: number) => {
    const m = currentMatches[idx];
    const result = simulateMatch(m.team1, m.team2, m.bo);
    updateMatch(idx, result);
    // Auto-generate stats
    const stats = generateMatchStats(m.team1, m.team2, getTeamRoster(m.team1), getTeamRoster(m.team2), result.score1, result.score2, m.bo);
    setAllMatchStats(prev => ({ ...prev, [`${m.team1}-vs-${m.team2}`]: stats }));
  }, [currentMatches, updateMatch]);

  const simulateAllCurrent = useCallback(() => {
    const next = [...currentMatches];
    const res = [...resolved];
    const newStats: Record<string, MatchStats> = {};
    next.forEach((m, i) => {
      if (!res[i] && m.team2 !== "BYE") {
        const result = simulateMatch(m.team1, m.team2, m.bo);
        next[i] = result;
        res[i] = true;
        newStats[`${m.team1}-vs-${m.team2}`] = generateMatchStats(m.team1, m.team2, getTeamRoster(m.team1), getTeamRoster(m.team2), result.score1, result.score2, m.bo);
      }
    });
    setCurrentMatches(next);
    setResolved(res);
    setAllMatchStats(prev => ({ ...prev, ...newStats }));
  }, [currentMatches, resolved]);

  const advanceRound = useCallback(() => {
    const roundIdx = completedRounds.length;
    const newCompleted = [...completedRounds, { name: roundName, matches: currentMatches }];
    setCompletedRounds(newCompleted);
    const winners = currentMatches.map(m => m.winner);

    if (winners.length <= qualifierSlots || roundIdx + 1 >= totalRounds) {
      setQualifiedTeams(winners.slice(0, qualifierSlots));
      setCurrentMatches([]);
      setPhase("finished");
      return;
    }

    const nextRoundIdx = roundIdx + 1;
    setRoundName(getRoundName(nextRoundIdx));
    const matches: MatchResult[] = [];
    for (let i = 0; i < winners.length; i += 2) {
      const t1 = winners[i];
      const t2 = winners[i + 1] || "BYE";
      if (t2 === "BYE") {
        matches.push({ team1: t1, team2: "BYE", score1: 2, score2: 0, winner: t1, bo: 3 });
      } else {
        matches.push({ team1: t1, team2: t2, score1: 0, score2: 0, winner: "", bo: 3 });
      }
    }
    setCurrentMatches(matches);
    setResolved(matches.map(m => m.team2 === "BYE"));
  }, [completedRounds, currentMatches, roundName, totalRounds, qualifierSlots]);

  const allResolved = resolved.length > 0 && resolved.every(Boolean);
  const qualType = tournament.qualification.qualifierType === "regional" ? "Regionalne" : "Open";

  return (
    <section className="py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* SETUP PHASE */}
        {phase === "setup" && (
          <QualifierSetup
            tournament={tournament}
            invitedTeams={invitedTeams}
            qualifierPool={qualifierPool}
            qualifierSlots={qualifierSlots}
            onStart={handleSetupStart}
            onSimulateAll={handleSetupSimulateAll}
            onBack={onBack}
          />
        )}

        {/* PLAY PHASE */}
        {phase === "play" && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setPhase("setup")} className="p-2 rounded-md hover:bg-secondary transition-colors">
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-5 h-5 text-primary" />
                  <span className="text-xs font-mono text-primary uppercase tracking-wider">Kwalifikacje {qualType}</span>
                </div>
                <h2 className="text-2xl font-heading font-bold text-foreground">
                  {tournament.name} — Kwalifikacje
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {qualifierSlots} miejsc do zdobycia • {teamsForBracket.length} drużyn w kwalifikacjach
                </p>
              </div>
            </div>

            {/* Manual invites info */}
            {activeManualInvites.length > 0 && (
              <div className="bg-card border border-accent/20 rounded-lg p-3 mb-4">
                <h4 className="font-heading font-bold text-foreground flex items-center gap-2 text-sm mb-2">
                  <UserPlus className="w-3.5 h-3.5 text-accent" />
                  Ręczne zaproszenia ({activeManualInvites.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {activeManualInvites.map(t => (
                    <span key={t} className="px-2 py-1 bg-accent/10 text-accent border border-accent/20 rounded text-xs font-mono">{t}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-bold text-foreground">{roundName}</h3>
                <div className="flex gap-2">
                  <button onClick={simulateAllCurrent} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-primary border border-primary/30 rounded hover:bg-primary/10 transition-colors">
                    <SkipForward className="w-3 h-3" /> Symuluj rundę
                  </button>
                  {allResolved && (
                    <button onClick={advanceRound} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono gradient-primary text-primary-foreground rounded hover:opacity-90 transition-opacity">
                      Dalej →
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {currentMatches.map((m, i) => (
                  <EditableMatch
                    key={`${m.team1}-${m.team2}-${i}`}
                    match={m}
                    index={i}
                    onUpdate={updateMatch}
                    onSimulate={simulateOne}
                    resolved={resolved[i]}
                    matchStats={getStatsForMatch(m)}
                    onUpdateStats={handleUpdateStats}
                  />
                ))}
              </div>

              {/* Completed rounds */}
              {completedRounds.length > 0 && (
                <div className="mt-6 border-t border-border pt-4">
                  <h4 className="text-sm font-mono text-muted-foreground mb-3">Zakończone rundy</h4>
                  {completedRounds.map((round, ri) => (
                    <div key={ri} className="mb-3">
                      <p className="text-xs font-mono text-primary mb-1">{round.name}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
                        {round.matches.filter(m => m.team2 !== "BYE").map((m, mi) => (
                          <div key={mi} className="flex items-center text-xs bg-secondary/50 rounded px-2 py-1">
                            <span className={cn("flex-1 text-right truncate", m.winner === m.team1 ? "text-foreground font-bold" : "text-muted-foreground")}>{m.team1}</span>
                            <span className="mx-2 font-mono text-muted-foreground">{m.score1}:{m.score2}</span>
                            <span className={cn("flex-1 truncate", m.winner === m.team2 ? "text-foreground font-bold" : "text-muted-foreground")}>{m.team2}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* FINISHED PHASE */}
        {phase === "finished" && (
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="text-center mb-6">
              <Trophy className="w-10 h-10 text-accent mx-auto mb-3" />
              <h3 className="font-heading text-xl font-bold text-foreground">Kwalifikacje zakończone!</h3>
              <p className="text-muted-foreground text-sm mt-1">{qualifiedTeams.length} drużyn zakwalifikowało się do {tournament.name}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
              {qualifiedTeams.map((t, i) => (
                <motion.div
                  key={t}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-win/10 border border-win/20 rounded-md p-3 text-center"
                >
                  <span className="text-xs font-mono text-win/60">#{i + 1}</span>
                  <p className="font-heading font-bold text-foreground text-sm">{t}</p>
                </motion.div>
              ))}
            </div>

            {/* Show completed rounds */}
            {completedRounds.length > 0 && (
              <div className="border-t border-border pt-4 mb-6">
                <h4 className="text-sm font-mono text-muted-foreground mb-3">Przebieg kwalifikacji</h4>
                {completedRounds.map((round, ri) => (
                  <div key={ri} className="mb-3">
                    <p className="text-xs font-mono text-primary mb-1">{round.name}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
                      {round.matches.filter(m => m.team2 !== "BYE").map((m, mi) => (
                        <div key={mi} className="flex items-center text-xs bg-secondary/50 rounded px-2 py-1">
                          <span className={cn("flex-1 text-right truncate", m.winner === m.team1 ? "text-foreground font-bold" : "text-muted-foreground")}>{m.team1}</span>
                          <span className="mx-2 font-mono text-muted-foreground">{m.score1}:{m.score2}</span>
                          <span className={cn("flex-1 truncate", m.winner === m.team2 ? "text-foreground font-bold" : "text-muted-foreground")}>{m.team2}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-center">
              <button
                onClick={() => onComplete(qualifiedTeams, activeManualInvites)}
                className="flex items-center gap-2 px-8 py-3 gradient-primary text-primary-foreground rounded-md font-heading font-bold hover:opacity-90 transition-opacity"
              >
                <Trophy className="w-5 h-5" />
                Przejdź do turnieju →
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default QualifierPlay;
