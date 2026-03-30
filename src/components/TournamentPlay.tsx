import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, MapPin, Users, Calendar, Crown, Zap, Play, SkipForward, Edit3, Check, Save, ExternalLink, Keyboard } from "lucide-react";
import { type Tournament, type TournamentSimulation, type MatchResult, type SwissResult, type SwissStanding, type SwissRound, type GroupResult, type GroupStanding, type KnockoutResult, type KnockoutRound, type MajorStage, simulateMatch, derivePlacements, teamDatabase } from "@/data/tournaments";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { type MatchStats, generateMatchStats } from "@/lib/playerStats";
import MatchStatsPanel from "@/components/MatchStatsPanel";
import TournamentRoster from "@/components/TournamentRoster";
import MapVeto from "@/components/MapVeto";

interface TournamentPlayProps {
  tournament: Tournament;
  onComplete: (sim: TournamentSimulation) => void;
  onBack: () => void;
}

// ===== Persistence =====
interface TournamentProgress {
  tournamentId: string;
  currentPhase: string;
  allMatchStats: Record<string, MatchStats>;
  swissState?: {
    standings: SwissStanding[];
    rounds: SwissRound[];
    currentMatches: MatchResult[];
    resolved: boolean[];
    finished: boolean;
    started: boolean;
  };
  knockoutState?: {
    completedRounds: KnockoutRound[];
    currentMatches: MatchResult[];
    resolved: boolean[];
    finished: boolean;
    started: boolean;
    winner: string;
    roundName: string;
  };
  knockoutTeams: string[];
  swissResult: SwissResult | null;
  groupsResult: GroupResult[] | null;
  majorStages: MajorStage[];
  groupsGenerated: boolean;
}

function saveProgress(tournamentId: string, progress: TournamentProgress) {
  try {
    localStorage.setItem(`tournament_progress_${tournamentId}`, JSON.stringify(progress));
  } catch (e) { /* ignore quota errors */ }
}

