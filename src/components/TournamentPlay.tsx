import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, MapPin, Users, Calendar, Crown, Zap, Play, SkipForward, Edit3, Check, Save, ExternalLink, Keyboard } from "lucide-react";
import { type Tournament, type TournamentSimulation, type TournamentFormat, type MatchResult, type SwissResult, type SwissStanding, type SwissRound, type GroupResult, type GroupStanding, type KnockoutResult, type KnockoutRound, type MajorStage, simulateMatch, derivePlacements, teamDatabase } from "@/data/tournaments";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { type MatchStats, generateMatchStats } from "@/lib/playerStats";
import MatchStatsPanel from "@/components/MatchStatsPanel";
import TournamentRoster from "@/components/TournamentRoster";
import MapVeto from "@/components/MapVeto";
import GroupDrawCeremony from "@/components/GroupDrawCeremony";
import PlayoffBracket from "@/components/PlayoffBracket";
import { scheduleDeviceBackup } from "@/lib/deviceBackup";
import { isOpenSlot } from "@/lib/openSlots";
import { DEVICE_STORE_REF, getCachedDeviceValue, removeDeviceValue, setDeviceValue } from "@/lib/deviceStore";

interface TournamentPlayProps {
  tournament: Tournament;
  onComplete: (sim: TournamentSimulation, matchStats?: Record<string, MatchStats>) => void;
  onBack: () => void;
  onLiveUpdate?: (sim: TournamentSimulation) => void;
}

// ===== Persistence =====
type GslGroupState = {
  groupName: string;
  teams: string[];
  matches: MatchResult[];
  phase: number;
  qualified: string[];
  eliminated: string[];
  is3Team?: boolean;
};

interface TournamentProgress {
  tournamentId: string;
  participants: string[];
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
  gslGroups: GslGroupState[];
  majorStages: MajorStage[];
}

function saveProgress(tournamentId: string, progress: TournamentProgress) {
  const key = `tournament_progress_${tournamentId}`;
  try {
    const serialized = JSON.stringify(progress);
    void setDeviceValue(key, serialized).catch(error => console.error("Tournament progress device save failed:", error));
    try { localStorage.setItem(key, serialized.length > 120_000 ? DEVICE_STORE_REF : serialized); }
    catch { try { localStorage.setItem(key, DEVICE_STORE_REF); } catch { /* device cache only */ } }
    scheduleDeviceBackup();
  } catch (e) { /* ignore quota errors */ }
}

