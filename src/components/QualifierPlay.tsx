import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, Users, Play, SkipForward, Edit3, Check, Shield, Crown } from "lucide-react";
import { type Tournament, type MatchResult, type KnockoutRound, simulateMatch } from "@/data/tournaments";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface QualifierPlayProps {
  tournament: Tournament;
  invitedTeams: string[];
  qualifierPool: string[];
  qualifierSlots: number;
  onComplete: (qualifiedTeams: string[]) => void;
  onBack: () => void;
}

// Reuse EditableMatch from TournamentPlay pattern
const EditableMatch = ({ match, index, onUpdate, onSimulate, resolved }: {
  match: MatchResult; index: number;
  onUpdate: (index: number, match: MatchResult) => void;
  onSimulate: (index: number) => void;
  resolved: boolean;
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
    </div>
  );
};

const QualifierPlay = ({ tournament, invitedTeams, qualifierPool, qualifierSlots, onComplete, onBack }: QualifierPlayProps) => {
  const teamsForBracket = qualifierPool.slice(0, Math.max(qualifierSlots * 4, 8));

  // Pad to power of 2
  let size = 2;
  while (size < teamsForBracket.length) size *= 2;
  const padded = [...teamsForBracket];
  while (padded.length < size) padded.push("BYE");
  const totalRounds = Math.log2(size);

  // How many rounds to play — stop when we have enough qualified teams
  const qualifyingRound = Math.max(0, totalRounds - Math.log2(qualifierSlots));

  const [completedRounds, setCompletedRounds] = useState<KnockoutRound[]>([]);
  const [currentMatches, setCurrentMatches] = useState<MatchResult[]>([]);
  const [resolved, setResolved] = useState<boolean[]>([]);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [qualifiedTeams, setQualifiedTeams] = useState<string[]>([]);
  const [roundName, setRoundName] = useState("");

  const getRoundName = (idx: number) => {
    const remaining = size / Math.pow(2, idx);
    if (remaining === 2) return "Finał kwalifikacji";
    if (remaining === 4) return "Półfinały kwalifikacji";
    if (remaining === 8) return "Ćwierćfinały kwalifikacji";
    return `Runda ${idx + 1} kwalifikacji`;
  };

  const start = useCallback(() => {
    setStarted(true);
    setRoundName(getRoundName(0));
    const matches: MatchResult[] = [];
    for (let i = 0; i < padded.length; i += 2) {
      const t1 = padded[i];
      const t2 = padded[i + 1];
      if (t2 === "BYE") {
        matches.push({ team1: t1, team2: "BYE", score1: 2, score2: 0, winner: t1, bo: 1 });
      } else {
        matches.push({ team1: t1, team2: t2, score1: 0, score2: 0, winner: "", bo: 3 });
      }
    }
    setCurrentMatches(matches);
    setResolved(matches.map(m => m.team2 === "BYE"));
  }, [padded]);

  const updateMatch = useCallback((idx: number, match: MatchResult) => {
    setCurrentMatches(prev => { const n = [...prev]; n[idx] = match; return n; });
    setResolved(prev => { const n = [...prev]; n[idx] = true; return n; });
  }, []);

  const simulateOne = useCallback((idx: number) => {
    const m = currentMatches[idx];
    updateMatch(idx, simulateMatch(m.team1, m.team2, m.bo));
  }, [currentMatches, updateMatch]);

  const simulateAllCurrent = useCallback(() => {
    const next = [...currentMatches];
    const res = [...resolved];
    next.forEach((m, i) => {
      if (!res[i] && m.team2 !== "BYE") {
        next[i] = simulateMatch(m.team1, m.team2, m.bo);
        res[i] = true;
      }
    });
    setCurrentMatches(next);
    setResolved(res);
  }, [currentMatches, resolved]);

  const advanceRound = useCallback(() => {
    const roundIdx = completedRounds.length;
    const newCompleted = [...completedRounds, { name: roundName, matches: currentMatches }];
    setCompletedRounds(newCompleted);
    const winners = currentMatches.map(m => m.winner);

    // Check if we have enough qualified teams
    if (winners.length <= qualifierSlots || roundIdx + 1 >= totalRounds) {
      setFinished(true);
      setQualifiedTeams(winners.slice(0, qualifierSlots));
      setCurrentMatches([]);
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

  const simulateAll = () => {
    // Auto-simulate all remaining rounds
    let teams = qualifierPool.slice(0, Math.max(qualifierSlots * 4, 8));
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
          matches.push(simulateMatch(t1, t2, 3));
        }
      }
      allRounds.push({ name: `Runda ${allRounds.length + 1}`, matches });
      current = matches.map(m => m.winner);
    }

    setCompletedRounds(allRounds);
    setFinished(true);
    setQualifiedTeams(current.slice(0, qualifierSlots));
    setCurrentMatches([]);
    setStarted(true);
  };

  const allResolved = resolved.length > 0 && resolved.every(Boolean);
  const qualType = tournament.qualification.qualifierType === "regional" ? "Regionalne" : "Open";

  return (
    <section className="py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="p-2 rounded-md hover:bg-secondary transition-colors">
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

        {/* Invited teams info */}
        <div className="bg-card border border-win/20 rounded-lg p-4 mb-6">
          <h3 className="font-heading font-bold text-foreground flex items-center gap-2 mb-3">
            <Crown className="w-4 h-4 text-accent" />
            Zaproszone z rankingu ({invitedTeams.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {invitedTeams.map(t => (
              <span key={t} className="px-2 py-1 bg-win/10 text-win border border-win/20 rounded text-xs font-mono">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Qualifier bracket */}
        {!finished ? (
          <div className="bg-card border border-border rounded-lg p-4">
            {!started ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="font-heading text-xl font-bold text-foreground mb-2">
                  Kwalifikacje {qualType} — {qualifierSlots} miejsc
                </h3>
                <p className="text-muted-foreground mb-6">{teamsForBracket.length} drużyn walczy o {qualifierSlots} miejsc w turnieju</p>
                <div className="flex gap-3 justify-center">
                  <button onClick={start} className="flex items-center gap-2 px-6 py-3 gradient-primary text-primary-foreground rounded-md font-heading font-semibold hover:opacity-90 transition-opacity">
                    <Play className="w-4 h-4" /> Rozegraj kwalifikacje
                  </button>
                  <button onClick={simulateAll} className="flex items-center gap-2 px-6 py-3 border border-primary/30 text-primary rounded-md font-heading font-semibold hover:bg-primary/10 transition-colors">
                    <SkipForward className="w-4 h-4" /> Symuluj kwalifikacje
                  </button>
                </div>
              </div>
            ) : (
              <div>
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
                    <EditableMatch key={i} match={m} index={i} onUpdate={updateMatch} onSimulate={simulateOne} resolved={resolved[i]} />
                  ))}
                </div>
              </div>
            )}

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
        ) : (
          /* Qualification results */
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

            <div className="flex justify-center">
              <button
                onClick={() => onComplete(qualifiedTeams)}
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