function loadProgress(tournamentId: string): TournamentProgress | null {
  try {
    const data = localStorage.getItem(`tournament_progress_${tournamentId}`);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

function clearProgress(tournamentId: string) {
  localStorage.removeItem(`tournament_progress_${tournamentId}`);
}

// ===== Editable Match Row =====
interface EditableMatchProps {
  match: MatchResult;
  index: number;
  onUpdate: (index: number, match: MatchResult) => void;
  onSimulate: (index: number) => void;
  resolved: boolean;
}

const getTeamRoster = (teamName: string): string[] => {
  const team = teamDatabase.find(t => t.name === teamName);
  return team?.roster || [teamName + "_p1", teamName + "_p2", teamName + "_p3", teamName + "_p4", teamName + "_p5"];
};

// ===== Match Detail Panel (full screen overlay) =====
const MatchDetailPanel = ({ match, onUpdate, onSimulate, resolved, matchStats, onUpdateStats, onClose }: {
  match: MatchResult;
  onUpdate: (match: MatchResult) => void;
  onSimulate: () => void;
  resolved: boolean;
  matchStats?: MatchStats | null;
  onUpdateStats?: (matchId: string, stats: MatchStats) => void;
  onClose: () => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [s1, setS1] = useState(match.score1.toString());
  const [s2, setS2] = useState(match.score2.toString());
  const [vetoCompleted, setVetoCompleted] = useState(resolved);
  const [pickedMaps, setPickedMaps] = useState<string[]>([]);

  const isBo1 = (match.bo || 1) === 1;

  const confirmScore = () => {
    const score1 = parseInt(s1) || 0;
    const score2 = parseInt(s2) || 0;
    if (score1 === score2 || score1 < 0 || score2 < 0) return;
    if (isBo1) {
      const high = Math.max(score1, score2);
      const low = Math.min(score1, score2);
      if (high < 13) return;
      // Valid winner scores: 13, 16, 19, 22... (13 + 3*n)
      if ((high - 13) % 3 !== 0) return;
      // Loser score range: for winner=13 → 0-12, for winner=16 → 12-15, etc.
      const minLoser = high === 13 ? 0 : high - 4;
      const maxLoser = high - 1;
      if (low < minLoser || low > maxLoser) return;
    }
    const winner = score1 > score2 ? match.team1 : match.team2;
    const mapScore1 = isBo1 ? 1 : score1;
    const mapScore2 = isBo1 ? 0 : score2;
    const updatedMatch = { ...match, score1: winner === match.team1 ? mapScore1 : mapScore2, score2: winner === match.team1 ? mapScore2 : mapScore1, winner };
    onUpdate(updatedMatch);
    setEditing(false);
    if (onUpdateStats) {
      const stats = generateMatchStats(match.team1, match.team2, getTeamRoster(match.team1), getTeamRoster(match.team2), isBo1 ? score1 : score1, isBo1 ? score2 : score2, match.bo);
      onUpdateStats(`${match.team1}-vs-${match.team2}`, stats);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-secondary/50 border-b border-border/50">
        <button onClick={onClose} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          Powrót
        </button>
        <span className="text-xs font-mono text-muted-foreground">BO{match.bo}</span>
      </div>

      {/* Match score display */}
      <div className="p-6">
        <div className="flex items-center justify-center gap-6">
          <div className={cn(
            "text-right flex-1",
            resolved && match.winner === match.team1 ? "text-foreground" : "text-muted-foreground"
          )}>
            <p className={cn("text-xl font-heading font-bold", resolved && match.winner === match.team1 && "text-win")}>{match.team1}</p>
          </div>

          {editing ? (
            <div className="flex flex-col items-center gap-2">
              {isBo1 && <span className="text-[10px] font-mono text-muted-foreground">Wynik rundowy (np. 13:7, dogrywka: 16:14)</span>}
              <div className="flex items-center gap-2 px-4 py-3 bg-secondary rounded-lg">
                <Input
                  value={s1}
                  onChange={(e) => setS1(e.target.value)}
                  className="w-14 h-10 text-center font-mono text-lg p-0 bg-background"
                  type="number"
                  min="0"
                />
                <span className="text-muted-foreground text-xl font-mono">:</span>
                <Input
                  value={s2}
                  onChange={(e) => setS2(e.target.value)}
                  className="w-14 h-10 text-center font-mono text-lg p-0 bg-background"
                  type="number"
                  min="0"
                />
              </div>
              <button onClick={confirmScore} className="flex items-center gap-2 px-5 py-2 gradient-primary text-primary-foreground rounded-md font-heading font-semibold hover:opacity-90 transition-opacity text-sm">
                <Check className="w-4 h-4" /> Zapisz wynik
              </button>
            </div>
          ) : (
            <div className="px-6 py-3 bg-secondary rounded-lg min-w-[100px] text-center">
              {resolved ? (
                <div className="flex items-center gap-3">
                  <span className={cn("text-2xl font-mono font-bold", match.winner === match.team1 ? "text-primary" : "text-muted-foreground")}>{match.score1}</span>
                  <span className="text-muted-foreground text-xl">:</span>
                  <span className={cn("text-2xl font-mono font-bold", match.winner === match.team2 ? "text-primary" : "text-muted-foreground")}>{match.score2}</span>
                </div>
              ) : (
                <span className="text-xl font-mono text-muted-foreground">vs</span>
              )}
            </div>
          )}

          <div className={cn(
            "text-left flex-1",
            resolved && match.winner === match.team2 ? "text-foreground" : "text-muted-foreground"
          )}>
            <p className={cn("text-xl font-heading font-bold", resolved && match.winner === match.team2 && "text-win")}>{match.team2}</p>
          </div>
        </div>

        {/* Map Veto */}
        {!resolved && !editing && !vetoCompleted && (
          <div className="mt-4">
            <MapVeto
              team1={match.team1}
              team2={match.team2}
              bo={match.bo}
              onComplete={(maps) => {
                setPickedMaps(maps);
                setVetoCompleted(true);
              }}
              onSkip={() => setVetoCompleted(true)}
            />
          </div>
        )}

        {/* Picked maps display */}
        {pickedMaps.length > 0 && !resolved && (
          <div className="flex justify-center gap-2 mt-3">
            {pickedMaps.map((m, i) => (
              <span key={i} className="text-[10px] font-mono text-win bg-win/5 px-2 py-1 rounded border border-win/20">
                Mapa {i + 1}: {m}
              </span>
            ))}
          </div>
        )}

        {/* Action buttons */}
        {!resolved && !editing && vetoCompleted && (
          <div className="flex justify-center gap-3 mt-6">
            <button
              onClick={onSimulate}
              className="flex items-center gap-2 px-6 py-3 gradient-primary text-primary-foreground rounded-md font-heading font-semibold hover:opacity-90 transition-opacity"
            >
              <Play className="w-4 h-4" />
              Symuluj mecz
            </button>
            <button
              onClick={() => { setEditing(true); setS1("0"); setS2("0"); }}
              className="flex items-center gap-2 px-6 py-3 border border-accent/30 text-accent rounded-md font-heading font-semibold hover:bg-accent/10 transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Wpisz wynik
            </button>
          </div>
        )}

        {/* Winner badge */}
        {resolved && match.winner && (
          <div className="text-center mt-4">
            <span className="text-xs font-mono text-win bg-win/10 px-3 py-1 rounded-full border border-win/20">
              Zwycięzca: {match.winner}
            </span>
          </div>
        )}
      </div>

      {/* Stats section */}
      {(resolved || editing) && (
        <div className="border-t border-border/50">
          <MatchStatsPanel
            stats={matchStats || null}
            team1={match.team1}
            team2={match.team2}
            bo={match.bo}
            onUpdateStats={onUpdateStats ? (updated) => onUpdateStats(`${match.team1}-vs-${match.team2}`, updated) : undefined}
            onCreateStats={onUpdateStats ? () => {
              const stats = generateMatchStats(match.team1, match.team2, getTeamRoster(match.team1), getTeamRoster(match.team2), match.score1 ?? 0, match.score2 ?? 0, match.bo);
              onUpdateStats!(`${match.team1}-vs-${match.team2}`, stats);
            } : undefined}
          />
        </div>
      )}
    </motion.div>
  );
};

// ===== Compact Match Card (in list) =====
const EditableMatch = ({ match, index, onUpdate, onSimulate, resolved, matchStats, onUpdateStats, onOpenDetail }: EditableMatchProps & {
  matchStats?: MatchStats | null;
  onUpdateStats?: (matchId: string, stats: MatchStats) => void;
  onOpenDetail?: () => void;
}) => {
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
    <div className={cn(
      "bg-card border rounded-md overflow-hidden text-sm transition-all",
      resolved ? "border-win/20" : "border-primary/30"
    )}>
      <div className="flex items-center">
        <div className={cn(
          "flex-1 px-3 py-2 text-right truncate font-medium",
          resolved && match.winner === match.team1 ? "text-foreground font-bold" : "text-muted-foreground"
        )}>
          {match.team1}
        </div>

        <div className="px-3 py-2 font-mono text-xs bg-secondary min-w-[60px] text-center">
          {resolved ? (
            <>
              <span className={match.winner === match.team1 ? "text-primary font-bold" : "text-muted-foreground"}>{match.score1}</span>
              <span className="text-muted-foreground mx-1">:</span>
              <span className={match.winner === match.team2 ? "text-primary font-bold" : "text-muted-foreground"}>{match.score2}</span>
            </>
          ) : (
            <span className="text-muted-foreground">vs</span>
          )}
        </div>

        <div className={cn(
          "flex-1 px-3 py-2 truncate font-medium",
          resolved && match.winner === match.team2 ? "text-foreground font-bold" : "text-muted-foreground"
        )}>
          {match.team2}
        </div>
      </div>

      {/* "Go to match" button */}
      <button
        onClick={onOpenDetail}
        className="flex items-center justify-center gap-1.5 w-full px-2 py-1.5 text-xs font-mono text-primary hover:bg-primary/10 transition-colors border-t border-border/50"
      >
        <ExternalLink className="w-3 h-3" />
        Przejdź do meczu
      </button>
    </div>
  );
};

// ===== Swiss Play =====
function useSwissPlay(teams: string[], initial?: TournamentProgress["swissState"]) {
  const [standings, setStandings] = useState<SwissStanding[]>(
    initial?.standings || teams.map(t => ({ team: t, wins: 0, losses: 0, qualified: false, eliminated: false }))
  );
  const [rounds, setRounds] = useState<SwissRound[]>(initial?.rounds || []);
  const [currentMatches, setCurrentMatches] = useState<MatchResult[]>(initial?.currentMatches || []);
  const [resolved, setResolved] = useState<boolean[]>(initial?.resolved || []);
  const [finished, setFinished] = useState(initial?.finished || false);
  const [started, setStarted] = useState(initial?.started || false);

  const winsToQ = 3;
  const lossesToE = 3;

  const generateRound = useCallback((currentStandings: SwissStanding[]) => {
    const active = currentStandings.filter(s => !s.qualified && !s.eliminated);
    if (active.length < 2) {
      setFinished(true);
      return;
    }

    const byRecord: Record<string, SwissStanding[]> = {};
    active.forEach(s => {
      const key = `${s.wins}-${s.losses}`;
      if (!byRecord[key]) byRecord[key] = [];
      byRecord[key].push(s);
    });

    const records = Object.keys(byRecord).sort((a, b) => {
      const [aw] = a.split("-").map(Number);
      const [bw] = b.split("-").map(Number);
      return bw - aw;
    });

    const matches: MatchResult[] = [];
    const paired = new Set<string>();
    let unpaired: SwissStanding[] = [];

    for (const record of records) {
      const pool = [...unpaired, ...byRecord[record]].sort(() => Math.random() - 0.5);
      unpaired = [];
      for (let i = 0; i < pool.length - 1; i += 2) {
        if (paired.has(pool[i].team) || paired.has(pool[i + 1].team)) {
          if (!paired.has(pool[i].team)) unpaired.push(pool[i]);
          if (!paired.has(pool[i + 1].team)) unpaired.push(pool[i + 1]);
          continue;
        }
        const isDecider = pool[i].wins === winsToQ - 1 || pool[i].losses === lossesToE - 1;
        const bo = isDecider ? 3 : 1;
        matches.push({ team1: pool[i].team, team2: pool[i + 1].team, score1: 0, score2: 0, winner: "", bo });
        paired.add(pool[i].team);
        paired.add(pool[i + 1].team);
      }
      if (pool.length % 2 === 1 && !paired.has(pool[pool.length - 1].team)) {
        unpaired.push(pool[pool.length - 1]);
      }
    }

    if (matches.length === 0) {
      setFinished(true);
      return;
    }

    setCurrentMatches(matches);
    setResolved(new Array(matches.length).fill(false));
  }, []);

  const start = useCallback(() => {
    setStarted(true);
    if (!initial?.started) {
      generateRound(standings);
    }
  }, [standings, generateRound, initial]);

  const updateMatch = useCallback((idx: number, match: MatchResult) => {
    setCurrentMatches(prev => {
      const next = [...prev];
      next[idx] = match;
      return next;
    });
    setResolved(prev => {
      const next = [...prev];
      next[idx] = true;
      return next;
    });
  }, []);

  const simulateOne = useCallback((idx: number) => {
    const m = currentMatches[idx];
    const result = simulateMatch(m.team1, m.team2, m.bo);
    updateMatch(idx, result);
  }, [currentMatches, updateMatch]);

  const simulateAllCurrent = useCallback(() => {
    const next = [...currentMatches];
    const res = [...resolved];
    next.forEach((m, i) => {
      if (!res[i]) {
        const result = simulateMatch(m.team1, m.team2, m.bo);
        next[i] = result;
        res[i] = true;
      }
    });
    setCurrentMatches(next);
    setResolved(res);
  }, [currentMatches, resolved]);

  const advanceRound = useCallback(() => {
    const newStandings = [...standings];
    currentMatches.forEach(m => {
      const ws = newStandings.find(s => s.team === m.winner)!;
      const loser = m.winner === m.team1 ? m.team2 : m.team1;
      const ls = newStandings.find(s => s.team === loser)!;
      ws.wins++;
      ls.losses++;
      if (ws.wins >= winsToQ) ws.qualified = true;
      if (ls.losses >= lossesToE) ls.eliminated = true;
    });

    const roundNum = rounds.length + 1;
    const newRounds = [...rounds, { roundNumber: roundNum, matches: currentMatches }];

    setStandings(newStandings);
    setRounds(newRounds);

    const remaining = newStandings.filter(s => !s.qualified && !s.eliminated);
    if (remaining.length < 2) {
      setFinished(true);
      setCurrentMatches([]);
    } else {
      generateRound(newStandings);
    }
  }, [standings, currentMatches, rounds, generateRound]);

  const allResolved = resolved.length > 0 && resolved.every(Boolean);

  const result: SwissResult | null = finished ? {
    rounds: [...rounds, ...(currentMatches.length > 0 ? [{ roundNumber: rounds.length + 1, matches: currentMatches }] : [])],
    standings: [...standings].sort((a, b) => b.wins - a.wins || a.losses - b.losses),
    qualified: standings.filter(s => s.qualified).map(s => s.team),
    eliminated: standings.filter(s => s.eliminated).map(s => s.team),
  } : null;

  const getState = useCallback(() => ({
    standings, rounds, currentMatches, resolved, finished, started,
  }), [standings, rounds, currentMatches, resolved, finished, started]);

  return { standings, rounds, currentMatches, resolved, finished, started, start, updateMatch, simulateOne, simulateAllCurrent, advanceRound, allResolved, result, getState };
}

// ===== Knockout Play =====
function useKnockoutPlay(initialTeams: string[], startBo = 3, initial?: TournamentProgress["knockoutState"]) {
  const [completedRounds, setCompletedRounds] = useState<KnockoutRound[]>(initial?.completedRounds || []);
  const [currentMatches, setCurrentMatches] = useState<MatchResult[]>(initial?.currentMatches || []);
  const [resolved, setResolved] = useState<boolean[]>(initial?.resolved || []);
  const [finished, setFinished] = useState(initial?.finished || false);
  const [started, setStarted] = useState(initial?.started || false);
  const [winner, setWinner] = useState<string>(initial?.winner || "");
  const [roundName, setRoundName] = useState(initial?.roundName || "");

  // Pad to power of 2
  let size = 2;
  while (size < initialTeams.length) size *= 2;
  const paddedTeams = [...initialTeams];
  while (paddedTeams.length < size) paddedTeams.push("BYE");
  const totalRounds = Math.log2(size);

  const getRoundName = (roundIdx: number): string => {
    const remaining = size / Math.pow(2, roundIdx);
    if (remaining === 2) return "Grand Final";
    if (remaining === 4) return "Półfinały";
    if (remaining === 8) return "Ćwierćfinały";
    if (remaining === 16) return "1/8 Finału";
    return `Runda ${roundIdx + 1}`;
  };

  const start = useCallback(() => {
    if (initial?.started) {
      setStarted(true);
      return;
    }
    setStarted(true);
    const name = getRoundName(0);
    setRoundName(name);
    const matches: MatchResult[] = [];
    for (let i = 0; i < paddedTeams.length; i += 2) {
      const t1 = paddedTeams[i];
      const t2 = paddedTeams[i + 1];
      if (t2 === "BYE") {
        matches.push({ team1: t1, team2: "BYE", score1: 2, score2: 0, winner: t1, bo: startBo });
      } else {
        const bo = totalRounds <= 1 ? 5 : startBo;
        matches.push({ team1: t1, team2: t2, score1: 0, score2: 0, winner: "", bo });
      }
    }
    setCurrentMatches(matches);
    setResolved(matches.map(m => m.team2 === "BYE"));
  }, [paddedTeams, totalRounds, startBo, initial]);

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
        const r = simulateMatch(m.team1, m.team2, m.bo);
        next[i] = r;
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
    if (winners.length <= 1) {
      setFinished(true);
      setWinner(winners[0] || "");
      setCurrentMatches([]);
      return;
    }

    const nextRoundIdx = roundIdx + 1;
    if (nextRoundIdx >= totalRounds) {
      setFinished(true);
      setWinner(winners[0] || "");
      setCurrentMatches([]);
      return;
    }

    const name = getRoundName(nextRoundIdx);
    setRoundName(name);
    const isFinal = nextRoundIdx === totalRounds - 1;
    const isSemi = nextRoundIdx >= totalRounds - 2;
    const bo = isFinal ? 5 : isSemi ? 3 : startBo;
    const matches: MatchResult[] = [];
    for (let i = 0; i < winners.length; i += 2) {
      const t1 = winners[i];
      const t2 = winners[i + 1] || "BYE";
      if (t2 === "BYE") {
        matches.push({ team1: t1, team2: "BYE", score1: 2, score2: 0, winner: t1, bo });
      } else {
        matches.push({ team1: t1, team2: t2, score1: 0, score2: 0, winner: "", bo });
      }
    }
    setCurrentMatches(matches);
    setResolved(matches.map(m => m.team2 === "BYE"));
  }, [completedRounds, currentMatches, roundName, totalRounds, startBo]);

  const allResolved = resolved.length > 0 && resolved.every(Boolean);

  const result: KnockoutResult | null = finished ? {
    rounds: completedRounds,
    winner,
  } : null;

  const getState = useCallback(() => ({
    completedRounds, currentMatches, resolved, finished, started, winner, roundName,
  }), [completedRounds, currentMatches, resolved, finished, started, winner, roundName]);

  return { completedRounds, currentMatches, resolved, finished, started, start, updateMatch, simulateOne, simulateAllCurrent, advanceRound, allResolved, result, roundName, winner, getState };
}

// ===== Main TournamentPlay Component =====

const TournamentPlay = ({ tournament, onComplete, onBack }: TournamentPlayProps) => {
  const teams = tournament.participants.slice(0, tournament.teams);
  const format = tournament.format;

  // Load saved progress
  const savedProgress = useRef(loadProgress(tournament.id));

  const [allMatchStats, setAllMatchStats] = useState<Record<string, MatchStats>>(
    savedProgress.current?.allMatchStats || {}
  );

  // State for multi-phase tournaments
  const [swissResult, setSwissResult] = useState<SwissResult | null>(savedProgress.current?.swissResult || null);
  const [groupsResult, setGroupsResult] = useState<GroupResult[] | null>(savedProgress.current?.groupsResult || null);
  const [majorStages, setMajorStages] = useState<MajorStage[]>(savedProgress.current?.majorStages || []);
  const [groupsGenerated, setGroupsGenerated] = useState(savedProgress.current?.groupsGenerated || false);

  // Determine initial phase
  const initialPhase = savedProgress.current?.currentPhase || (
    format === "knockout" ? "knockout"
    : format === "swiss+knockout" || format === "league" ? "swiss"
    : format === "groups+knockout" ? "groups"
    : format === "major" ? "major-s1"
    : "knockout"
  );

  const [currentPhase, setCurrentPhase] = useState(initialPhase);

  // Swiss hook (used for swiss phases)
  const swissTeams = currentPhase === "major-s1"
    ? teams.slice(8, 24).length >= 16 ? teams.slice(8, 24) : teams.slice(Math.max(0, teams.length - 16))
    : currentPhase === "major-s2"
    ? [...teams.slice(0, 8), ...(swissResult?.qualified.slice(0, 8) || [])]
    : teams;

  const swissInitial = savedProgress.current?.currentPhase === currentPhase ? savedProgress.current?.swissState : undefined;
  const swiss = useSwissPlay(swissTeams, swissInitial);

  // Knockout hook — initialize from participants for pure knockout format
  const [knockoutTeams, setKnockoutTeams] = useState<string[]>(() => {
    if (savedProgress.current?.knockoutTeams && savedProgress.current.knockoutTeams.length > 0) {
      return savedProgress.current.knockoutTeams;
    }
    // For knockout-only format, use all participants directly
    if (format === "knockout") return teams;
    return [];
  });
  const knockoutInitial = savedProgress.current?.currentPhase === currentPhase ? savedProgress.current?.knockoutState : undefined;
  const knockout = useKnockoutPlay(knockoutTeams.length > 0 ? knockoutTeams : ["TBD", "TBD"], 3, knockoutInitial);

  // Auto-save progress on state changes
  useEffect(() => {
    const progress: TournamentProgress = {
      tournamentId: tournament.id,
      currentPhase,
      allMatchStats,
      swissState: swiss.getState(),
      knockoutState: knockout.getState(),
      knockoutTeams,
      swissResult,
      groupsResult,
      majorStages,
      groupsGenerated,
    };
    saveProgress(tournament.id, progress);
  }, [
    currentPhase, allMatchStats, knockoutTeams, swissResult, groupsResult, majorStages, groupsGenerated,
    swiss.standings, swiss.rounds, swiss.currentMatches, swiss.resolved, swiss.finished, swiss.started,
    knockout.completedRounds, knockout.currentMatches, knockout.resolved, knockout.finished, knockout.started, knockout.winner, knockout.roundName,
    tournament.id,
  ]);

  // Stats helpers
  const handleUpdateStats = useCallback((matchId: string, stats: MatchStats) => {
    setAllMatchStats(prev => ({ ...prev, [matchId]: stats }));
  }, []);

  const getStatsForMatch = (m: MatchResult): MatchStats | null => {
    return allMatchStats[`${m.team1}-vs-${m.team2}`] || null;
  };

  // Active match detail state: { source: "swiss"|"knockout", index: number }
  const [activeMatchDetail, setActiveMatchDetail] = useState<{ source: string; index: number } | null>(null);

  // Wrap swiss simulate to generate stats
  const wrappedSwissSimulateOne = useCallback((idx: number) => {
    swiss.simulateOne(idx);
    setTimeout(() => {
      swiss.currentMatches.forEach((m) => {
        if (m.winner && !allMatchStats[`${m.team1}-vs-${m.team2}`]) {
          const stats = generateMatchStats(m.team1, m.team2, getTeamRoster(m.team1), getTeamRoster(m.team2), m.score1, m.score2, m.bo);
          setAllMatchStats(prev => ({ ...prev, [`${m.team1}-vs-${m.team2}`]: stats }));
        }
      });
    }, 0);
  }, [swiss, allMatchStats]);

  const handleSwissComplete = () => {
    if (!swiss.result) return;
    const sr = swiss.result;

    if (currentPhase === "swiss" && (format === "swiss+knockout" || format === "league")) {
      setSwissResult(sr);
      setKnockoutTeams(sr.qualified.slice(0, 8));
      setCurrentPhase("knockout");
    } else if (currentPhase === "major-s1") {
      const stage: MajorStage = {
        name: "Stage 1: Challengers",
        type: "swiss",
        swiss: sr,
        participants: swissTeams,
      };
      setMajorStages([stage]);
      setSwissResult(sr);
      setCurrentPhase("major-s2");
    } else if (currentPhase === "major-s2") {
      const stage: MajorStage = {
        name: "Stage 2: Legends",
        type: "swiss",
        swiss: sr,
        participants: swissTeams,
      };
      setMajorStages(prev => [...prev, stage]);
      setKnockoutTeams(sr.qualified.slice(0, 8));
      setCurrentPhase("major-playoffs");
    }
  };

  const handleKnockoutComplete = () => {
    if (!knockout.result) return;
    const kr = knockout.result;

    let sim: TournamentSimulation;
    if (format === "knockout") {
      sim = { tournamentId: tournament.id, format: "knockout", knockout: kr, winner: kr.winner, placements: [] };
    } else if (format === "swiss+knockout" || format === "league") {
      sim = { tournamentId: tournament.id, format: format as any, swiss: swissResult!, knockout: kr, winner: kr.winner, placements: [] };
    } else if (format === "groups+knockout") {
      sim = { tournamentId: tournament.id, format: "groups+knockout", groups: groupsResult!, knockout: kr, winner: kr.winner, placements: [] };
    } else if (format === "major") {
      const playoffStage: MajorStage = {
        name: "Stage 3: Champions (Playoffs)",
        type: "knockout",
        knockout: kr,
        participants: knockoutTeams,
      };
      const allStages = [...majorStages, playoffStage];
      sim = { tournamentId: tournament.id, format: "major", majorStages: allStages, winner: kr.winner, placements: [] };
    } else {
      sim = { tournamentId: tournament.id, format: format, knockout: kr, winner: kr.winner, placements: [] };
    }

    sim.placements = derivePlacements(sim, tournament);
    clearProgress(tournament.id);
    onComplete(sim);
  };

  // Groups: auto-simulate groups, then go to knockout
  const generateGroups = () => {
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    const groupCount = teams.length <= 8 ? 2 : 4;
    const perGroup = Math.ceil(shuffled.length / groupCount);
    const groups: GroupResult[] = [];

    for (let g = 0; g < groupCount; g++) {
      const groupTeams = shuffled.slice(g * perGroup, (g + 1) * perGroup);
      const groupName = String.fromCharCode(65 + g);
      const matches: MatchResult[] = [];
      for (let i = 0; i < groupTeams.length; i++) {
        for (let j = i + 1; j < groupTeams.length; j++) {
          matches.push(simulateMatch(groupTeams[i], groupTeams[j], 1));
        }
      }
      const standingsMap: Record<string, GroupStanding> = {};
      groupTeams.forEach(t => { standingsMap[t] = { team: t, wins: 0, losses: 0, roundDiff: 0 }; });
      matches.forEach(m => {
        standingsMap[m.winner].wins++;
        const loser = m.winner === m.team1 ? m.team2 : m.team1;
        standingsMap[loser].losses++;
        standingsMap[m.team1].roundDiff += m.score1 - m.score2;
        standingsMap[m.team2].roundDiff += m.score2 - m.score1;
      });
      const sorted = Object.values(standingsMap).sort((a, b) => b.wins - a.wins || b.roundDiff - a.roundDiff);
      const qualified = sorted.slice(0, 2).map(s => s.team);
      groups.push({ groupName, teams: groupTeams, matches, standings: sorted, qualified });
    }

    setGroupsResult(groups);
    setGroupsGenerated(true);
    const advanced = groups.flatMap(g => g.qualified);
    setKnockoutTeams(advanced);
  };

  const handleBack = () => {
    // Progress is auto-saved via useEffect
    onBack();
  };

  const tierColor = tournament.tier === "S" ? "text-accent" : tournament.tier === "A" ? "text-primary" : "text-silver";

  const phaseLabel = currentPhase === "swiss" ? "Faza Swiss"
    : currentPhase === "groups" ? "Faza Grupowa"
    : currentPhase === "knockout" || currentPhase === "major-playoffs" ? "Playoffs"
    : currentPhase === "major-s1" ? "Stage 1: Challengers (Swiss)"
    : currentPhase === "major-s2" ? "Stage 2: Legends (Swiss)"
    : "Turniej";

  // Render Swiss Phase
  const renderSwissPhase = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-xl font-bold text-foreground">{phaseLabel}</h3>
        <div className="flex gap-2">
          {!swiss.started && (
            <button onClick={swiss.start} className="flex items-center gap-2 px-4 py-2 rounded-md font-heading font-semibold text-sm gradient-primary text-primary-foreground hover:opacity-90">
              <Play className="w-4 h-4" />
              Rozpocznij
            </button>
          )}
          {swiss.started && !swiss.finished && swiss.currentMatches.length > 0 && (
            <button onClick={swiss.simulateAllCurrent} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono border border-primary/30 text-primary hover:bg-primary/10">
              <SkipForward className="w-3.5 h-3.5" />
              Symuluj rundę
            </button>
          )}
          {swiss.started && !swiss.finished && swiss.allResolved && (
            <button onClick={swiss.advanceRound} className="flex items-center gap-2 px-4 py-2 rounded-md font-heading font-semibold text-sm gradient-primary text-primary-foreground hover:opacity-90">
              Następna runda →
            </button>
          )}
          {swiss.finished && (
            <button onClick={handleSwissComplete} className="flex items-center gap-2 px-4 py-2 rounded-md font-heading font-semibold text-sm gradient-primary text-primary-foreground hover:opacity-90">
              <Zap className="w-4 h-4" />
              Przejdź do Playoffs →
            </button>
          )}
        </div>
      </div>

      {/* Standings */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-1 px-4 py-2 bg-secondary/50 text-xs font-mono text-muted-foreground uppercase">
          <div className="col-span-1">#</div>
          <div className="col-span-7">Drużyna</div>
          <div className="col-span-2 text-center">W-L</div>
          <div className="col-span-2 text-center">Status</div>
        </div>
        {swiss.standings
          .filter(s => s.wins > 0 || s.losses > 0 || swiss.started)
          .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
          .map((s, i) => (
            <div key={s.team} className={cn(
              "grid grid-cols-12 gap-1 px-4 py-2 border-t border-border/50 items-center text-sm",
              s.qualified && "bg-win/5",
              s.eliminated && "bg-destructive/5 opacity-60"
            )}>
              <div className="col-span-1 font-mono text-muted-foreground">{i + 1}</div>
              <div className="col-span-7 font-medium text-foreground truncate">{s.team}</div>
              <div className="col-span-2 text-center font-mono">
                <span className="text-win">{s.wins}</span>
                <span className="text-muted-foreground">-</span>
                <span className="text-loss">{s.losses}</span>
              </div>
              <div className="col-span-2 text-center">
                {s.qualified && <span className="text-xs font-mono text-win bg-win/10 px-2 py-0.5 rounded border border-win/30">✓</span>}
                {s.eliminated && <span className="text-xs font-mono text-loss bg-destructive/10 px-2 py-0.5 rounded border border-destructive/30">✗</span>}
              </div>
            </div>
          ))}
      </div>

      {/* Completed rounds */}
      {swiss.rounds.map(round => (
        <div key={round.roundNumber}>
          <h4 className="font-heading text-sm font-bold text-muted-foreground mb-2 uppercase tracking-wider">
            Runda {round.roundNumber} (zakończona)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 opacity-70">
            {round.matches.map((m, i) => (
              <div key={i} className="flex items-center bg-card border border-border/50 rounded-md overflow-hidden text-sm">
                <div className={cn("flex-1 px-3 py-2 text-right truncate font-medium", m.winner === m.team1 ? "text-foreground font-bold" : "text-muted-foreground")}>{m.team1}</div>
                <div className="px-3 py-2 font-mono text-xs bg-secondary min-w-[60px] text-center">
                  <span className={m.winner === m.team1 ? "text-primary font-bold" : "text-muted-foreground"}>{m.score1}</span>
                  <span className="text-muted-foreground mx-1">:</span>
                  <span className={m.winner === m.team2 ? "text-primary font-bold" : "text-muted-foreground"}>{m.score2}</span>
                </div>
                <div className={cn("flex-1 px-3 py-2 truncate font-medium", m.winner === m.team2 ? "text-foreground font-bold" : "text-muted-foreground")}>{m.team2}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Current round */}
      {swiss.started && !swiss.finished && swiss.currentMatches.length > 0 && (
        <div>
          <h4 className="font-heading text-sm font-bold text-primary mb-2 uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Runda {swiss.rounds.length + 1}
            {swiss.currentMatches[0]?.bo > 1 ? ` (BO${swiss.currentMatches[0].bo})` : " (BO1)"}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {swiss.currentMatches.map((m, i) => (
              <EditableMatch
                key={`${m.team1}-${m.team2}-${i}`}
                match={m}
                index={i}
                onUpdate={swiss.updateMatch}
                onSimulate={swiss.simulateOne}
                resolved={swiss.resolved[i]}
                matchStats={getStatsForMatch(m)}
                onUpdateStats={handleUpdateStats}
                onOpenDetail={() => setActiveMatchDetail({ source: "swiss", index: i })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Render Knockout Phase
  const renderKnockoutPhase = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
          <Trophy className="w-5 h-5 text-accent" />
          {phaseLabel}
        </h3>
        <div className="flex gap-2">
          {!knockout.started && knockoutTeams.length > 0 && (
            <button onClick={knockout.start} className="flex items-center gap-2 px-4 py-2 rounded-md font-heading font-semibold text-sm gradient-primary text-primary-foreground hover:opacity-90">
              <Play className="w-4 h-4" />
              Rozpocznij Playoffs
            </button>
          )}
          {knockout.started && !knockout.finished && knockout.currentMatches.length > 0 && (
            <button onClick={knockout.simulateAllCurrent} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono border border-primary/30 text-primary hover:bg-primary/10">
              <SkipForward className="w-3.5 h-3.5" />
              Symuluj rundę
            </button>
          )}
          {knockout.started && !knockout.finished && knockout.allResolved && (
            <button onClick={knockout.advanceRound} className="flex items-center gap-2 px-4 py-2 rounded-md font-heading font-semibold text-sm gradient-primary text-primary-foreground hover:opacity-90">
              Następna runda →
            </button>
          )}
          {knockout.finished && (
            <button onClick={handleKnockoutComplete} className="flex items-center gap-2 px-4 py-2 rounded-md font-heading font-semibold text-sm bg-accent text-accent-foreground hover:opacity-90">
              <Crown className="w-4 h-4" />
              Zakończ turniej
            </button>
          )}
        </div>
      </div>

      {/* Winner */}
      {knockout.finished && knockout.winner && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-6 rounded-lg border border-accent/30 bg-accent/5 text-center">
          <Crown className="w-8 h-8 text-accent mx-auto mb-2" />
          <p className="text-xs font-mono text-accent uppercase tracking-widest mb-1">Zwycięzca</p>
          <p className="text-3xl font-heading font-bold text-foreground">{knockout.winner}</p>
        </motion.div>
      )}

      {/* Completed rounds */}
      {knockout.completedRounds.map((round, ri) => (
        <div key={ri}>
          <h4 className="font-heading text-sm font-bold text-muted-foreground mb-2 uppercase tracking-wider">
            {round.name} (zakończona)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 opacity-70">
            {round.matches.filter(m => m.team2 !== "BYE").map((m, i) => (
              <div key={i} className="flex items-center bg-card border border-border/50 rounded-md overflow-hidden text-sm">
                <div className={cn("flex-1 px-3 py-2 text-right truncate font-medium", m.winner === m.team1 ? "text-foreground font-bold" : "text-muted-foreground")}>{m.team1}</div>
                <div className="px-3 py-2 font-mono text-xs bg-secondary min-w-[60px] text-center">
                  <span className={m.winner === m.team1 ? "text-primary font-bold" : "text-muted-foreground"}>{m.score1}</span>
                  <span className="text-muted-foreground mx-1">:</span>
                  <span className={m.winner === m.team2 ? "text-primary font-bold" : "text-muted-foreground"}>{m.score2}</span>
                </div>
                <div className={cn("flex-1 px-3 py-2 truncate font-medium", m.winner === m.team2 ? "text-foreground font-bold" : "text-muted-foreground")}>{m.team2}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Current round */}
      {knockout.started && !knockout.finished && knockout.currentMatches.length > 0 && (
        <div>
          <h4 className="font-heading text-sm font-bold text-primary mb-2 uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4" />
            {knockout.roundName}
            {knockout.currentMatches[0]?.bo > 1 ? ` (BO${knockout.currentMatches[0].bo})` : ""}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {knockout.currentMatches.filter(m => m.team2 !== "BYE").map((m, i) => (
              <EditableMatch
                key={`${m.team1}-${m.team2}-${i}`}
                match={m}
                index={i}
                onUpdate={knockout.updateMatch}
                onSimulate={knockout.simulateOne}
                resolved={knockout.resolved[i]}
                matchStats={getStatsForMatch(m)}
                onUpdateStats={handleUpdateStats}
                onOpenDetail={() => setActiveMatchDetail({ source: "knockout", index: i })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Render Groups Phase
  const renderGroupsPhase = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-xl font-bold text-foreground">Faza Grupowa</h3>
        {!groupsGenerated && (
          <button onClick={generateGroups} className="flex items-center gap-2 px-4 py-2 rounded-md font-heading font-semibold text-sm gradient-primary text-primary-foreground hover:opacity-90">
            <Play className="w-4 h-4" />
            Losuj i rozegraj grupy
          </button>
        )}
        {groupsGenerated && (
          <button onClick={() => setCurrentPhase("knockout")} className="flex items-center gap-2 px-4 py-2 rounded-md font-heading font-semibold text-sm gradient-primary text-primary-foreground hover:opacity-90">
            <Zap className="w-4 h-4" />
            Przejdź do Playoffs →
          </button>
        )}
      </div>

      {groupsResult && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {groupsResult.map(group => (
            <div key={group.groupName} className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-secondary/50 font-heading font-bold text-foreground">
                Grupa {group.groupName}
              </div>
              {group.standings.map((s, i) => {
                const isQualified = group.qualified.includes(s.team);
                return (
                  <div key={s.team} className={cn(
                    "grid grid-cols-12 gap-1 px-4 py-2 border-t border-border/50 items-center text-sm",
                    isQualified && "bg-win/5"
                  )}>
                    <div className="col-span-1 font-mono text-muted-foreground">{i + 1}</div>
                    <div className="col-span-6 font-medium text-foreground truncate">{s.team}</div>
                    <div className="col-span-2 text-center font-mono text-sm">
                      <span className="text-win">{s.wins}</span>
                      <span className="text-muted-foreground">-</span>
                      <span className="text-loss">{s.losses}</span>
                    </div>
                    <div className="col-span-1 text-center font-mono text-xs text-muted-foreground">{s.roundDiff > 0 ? "+" : ""}{s.roundDiff}</div>
                    <div className="col-span-2 text-center">
                      {isQualified && <span className="text-xs font-mono text-win">✓ AWA</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <button onClick={handleBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            Powrót do listy turniejów
          </button>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
            <Save className="w-3 h-3" />
            Postęp zapisywany automatycznie
          </div>
        </div>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <span className={cn("font-heading font-bold text-2xl", tierColor)}>{tournament.tier}-Tier</span>
            <span className="text-xs font-mono px-2 py-1 rounded border bg-primary/10 text-primary border-primary/30">ROZGRYWANIE</span>
          </div>
          <h2 className="text-4xl font-heading font-bold text-foreground mb-2">{tournament.name}</h2>
          <div className="flex flex-wrap gap-6 text-sm mt-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Trophy className="w-4 h-4 text-accent" />
              <span className="font-mono text-foreground">{tournament.prizePool}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{tournament.teams} drużyn</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>{tournament.location}</span>
            </div>
          </div>
        </motion.div>

        {/* Roster preview */}
        <TournamentRoster tournament={tournament} participants={teams} />

        {/* Match Detail Panel */}
        {activeMatchDetail && (() => {
          const src = activeMatchDetail.source;
          const idx = activeMatchDetail.index;
          const matches = src === "swiss" ? swiss.currentMatches : knockout.currentMatches;
          const resolvedArr = src === "swiss" ? swiss.resolved : knockout.resolved;
          const updateFn = src === "swiss" ? swiss.updateMatch : knockout.updateMatch;
          const simFn = src === "swiss" ? swiss.simulateOne : knockout.simulateOne;
          const m = matches[idx];
          if (!m) { setActiveMatchDetail(null); return null; }
          return (
            <MatchDetailPanel
              match={m}
              onUpdate={(updated) => updateFn(idx, updated)}
              onSimulate={() => simFn(idx)}
              resolved={resolvedArr[idx]}
              matchStats={getStatsForMatch(m)}
              onUpdateStats={handleUpdateStats}
              onClose={() => setActiveMatchDetail(null)}
            />
          );
        })()}

        {/* Phase content (hidden when match detail is open) */}
        {!activeMatchDetail && (
          <>
            {(currentPhase === "swiss" || currentPhase === "major-s1" || currentPhase === "major-s2") && renderSwissPhase()}
            {currentPhase === "groups" && renderGroupsPhase()}
            {(currentPhase === "knockout" || currentPhase === "major-playoffs") && renderKnockoutPhase()}
          </>
        )}
      </div>
    </section>
  );
};

export default TournamentPlay;