function loadProgress(tournamentId: string): TournamentProgress | null {
  const key = `tournament_progress_${tournamentId}`;
  try {
    const data = localStorage.getItem(key);
    if (data === DEVICE_STORE_REF) {
      const cached = getCachedDeviceValue(key);
      return cached ? JSON.parse(cached) : null;
    }
    if (!data) {
      const cached = getCachedDeviceValue(key);
      return cached ? JSON.parse(cached) : null;
    }
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

function clearProgress(tournamentId: string) {
  const key = `tournament_progress_${tournamentId}`;
  localStorage.removeItem(key);
  void removeDeviceValue(key).catch(() => undefined);
  scheduleDeviceBackup();
}

function hasSameParticipants(savedParticipants: string[] | undefined, currentParticipants: string[]): boolean {
  if (!savedParticipants || savedParticipants.length === 0) return false;

  const saved = [...savedParticipants].filter(Boolean).sort();
  const current = [...currentParticipants].filter(Boolean).sort();

  return saved.length === current.length && saved.every((team, index) => team === current[index]);
}

function getSavedProgress(tournamentId: string, participants: string[]): TournamentProgress | null {
  const progress = loadProgress(tournamentId);
  if (!progress) return null;

  if (!hasSameParticipants(progress.participants, participants)) {
    clearProgress(tournamentId);
    return null;
  }

  return progress;
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
    if (isBo1) {
      const updatedMatch = { ...match, score1: 1, score2: 0, winner, mapScore1: winner === match.team1 ? score1 : score2, mapScore2: winner === match.team1 ? score2 : score1 };
      onUpdate(updatedMatch);
    } else {
      const updatedMatch = { ...match, score1: winner === match.team1 ? score1 : score2, score2: winner === match.team1 ? score2 : score1, winner };
      onUpdate(updatedMatch);
    }
    setEditing(false);
    if (onUpdateStats) {
      const stats = generateMatchStats(match.team1, match.team2, getTeamRoster(match.team1), getTeamRoster(match.team2), score1, score2, match.bo);
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
              {isBo1 && <span className="text-xs font-mono text-muted-foreground">Wynik rundowy (np. 13:7, dogrywka: 16:14)</span>}
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
              {resolved ? (() => {
                const [ds1, ds2] = getDisplayScores(match);
                return (
                <div className="flex items-center gap-3">
                  <span className={cn("text-2xl font-mono font-bold", match.winner === match.team1 ? "text-primary" : "text-muted-foreground")}>{ds1}</span>
                  <span className="text-muted-foreground text-xl">:</span>
                  <span className={cn("text-2xl font-mono font-bold", match.winner === match.team2 ? "text-primary" : "text-muted-foreground")}>{ds2}</span>
                </div>
                );
              })() : (
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
              <span key={i} className="text-xs font-mono text-win bg-win/5 px-2 py-1 rounded border border-win/20">
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

// Helper to get display scores (mapScore for Bo1, series score for Bo3/Bo5)
const getDisplayScores = (m: MatchResult): [number | string, number | string] => {
  if (m.bo === 1 && m.mapScore1 !== undefined && m.mapScore2 !== undefined) {
    return [m.mapScore1, m.mapScore2];
  }
  return [m.score1, m.score2];
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

  const [ds1, ds2] = getDisplayScores(match);

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
              <span className={match.winner === match.team1 ? "text-primary font-bold" : "text-muted-foreground"}>{ds1}</span>
              <span className="text-muted-foreground mx-1">:</span>
              <span className={match.winner === match.team2 ? "text-primary font-bold" : "text-muted-foreground"}>{ds2}</span>
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

      <button
        onClick={onOpenDetail}
        className="flex items-center justify-center gap-1.5 w-full px-2 py-1.5 text-xs font-mono text-primary hover:bg-primary/10 transition-colors border-t border-border/50"
      >
        <ExternalLink className="w-3 h-3" />
        {resolved ? "Podgląd meczu" : "Przejdź do meczu"}
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

    // Build set of past pairings to avoid Swiss rematches
    const pastKey = (a: string, b: string) => [a, b].sort().join("|");
    const pastPairings = new Set<string>();
    rounds.forEach(rd => rd.matches.forEach(m => {
      if (m.team1 && m.team2) pastPairings.add(pastKey(m.team1, m.team2));
    }));

    const matches: MatchResult[] = [];
    const paired = new Set<string>();
    let unpaired: SwissStanding[] = [];

    // Fisher-Yates shuffle (unbiased)
    const shuf = <T,>(arr: T[]): T[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    for (const record of records) {
      const pool = shuf([...unpaired, ...byRecord[record]]);
      unpaired = [];
      const remaining = pool.filter(p => !paired.has(p.team));
      // Greedy match: for each team, pick first opponent we haven't faced before
      while (remaining.length >= 2) {
        const a = remaining.shift()!;
        let oppIdx = remaining.findIndex(b => !pastPairings.has(pastKey(a.team, b.team)));
        if (oppIdx === -1) oppIdx = 0; // forced rematch (shouldn't happen often)
        const b = remaining.splice(oppIdx, 1)[0];
        const isDecider = a.wins === winsToQ - 1 || a.losses === lossesToE - 1
          || b.wins === winsToQ - 1 || b.losses === lossesToE - 1;
        const bo = isDecider ? 3 : 1;
        matches.push({ team1: a.team, team2: b.team, score1: 0, score2: 0, winner: "", bo });
        paired.add(a.team);
        paired.add(b.team);
      }
      if (remaining.length === 1) unpaired.push(remaining[0]);
    }

    if (matches.length === 0) {
      setFinished(true);
      return;
    }

    setCurrentMatches(matches);
    setResolved(new Array(matches.length).fill(false));
  }, [rounds]);

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
      const bo = totalRounds <= 1 ? 5 : startBo;
      const winsNeeded = Math.ceil(bo / 2);
      if (t2 === "BYE") {
        matches.push({ team1: t1, team2: "BYE", score1: winsNeeded, score2: 0, winner: t1, bo });
      } else if (t1 === "BYE") {
        matches.push({ team1: "BYE", team2: t2, score1: 0, score2: winsNeeded, winner: t2, bo });
      } else {
        matches.push({ team1: t1, team2: t2, score1: 0, score2: 0, winner: "", bo });
      }
    }
    setCurrentMatches(matches);
    setResolved(matches.map(m => m.team2 === "BYE" || m.team1 === "BYE"));
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
    const winsNeeded = Math.ceil(bo / 2);
    for (let i = 0; i < winners.length; i += 2) {
      const t1 = winners[i];
      const t2 = winners[i + 1] || "BYE";
      if (t2 === "BYE") {
        matches.push({ team1: t1, team2: "BYE", score1: winsNeeded, score2: 0, winner: t1, bo });
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

const TournamentPlay = ({ tournament, onComplete, onBack, onLiveUpdate }: TournamentPlayProps) => {
  const teams = tournament.participants.slice(0, tournament.teams);
  const openSlotCount = tournament.participants.filter(isOpenSlot).length;
  const startBlocked = openSlotCount > 0 && tournament.kind !== "qualifier";
  const startBlockedTitle = startBlocked
    ? `Najpierw zapełnij wszystkie miejsca (wolne: ${openSlotCount})`
    : undefined;
  const format = tournament.format;

  // Load saved progress
  const savedProgress = useRef(getSavedProgress(tournament.id, teams));
  const initialGslGroups = savedProgress.current?.gslGroups || [];

  const [allMatchStats, setAllMatchStats] = useState<Record<string, MatchStats>>(
    savedProgress.current?.allMatchStats || {}
  );

  // State for multi-phase tournaments
  const [swissResult, setSwissResult] = useState<SwissResult | null>(savedProgress.current?.swissResult || null);
  const [groupsResult, setGroupsResult] = useState<GroupResult[] | null>(savedProgress.current?.groupsResult || null);
  const [majorStages, setMajorStages] = useState<MajorStage[]>(savedProgress.current?.majorStages || []);
  const [showDrawCeremony, setShowDrawCeremony] = useState(false);
  const [gslGroups, setGslGroups] = useState<GslGroupState[]>(initialGslGroups);
  const [activeGroupMatch, setActiveGroupMatch] = useState<{ groupIdx: number; matchIdx: number } | null>(null);
  const groupsGenerated = gslGroups.length > 0;

  // Determine initial phase
  const initialPhase = savedProgress.current?.currentPhase || (
    format === "knockout" ? "knockout"
    : format === "swiss+knockout" || format === "league" ? "swiss"
    : format === "groups+knockout" ? "groups"
    : format === "major" ? "major-s1"
    : "knockout"
  );

  const [currentPhase, setCurrentPhase] = useState(initialPhase);

  // Auto-show draw ceremony for groups phase when groups not yet generated
  useEffect(() => {
    if (currentPhase === "groups" && !groupsGenerated && !showDrawCeremony && teams.length > 0) {
      setShowDrawCeremony(true);
    }
  }, [currentPhase, groupsGenerated, showDrawCeremony, teams.length]);

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
      participants: teams,
      currentPhase,
      allMatchStats,
      swissState: swiss.getState(),
      knockoutState: knockout.getState(),
      knockoutTeams,
      swissResult,
      groupsResult,
      gslGroups,
      majorStages,
    };
    saveProgress(tournament.id, progress);
  }, [
    currentPhase, allMatchStats, knockoutTeams, swissResult, groupsResult, gslGroups, majorStages,
    swiss.standings, swiss.rounds, swiss.currentMatches, swiss.resolved, swiss.finished, swiss.started,
    knockout.completedRounds, knockout.currentMatches, knockout.resolved, knockout.finished, knockout.started, knockout.winner, knockout.roundName,
    tournament.id,
  ]);


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
      sim = { tournamentId: tournament.id, format: format as TournamentFormat, swiss: swissResult!, knockout: kr, winner: kr.winner, placements: [] };
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
    onComplete(sim, allMatchStats);
  };

  // Live ranking update: build partial sim from current state and report to parent
  useEffect(() => {
    if (!onLiveUpdate) return;
    const allMatches: MatchResult[] = [];
    if (swiss.rounds) swiss.rounds.forEach(r => allMatches.push(...r.matches));
    if (swiss.currentMatches) allMatches.push(...swiss.currentMatches.filter(m => !!m.winner));
    if (gslGroups.length > 0) {
      gslGroups.forEach(g => allMatches.push(...g.matches.filter(m => !!m.winner && m.team1 !== "TBD")));
    }
    if (knockout.completedRounds) knockout.completedRounds.forEach(r => allMatches.push(...r.matches));
    if (knockout.currentMatches) allMatches.push(...knockout.currentMatches.filter(m => !!m.winner));
    if (allMatches.length === 0) return;
    const liveSim: TournamentSimulation = {
      tournamentId: tournament.id,
      format: format as TournamentFormat,
      winner: "",
      placements: [],
      knockout: { rounds: [{ name: "live", matches: allMatches }], winner: "" },
    };
    onLiveUpdate(liveSim);
  }, [swiss.rounds, swiss.currentMatches, knockout.completedRounds, knockout.currentMatches, gslGroups, onLiveUpdate, tournament.id, format]);


  const generateGslGroupsFromDraw = (drawnGroups: string[][]) => {
    const groups = drawnGroups.map((groupTeams, g) => {
      const groupName = String.fromCharCode(65 + g);
      const gt = groupTeams.slice(0, 4);
      
      if (gt.length === 3) {
        // 3-team group: round-robin (3 Bo1 matches), top 2 qualify
        const matches: MatchResult[] = [
          { team1: gt[0], team2: gt[1], score1: 0, score2: 0, winner: "", bo: 1 },
          { team1: gt[0], team2: gt[2], score1: 0, score2: 0, winner: "", bo: 1 },
          { team1: gt[1], team2: gt[2], score1: 0, score2: 0, winner: "", bo: 1 },
        ];
        return { groupName, teams: gt, matches, phase: 0, qualified: [] as string[], eliminated: [] as string[], is3Team: true };
      }
      
      // 4-team GSL group
      const matches: MatchResult[] = [
        { team1: gt[0], team2: gt[1], score1: 0, score2: 0, winner: "", bo: 1 },
        { team1: gt[2], team2: gt[3] || "BYE", score1: 0, score2: 0, winner: gt[3] ? "" : gt[2], bo: 1 },
        { team1: "TBD", team2: "TBD", score1: 0, score2: 0, winner: "", bo: 3 },
        { team1: "TBD", team2: "TBD", score1: 0, score2: 0, winner: "", bo: 1 },
        { team1: "TBD", team2: "TBD", score1: 0, score2: 0, winner: "", bo: 3 },
      ];
      return { groupName, teams: gt, matches, phase: 0, qualified: [] as string[], eliminated: [] as string[], is3Team: false };
    });
    setGslGroups(groups);
    setShowDrawCeremony(false);
  };

  const generateGslGroups = () => {
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    const groupCount = teams.length <= 8 ? 2 : 4;
    const perGroup = Math.ceil(shuffled.length / groupCount);
    const drawnGroups: string[][] = [];
    for (let g = 0; g < groupCount; g++) {
      drawnGroups.push(shuffled.slice(g * perGroup, (g + 1) * perGroup).slice(0, 4));
    }
    generateGslGroupsFromDraw(drawnGroups);
  };

  const resolveGslMatch = (groupIdx: number, matchIdx: number, result: MatchResult) => {
    const groups = [...gslGroups];
    const group = { ...groups[groupIdx] };
    const matches = [...group.matches];
    matches[matchIdx] = result;

    if (group.is3Team) {
      // 3-team round-robin: once all 3 matches resolved, rank by wins
      const allDone = matches.every(m => !!m.winner);
      if (allDone) {
        const teamWins: Record<string, number> = {};
        group.teams.forEach(t => { teamWins[t] = 0; });
        matches.forEach(m => { if (m.winner) teamWins[m.winner] = (teamWins[m.winner] || 0) + 1; });
        const sorted = Object.entries(teamWins).sort((a, b) => b[1] - a[1]);
        group.qualified = [sorted[0][0], sorted[1][0]];
        group.eliminated = [sorted[2][0]];
        group.phase = 3;
      }
    } else {
      // Standard GSL bracket logic
      if (matchIdx <= 1 && matches[0].winner && matches[1].winner) {
        matches[2] = { ...matches[2], team1: matches[0].winner, team2: matches[1].winner };
        const loser0 = matches[0].winner === matches[0].team1 ? matches[0].team2 : matches[0].team1;
        const loser1 = matches[1].winner === matches[1].team1 ? matches[1].team2 : matches[1].team1;
        matches[3] = { ...matches[3], team1: loser0, team2: loser1 };
        group.phase = 1;
      }

      if (matchIdx === 2 && matches[2].winner) {
        group.qualified = [...group.qualified, matches[2].winner];
        const winnersLoser = matches[2].winner === matches[2].team1 ? matches[2].team2 : matches[2].team1;
        if (matches[3].winner) {
          const losersLoser = matches[3].winner === matches[3].team1 ? matches[3].team2 : matches[3].team1;
          group.eliminated = [...group.eliminated, losersLoser];
          matches[4] = { ...matches[4], team1: winnersLoser, team2: matches[3].winner };
          group.phase = 2;
        }
      }

      if (matchIdx === 3 && matches[3].winner) {
        const losersLoser = matches[3].winner === matches[3].team1 ? matches[3].team2 : matches[3].team1;
        group.eliminated = [...group.eliminated, losersLoser];
        if (matches[2].winner) {
          const winnersLoser = matches[2].winner === matches[2].team1 ? matches[2].team2 : matches[2].team1;
          matches[4] = { ...matches[4], team1: winnersLoser, team2: matches[3].winner };
          group.phase = 2;
        }
      }

      if (matchIdx === 4 && matches[4].winner) {
        group.qualified = [...group.qualified, matches[4].winner];
        const deciderLoser = matches[4].winner === matches[4].team1 ? matches[4].team2 : matches[4].team1;
        group.eliminated = [...group.eliminated, deciderLoser];
        group.phase = 3;
      }
    }

    group.matches = matches;
    groups[groupIdx] = group;
    setGslGroups(groups);

    // Check if all groups are done
    if (groups.every(g => g.phase === 3)) {
      const advanced = groups.flatMap(g => g.qualified);
      setKnockoutTeams(advanced);
      const groupResults: GroupResult[] = groups.map(g => ({
        groupName: g.groupName,
        teams: g.teams,
        matches: g.matches,
        standings: g.teams.map(t => ({
          team: t,
          wins: g.matches.filter(m => m.winner === t).length,
          losses: g.matches.filter(m => m.winner && m.winner !== t && (m.team1 === t || m.team2 === t)).length,
          roundDiff: 0,
        })).sort((a, b) => b.wins - a.wins),
        qualified: g.qualified,
      }));
      setGroupsResult(groupResults);
    }
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
            <button
              onClick={swiss.start}
              disabled={startBlocked}
              title={startBlockedTitle}
              className="flex items-center gap-2 px-4 py-2 rounded-md font-heading font-semibold text-sm gradient-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              Rozpocznij{startBlocked ? ` (wolne miejsca: ${openSlotCount})` : ""}
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
                  {(() => { const [d1,d2] = getDisplayScores(m); return (<><span className={m.winner === m.team1 ? "text-primary font-bold" : "text-muted-foreground"}>{d1}</span><span className="text-muted-foreground mx-1">:</span><span className={m.winner === m.team2 ? "text-primary font-bold" : "text-muted-foreground"}>{d2}</span></>); })()}
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
            <button
              onClick={knockout.start}
              disabled={startBlocked}
              title={startBlockedTitle}
              className="flex items-center gap-2 px-4 py-2 rounded-md font-heading font-semibold text-sm gradient-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              Rozpocznij Playoffs{startBlocked ? ` (wolne miejsca: ${openSlotCount})` : ""}
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

      {/* Visual Bracket */}
      {knockout.started && (
        <PlayoffBracket
          completedRounds={knockout.completedRounds}
          currentMatches={knockout.currentMatches}
          currentRoundName={knockout.roundName}
          winner={knockout.winner}
          finished={knockout.finished}
          onMatchClick={(ri, mi, isCurrent) => {
            if (isCurrent) {
              setActiveMatchDetail({ source: "knockout", index: mi });
            }
          }}
        />
      )}

      {/* Current round interactive matches */}
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

  // Render GSL Groups Phase
  const renderGroupsPhase = () => {
    const allGroupsDone = gslGroups.length > 0 && gslGroups.every(g => g.phase === 3);

    // GSL match detail overlay
    if (activeGroupMatch) {
      const { groupIdx, matchIdx } = activeGroupMatch;
      const group = gslGroups[groupIdx];
      const match = group?.matches[matchIdx];
      if (match && match.team1 !== "TBD" && match.team2 !== "TBD") {
        return (
          <MatchDetailPanel
            match={match}
            onUpdate={(updated) => {
              resolveGslMatch(groupIdx, matchIdx, updated);
              setActiveGroupMatch(null);
            }}
            onSimulate={() => {
              const result = simulateMatch(match.team1, match.team2, match.bo);
              resolveGslMatch(groupIdx, matchIdx, result);
              setActiveGroupMatch(null);
            }}
            resolved={!!match.winner}
            matchStats={getStatsForMatch(match)}
            onUpdateStats={handleUpdateStats}
            onClose={() => setActiveGroupMatch(null)}
          />
        );
      }
    }

    const matchLabels = ["Mecz otwarcia 1", "Mecz otwarcia 2", "Mecz zwycięzców", "Mecz przegranych", "Decider"];
    const matchLabels3Team = ["Kolejka 1", "Kolejka 2", "Kolejka 3"];

    // Show draw ceremony
    if (showDrawCeremony) {
      const groupCount = teams.length <= 8 ? 2 : 4;
      return (
        <GroupDrawCeremony
          teams={teams}
          groupCount={groupCount}
          onComplete={(drawnGroups) => generateGslGroupsFromDraw(drawnGroups)}
          onSkip={generateGslGroups}
        />
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-xl font-bold text-foreground">Faza Grupowa (GSL)</h3>
          <div className="flex gap-2">
            {!groupsGenerated && (
              <button onClick={() => setShowDrawCeremony(true)} className="flex items-center gap-2 px-4 py-2 rounded-md font-heading font-semibold text-sm gradient-primary text-primary-foreground hover:opacity-90">
                <Play className="w-4 h-4" />
                Losuj grupy
              </button>
            )}
            {allGroupsDone && (
              <button onClick={() => setCurrentPhase("knockout")} className="flex items-center gap-2 px-4 py-2 rounded-md font-heading font-semibold text-sm gradient-primary text-primary-foreground hover:opacity-90">
                <Zap className="w-4 h-4" />
                Przejdź do Playoffs →
              </button>
            )}
          </div>
        </div>

        {gslGroups.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {gslGroups.map((group, gi) => (
              <div key={group.groupName} className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-secondary/50 font-heading font-bold text-foreground flex items-center justify-between">
                  <span>Grupa {group.groupName}</span>
                  {group.phase === 3 && <span className="text-xs font-mono text-win">Zakończona</span>}
                </div>
                <div className="p-3 space-y-2">
                  {group.matches.map((m, mi) => {
                    if (m.team1 === "TBD" || m.team2 === "TBD") return null;
                    const isResolved = !!m.winner;
                    return (
                      <div key={mi} className="space-y-1">
                        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{group.is3Team ? matchLabels3Team[mi] : matchLabels[mi]}</p>
                        <div className={cn(
                          "bg-secondary/30 border rounded-md overflow-hidden text-sm",
                          isResolved ? "border-win/20" : "border-primary/30"
                        )}>
                          <div className="flex items-center">
                            <div className={cn("flex-1 px-3 py-2 text-right truncate font-medium", isResolved && m.winner === m.team1 ? "text-foreground font-bold" : "text-muted-foreground")}>{m.team1}</div>
                            <div className="px-3 py-2 font-mono text-xs bg-secondary min-w-[50px] text-center">
                              {isResolved ? (() => { const [d1,d2] = getDisplayScores(m); return (<><span className={m.winner === m.team1 ? "text-primary font-bold" : "text-muted-foreground"}>{d1}</span><span className="text-muted-foreground mx-1">:</span><span className={m.winner === m.team2 ? "text-primary font-bold" : "text-muted-foreground"}>{d2}</span></>); })() : (
                                <span className="text-muted-foreground">vs</span>
                              )}
                            </div>
                            <div className={cn("flex-1 px-3 py-2 truncate font-medium", isResolved && m.winner === m.team2 ? "text-foreground font-bold" : "text-muted-foreground")}>{m.team2}</div>
                          </div>
                          {!isResolved && (
                            <button
                              onClick={() => setActiveGroupMatch({ groupIdx: gi, matchIdx: mi })}
                              className="flex items-center justify-center gap-1.5 w-full px-2 py-1.5 text-xs font-mono text-primary hover:bg-primary/10 transition-colors border-t border-border/50"
                            >
                              <ExternalLink className="w-3 h-3" /> Przejdź do meczu
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Group status */}
                <div className="px-3 pb-3 flex flex-wrap gap-1">
                  {group.qualified.map(t => (
                    <span key={t} className="text-xs font-mono text-win bg-win/10 px-2 py-0.5 rounded border border-win/30">✓ {t}</span>
                  ))}
                  {group.eliminated.map(t => (
                    <span key={t} className="text-xs font-mono text-destructive bg-destructive/10 px-2 py-0.5 rounded border border-destructive/30">✗ {t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <button onClick={handleBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            Powrót do listy turniejów
          </button>
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
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
