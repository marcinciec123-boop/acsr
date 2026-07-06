import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, Users, Play, SkipForward, Edit3, Check, Shield, Crown, Plus, X, Search, UserPlus, ExternalLink, Globe, MapPin } from "lucide-react";
import { type Tournament, type MatchResult, type KnockoutRound, simulateMatch, teamDatabase, type TeamData, getRegionalSlotDistribution, getRegionalQualifierPool, regionNames } from "@/data/tournaments";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { type MatchStats, generateMatchStats } from "@/lib/playerStats";
import MatchStatsPanel from "@/components/MatchStatsPanel";
import { getDisplayScore } from "@/lib/matchDisplay";

interface QualifierPlayProps {
  tournament: Tournament;
  invitedTeams: string[];
  qualifierPool: string[];
  qualifierSlots: number;
  onComplete: (qualifiedTeams: string[], manualInvites?: string[]) => void;
  onBack: () => void;
  dynamicRanking?: TeamData[];
}

const getTeamRoster = (teamName: string): string[] => {
  const team = teamDatabase.find(t => t.name === teamName);
  return team?.roster || [teamName + "_p1", teamName + "_p2", teamName + "_p3", teamName + "_p4", teamName + "_p5"];
};

// Match Detail Panel for qualifiers
const QualMatchDetail = ({ match, onUpdate, onSimulate, resolved, matchStats, onUpdateStats, onClose }: {
  match: MatchResult;
  onUpdate: (match: MatchResult) => void;
  onSimulate: () => void;
  resolved: boolean;
  matchStats?: MatchStats | null;
  onUpdateStats?: (matchId: string, stats: MatchStats) => void;
  onClose: () => void;
}) => {
  const [editing, setEditing] = useState(false);
  const [s1, setS1] = useState("0");
  const [s2, setS2] = useState("0");

  const isBo1 = (match.bo || 1) === 1;

  const confirmScore = () => {
    const score1 = parseInt(s1) || 0;
    const score2 = parseInt(s2) || 0;
    if (score1 === score2 || score1 < 0 || score2 < 0) return;
    if (isBo1) {
      const high = Math.max(score1, score2);
      const low = Math.min(score1, score2);
      if (high < 13) return;
      if ((high - 13) % 3 !== 0) return;
      const minLoser = high === 13 ? 0 : high - 4;
      const maxLoser = high - 1;
      if (low < minLoser || low > maxLoser) return;
    }
    const winner = score1 > score2 ? match.team1 : match.team2;
    const mapScore1 = isBo1 ? 1 : score1;
    const mapScore2 = isBo1 ? 0 : score2;
    onUpdate({ ...match, score1: winner === match.team1 ? mapScore1 : mapScore2, score2: winner === match.team1 ? mapScore2 : mapScore1, winner });
    setEditing(false);
    if (onUpdateStats) {
      const stats = generateMatchStats(match.team1, match.team2, getTeamRoster(match.team1), getTeamRoster(match.team2), isBo1 ? score1 : score1, isBo1 ? score2 : score2, match.bo);
      onUpdateStats(`${match.team1}-vs-${match.team2}`, stats);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-secondary/50 border-b border-border/50">
        <button onClick={onClose} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Powrót
        </button>
        <span className="text-xs font-mono text-muted-foreground">BO{match.bo}</span>
      </div>
      <div className="p-6">
        <div className="flex items-center justify-center gap-6">
          <div className={cn("text-right flex-1", resolved && match.winner === match.team1 ? "text-foreground" : "text-muted-foreground")}>
            <p className={cn("text-xl font-heading font-bold", resolved && match.winner === match.team1 && "text-win")}>{match.team1}</p>
          </div>
          {editing ? (
            <div className="flex flex-col items-center gap-2">
              {isBo1 && <span className="text-[10px] font-mono text-muted-foreground">Wynik rundowy (np. 13:7, dogrywka: 16:14)</span>}
              <div className="flex items-center gap-2 px-4 py-3 bg-secondary rounded-lg">
                <Input value={s1} onChange={e => setS1(e.target.value)} className="w-14 h-10 text-center font-mono text-lg p-0 bg-background" type="number" min="0" />
                <span className="text-muted-foreground text-xl font-mono">:</span>
                <Input value={s2} onChange={e => setS2(e.target.value)} className="w-14 h-10 text-center font-mono text-lg p-0 bg-background" type="number" min="0" />
              </div>
              <button onClick={confirmScore} className="flex items-center gap-2 px-5 py-2 gradient-primary text-primary-foreground rounded-md font-heading font-semibold hover:opacity-90 transition-opacity text-sm">
                <Check className="w-4 h-4" /> Zapisz wynik
              </button>
            </div>
          ) : (
            <div className="px-6 py-3 bg-secondary rounded-lg min-w-[100px] text-center">
              {resolved ? (
                <div className="flex items-center gap-3">
                  {(() => { const [d1, d2] = getDisplayScore(match); return (<>
                  <span className={cn("text-2xl font-mono font-bold", match.winner === match.team1 ? "text-primary" : "text-muted-foreground")}>{d1}</span>
                  <span className="text-muted-foreground text-xl">:</span>
                  <span className={cn("text-2xl font-mono font-bold", match.winner === match.team2 ? "text-primary" : "text-muted-foreground")}>{d2}</span>
                  </>); })()}
                </div>
              ) : (
                <span className="text-xl font-mono text-muted-foreground">vs</span>
              )}
            </div>
          )}
          <div className={cn("text-left flex-1", resolved && match.winner === match.team2 ? "text-foreground" : "text-muted-foreground")}>
            <p className={cn("text-xl font-heading font-bold", resolved && match.winner === match.team2 && "text-win")}>{match.team2}</p>
          </div>
        </div>
        {!resolved && !editing && (
          <div className="flex justify-center gap-3 mt-6">
            <button onClick={onSimulate} className="flex items-center gap-2 px-6 py-3 gradient-primary text-primary-foreground rounded-md font-heading font-semibold hover:opacity-90">
              <Play className="w-4 h-4" /> Symuluj mecz
            </button>
            <button onClick={() => { setEditing(true); setS1("0"); setS2("0"); }} className="flex items-center gap-2 px-6 py-3 border border-accent/30 text-accent rounded-md font-heading font-semibold hover:bg-accent/10">
              <Edit3 className="w-4 h-4" /> Wpisz wynik
            </button>
          </div>
        )}
        {resolved && match.winner && (
          <div className="text-center mt-4">
            <span className="text-xs font-mono text-win bg-win/10 px-3 py-1 rounded-full border border-win/20">Zwycięzca: {match.winner}</span>
          </div>
        )}
      </div>
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

// Compact match card
const EditableMatch = ({ match, index, onUpdate, onSimulate, resolved, matchStats, onUpdateStats, onOpenDetail }: {
  match: MatchResult; index: number;
  onUpdate: (index: number, match: MatchResult) => void;
  onSimulate: (index: number) => void;
  resolved: boolean;
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
    <div className={cn("bg-card border rounded-md overflow-hidden text-sm transition-all", resolved ? "border-win/20" : "border-primary/30")}>
      <div className="flex items-center">
        <div className={cn("flex-1 px-3 py-2 text-right truncate font-medium", resolved && match.winner === match.team1 ? "text-foreground font-bold" : "text-muted-foreground")}>{match.team1}</div>
        <div className="px-3 py-2 font-mono text-xs bg-secondary min-w-[60px] text-center">
          {resolved ? (() => { const [d1, d2] = getDisplayScore(match); return (
            <>
              <span className={match.winner === match.team1 ? "text-primary font-bold" : "text-muted-foreground"}>{d1}</span>
              <span className="text-muted-foreground mx-1">:</span>
              <span className={match.winner === match.team2 ? "text-primary font-bold" : "text-muted-foreground"}>{d2}</span>
            </>
          ); })() : <span className="text-muted-foreground">vs</span>}
        </div>
        <div className={cn("flex-1 px-3 py-2 truncate font-medium", resolved && match.winner === match.team2 ? "text-foreground font-bold" : "text-muted-foreground")}>{match.team2}</div>
      </div>
      <button onClick={onOpenDetail} className="flex items-center justify-center gap-1.5 w-full px-2 py-1.5 text-xs font-mono text-primary hover:bg-primary/10 transition-colors border-t border-border/50">
        <ExternalLink className="w-3 h-3" /> Przejdź do meczu
      </button>
    </div>
  );
};

// ===== Regional bracket state =====
interface RegionalBracketState {
  region: string;
  pool: string[];
  slots: number;
  completedRounds: KnockoutRound[];
  currentMatches: MatchResult[];
  resolved: boolean[];
  qualifiedTeams: string[];
  finished: boolean;
  roundName: string;
  activeMatchDetail: number | null;
}

// ===== Regional Bracket Component =====
const RegionalBracket = ({
  state,
  onStateChange,
  allMatchStats,
  onUpdateStats,
}: {
  state: RegionalBracketState;
  onStateChange: (newState: RegionalBracketState) => void;
  allMatchStats: Record<string, MatchStats>;
  onUpdateStats: (matchId: string, stats: MatchStats) => void;
}) => {
  const { region, slots, completedRounds, currentMatches, resolved, qualifiedTeams, finished, roundName, activeMatchDetail } = state;

  const getStatsForMatch = (m: MatchResult): MatchStats | null => {
    return allMatchStats[`${m.team1}-vs-${m.team2}`] || null;
  };

  const updateMatch = (idx: number, match: MatchResult) => {
    const newMatches = [...currentMatches];
    newMatches[idx] = match;
    const newResolved = [...resolved];
    newResolved[idx] = true;
    onStateChange({ ...state, currentMatches: newMatches, resolved: newResolved });
  };

  const simulateOne = (idx: number) => {
    const m = currentMatches[idx];
    const result = simulateMatch(m.team1, m.team2, m.bo);
    const stats = generateMatchStats(m.team1, m.team2, getTeamRoster(m.team1), getTeamRoster(m.team2), result.score1, result.score2, m.bo);
    onUpdateStats(`${m.team1}-vs-${m.team2}`, stats);
    updateMatch(idx, result);
  };

  const simulateAllCurrent = () => {
    const next = [...currentMatches];
    const res = [...resolved];
    next.forEach((m, i) => {
      if (!res[i] && m.team2 !== "BYE") {
        const result = simulateMatch(m.team1, m.team2, m.bo);
        next[i] = result;
        res[i] = true;
        const stats = generateMatchStats(m.team1, m.team2, getTeamRoster(m.team1), getTeamRoster(m.team2), result.score1, result.score2, m.bo);
        onUpdateStats(`${m.team1}-vs-${m.team2}`, stats);
      }
    });
    onStateChange({ ...state, currentMatches: next, resolved: res });
  };

  const padSize = (() => {
    let s = 2;
    while (s < state.pool.length) s *= 2;
    return s;
  })();

  const getRoundName = (idx: number) => {
    const remaining = padSize / Math.pow(2, idx);
    if (remaining === 2) return "Finał";
    if (remaining === 4) return "Półfinały";
    if (remaining === 8) return "Ćwierćfinały";
    return `Runda ${idx + 1}`;
  };

  const advanceRound = () => {
    const roundIdx = completedRounds.length;
    const newCompleted = [...completedRounds, { name: roundName, matches: currentMatches }];
    const winners = currentMatches.map(m => m.winner);

    const totalRounds = Math.log2(padSize);
    if (winners.length <= slots || roundIdx + 1 >= totalRounds) {
      onStateChange({
        ...state,
        completedRounds: newCompleted,
        currentMatches: [],
        qualifiedTeams: winners.slice(0, slots),
        finished: true,
        activeMatchDetail: null,
      });
      return;
    }

    const nextRoundIdx = roundIdx + 1;
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
    onStateChange({
      ...state,
      completedRounds: newCompleted,
      currentMatches: matches,
      resolved: matches.map(m => m.team2 === "BYE"),
      roundName: getRoundName(nextRoundIdx),
      activeMatchDetail: null,
    });
  };

  const allResolved = resolved.length > 0 && resolved.every(Boolean);

  if (finished) {
    return (
      <div className="bg-card border border-win/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-accent" />
          <h4 className="font-heading font-bold text-foreground text-sm">
            {regionNames[region] || region} — Zakwalifikowani ({qualifiedTeams.length}/{slots})
          </h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {qualifiedTeams.map((t, i) => (
            <span key={t} className="px-2 py-1 bg-win/10 text-win border border-win/20 rounded text-xs font-mono">
              #{i + 1} {t}
            </span>
          ))}
        </div>
        {completedRounds.length > 0 && (
          <div className="mt-3 border-t border-border/50 pt-3">
            {completedRounds.map((round, ri) => (
              <div key={ri} className="mb-2">
                <p className="text-[10px] font-mono text-primary mb-1">{round.name}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
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
    );
  }

  return (
    <div className="bg-card border border-primary/20 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-1">
        <Globe className="w-4 h-4 text-primary" />
        <h4 className="font-heading font-bold text-foreground text-sm">
          {regionNames[region] || region} — {slots} {slots === 1 ? "slot" : "sloty"}
        </h4>
      </div>
      <p className="text-[10px] font-mono text-muted-foreground mb-3">{state.pool.length} drużyn w puli</p>

      {activeMatchDetail !== null && currentMatches[activeMatchDetail] && (
        <QualMatchDetail
          match={currentMatches[activeMatchDetail]}
          onUpdate={(updated) => updateMatch(activeMatchDetail, updated)}
          onSimulate={() => simulateOne(activeMatchDetail)}
          resolved={resolved[activeMatchDetail]}
          matchStats={getStatsForMatch(currentMatches[activeMatchDetail])}
          onUpdateStats={onUpdateStats}
          onClose={() => onStateChange({ ...state, activeMatchDetail: null })}
        />
      )}

      {activeMatchDetail === null && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-xs font-mono text-primary">{roundName}</h5>
            <div className="flex gap-2">
              <button onClick={simulateAllCurrent} className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-primary border border-primary/30 rounded hover:bg-primary/10 transition-colors">
                <SkipForward className="w-3 h-3" /> Symuluj
              </button>
              {allResolved && (
                <button onClick={advanceRound} className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono gradient-primary text-primary-foreground rounded hover:opacity-90">
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
                onUpdate={(_, match) => updateMatch(i, match)}
                onSimulate={() => simulateOne(i)}
                resolved={resolved[i]}
                matchStats={getStatsForMatch(m)}
                onUpdateStats={onUpdateStats}
                onOpenDetail={() => onStateChange({ ...state, activeMatchDetail: i })}
              />
            ))}
          </div>

          {completedRounds.length > 0 && (
            <div className="mt-3 border-t border-border/50 pt-3">
              {completedRounds.map((round, ri) => (
                <div key={ri} className="mb-2">
                  <p className="text-[10px] font-mono text-primary mb-1">{round.name}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
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
        </>
      )}
    </div>
  );
};

// Setup phase component for manual team selection
const QualifierSetup = ({ tournament, invitedTeams, qualifierPool, qualifierSlots, onStart, onSimulateAll, onBack, isRegional, regionalSlots }: {
  tournament: Tournament;
  invitedTeams: string[];
  qualifierPool: string[];
  qualifierSlots: number;
  onStart: (customPool: string[], manualInvites: string[]) => void;
  onSimulateAll: (customPool: string[], manualInvites: string[]) => void;
  onBack: () => void;
  isRegional: boolean;
  regionalSlots?: Record<string, number>;
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

  const qualType = isRegional ? "Regionalne" : tournament.qualification.qualifierType === "regional" ? "Regionalne" : "Open";

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

      {/* Regional slot distribution */}
      {isRegional && regionalSlots && (
        <div className="bg-card border border-primary/20 rounded-lg p-4">
          <h3 className="font-heading font-bold text-foreground flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-primary" />
            Podział slotów regionalnych
          </h3>
          <p className="text-muted-foreground text-xs mb-3">Sloty przydzielone na podstawie siły regionów w rankingu</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {Object.entries(regionalSlots).sort(([, a], [, b]) => b - a).map(([region, slots]) => (
              <div key={region} className="bg-secondary/50 border border-border rounded-md p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <MapPin className="w-3 h-3 text-primary" />
                  <span className="text-xs font-heading font-bold text-foreground">{regionNames[region] || region}</span>
                </div>
                <span className="text-2xl font-mono font-bold text-primary">{slots}</span>
                <span className="text-xs text-muted-foreground ml-1">{slots === 1 ? "slot" : "slotów"}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 text-xs text-muted-foreground font-mono text-center">
            Łącznie: {Object.values(regionalSlots).reduce((a, b) => a + b, 0)} slotów kwalifikacyjnych
          </div>
        </div>
      )}

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

      {/* Qualifier pool - only show for non-regional */}
      {!isRegional && (
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
      )}

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
          >
            <Play className="w-4 h-4" /> Rozegraj kwalifikacje
          </button>
          <button
            onClick={() => onSimulateAll(customPool, manualInvites)}
            className="flex items-center gap-2 px-6 py-3 border border-primary/30 text-primary rounded-md font-heading font-semibold hover:bg-primary/10 transition-colors"
          >
            <SkipForward className="w-4 h-4" /> Symuluj kwalifikacje
          </button>
        </div>
      </div>
    </div>
  );
};

function initRegionalBracket(region: string, pool: string[], slots: number): RegionalBracketState {
  const bracketTeams = pool.slice(0, Math.max(slots * 4, 8));
  let size = 2;
  while (size < bracketTeams.length) size *= 2;
  const padded = [...bracketTeams];
  while (padded.length < size) padded.push("BYE");

  const matches: MatchResult[] = [];
  for (let i = 0; i < padded.length; i += 2) {
    const t1 = padded[i];
    const t2 = padded[i + 1];
    if (t2 === "BYE") {
      matches.push({ team1: t1, team2: "BYE", score1: 2, score2: 0, winner: t1, bo: 3 });
    } else {
      matches.push({ team1: t1, team2: t2, score1: 0, score2: 0, winner: "", bo: 3 });
    }
  }

  const getRoundName = (idx: number) => {
    const remaining = size / Math.pow(2, idx);
    if (remaining === 2) return "Finał";
    if (remaining === 4) return "Półfinały";
    if (remaining === 8) return "Ćwierćfinały";
    return `Runda ${idx + 1}`;
  };

  return {
    region,
    pool: bracketTeams,
    slots,
    completedRounds: [],
    currentMatches: matches,
    resolved: matches.map(m => m.team2 === "BYE"),
    qualifiedTeams: [],
    finished: false,
    roundName: getRoundName(0),
    activeMatchDetail: null,
  };
}

function simulateRegionalBracketFull(region: string, pool: string[], slots: number): { state: RegionalBracketState; stats: Record<string, MatchStats> } {
  const bracketTeams = pool.slice(0, Math.max(slots * 4, 8));
  let size = 2;
  while (size < bracketTeams.length) size *= 2;
  let current = [...bracketTeams];
  while (current.length < size) current.push("BYE");

  const allRounds: KnockoutRound[] = [];
  const stats: Record<string, MatchStats> = {};

  while (current.length > slots) {
    const matches: MatchResult[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const t1 = current[i];
      const t2 = current[i + 1] || "BYE";
      if (t2 === "BYE") {
        matches.push({ team1: t1, team2: "BYE", score1: 2, score2: 0, winner: t1, bo: 3 });
      } else {
        const result = simulateMatch(t1, t2, 3);
        matches.push(result);
        stats[`${t1}-vs-${t2}`] = generateMatchStats(t1, t2, getTeamRoster(t1), getTeamRoster(t2), result.score1, result.score2, 3);
      }
    }
    allRounds.push({ name: `Runda ${allRounds.length + 1}`, matches });
    current = matches.map(m => m.winner);
  }

  return {
    state: {
      region,
      pool: bracketTeams,
      slots,
      completedRounds: allRounds,
      currentMatches: [],
      resolved: [],
      qualifiedTeams: current.slice(0, slots),
      finished: true,
      roundName: "",
      activeMatchDetail: null,
    },
    stats,
  };
}

const QualifierPlay = ({ tournament, invitedTeams, qualifierPool, qualifierSlots, onComplete, onBack, dynamicRanking }: QualifierPlayProps) => {
  const isRegional = tournament.qualification.qualifierType === "regional" && !!tournament.qualification.qualifierRegions?.length && !!dynamicRanking;
  const regions = tournament.qualification.qualifierRegions || [];

  const regionalSlots = useMemo(() => {
    if (!isRegional || !dynamicRanking) return {};
    return getRegionalSlotDistribution(qualifierSlots, regions, dynamicRanking);
  }, [isRegional, dynamicRanking, qualifierSlots, regions]);

  const [phase, setPhase] = useState<"setup" | "play" | "finished">("setup");
  const [activeManualInvites, setActiveManualInvites] = useState<string[]>([]);
  const [allMatchStats, setAllMatchStats] = useState<Record<string, MatchStats>>({});

  // For non-regional (legacy) qualifiers
  const [activePool, setActivePool] = useState<string[]>(qualifierPool);
  const [legacyCompletedRounds, setLegacyCompletedRounds] = useState<KnockoutRound[]>([]);
  const [legacyCurrentMatches, setLegacyCurrentMatches] = useState<MatchResult[]>([]);
  const [legacyResolved, setLegacyResolved] = useState<boolean[]>([]);
  const [legacyQualifiedTeams, setLegacyQualifiedTeams] = useState<string[]>([]);
  const [legacyRoundName, setLegacyRoundName] = useState("");
  const [legacyActiveMatchDetail, setLegacyActiveMatchDetail] = useState<number | null>(null);

  // For regional qualifiers
  const [regionalBrackets, setRegionalBrackets] = useState<Record<string, RegionalBracketState>>({});

  const handleUpdateStats = useCallback((matchId: string, stats: MatchStats) => {
    setAllMatchStats(prev => ({ ...prev, [matchId]: stats }));
  }, []);

  // ===== REGIONAL FLOW =====
  const handleSetupStartRegional = (_customPool: string[], manualInvites: string[]) => {
    setActiveManualInvites(manualInvites);
    // Initialize brackets per region
    const brackets: Record<string, RegionalBracketState> = {};
    regions.forEach(region => {
      const pool = dynamicRanking
        ? getRegionalQualifierPool(tournament, dynamicRanking, [...invitedTeams, ...manualInvites], region)
        : [];
      const slots = regionalSlots[region] || 0;
      if (slots > 0 && pool.length > 0) {
        brackets[region] = initRegionalBracket(region, pool, slots);
      }
    });
    setRegionalBrackets(brackets);
    setPhase("play");
  };

  const handleSetupSimulateAllRegional = (_customPool: string[], manualInvites: string[]) => {
    setActiveManualInvites(manualInvites);
    const brackets: Record<string, RegionalBracketState> = {};
    const newStats: Record<string, MatchStats> = {};

    regions.forEach(region => {
      const pool = dynamicRanking
        ? getRegionalQualifierPool(tournament, dynamicRanking, [...invitedTeams, ...manualInvites], region)
        : [];
      const slots = regionalSlots[region] || 0;
      if (slots > 0 && pool.length > 0) {
        const result = simulateRegionalBracketFull(region, pool, slots);
        brackets[region] = result.state;
        Object.assign(newStats, result.stats);
      }
    });

    setRegionalBrackets(brackets);
    setAllMatchStats(prev => ({ ...prev, ...newStats }));
    setPhase("finished");
  };

  const allRegionsFinished = useMemo(() => {
    if (!isRegional) return false;
    const bracketEntries = Object.values(regionalBrackets);
    return bracketEntries.length > 0 && bracketEntries.every(b => b.finished);
  }, [isRegional, regionalBrackets]);

  // Auto-transition to finished when all regional brackets done
  const totalRegionalQualified = useMemo(() => {
    return Object.values(regionalBrackets).flatMap(b => b.qualifiedTeams);
  }, [regionalBrackets]);

  // ===== NON-REGIONAL (LEGACY) FLOW =====
  const teamsForBracket = activePool.slice(0, Math.max(qualifierSlots * 4, 8));
  let legacySize = 2;
  while (legacySize < teamsForBracket.length) legacySize *= 2;
  const legacyTotalRounds = Math.log2(legacySize);

  const getLegacyRoundName = (idx: number) => {
    const remaining = legacySize / Math.pow(2, idx);
    if (remaining === 2) return "Finał kwalifikacji";
    if (remaining === 4) return "Półfinały kwalifikacji";
    if (remaining === 8) return "Ćwierćfinały kwalifikacji";
    return `Runda ${idx + 1} kwalifikacji`;
  };

  const startLegacyBracket = useCallback((pool: string[]) => {
    const bracket = pool.slice(0, Math.max(qualifierSlots * 4, 8));
    let s = 2;
    while (s < bracket.length) s *= 2;
    const p = [...bracket];
    while (p.length < s) p.push("BYE");

    setLegacyRoundName(getLegacyRoundName(0));
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
    setLegacyCurrentMatches(matches);
    setLegacyResolved(matches.map(m => m.team2 === "BYE"));
  }, [qualifierSlots]);

  const handleSetupStart = (customPool: string[], manualInvites: string[]) => {
    if (isRegional) {
      handleSetupStartRegional(customPool, manualInvites);
      return;
    }
    setActivePool(customPool);
    setActiveManualInvites(manualInvites);
    setPhase("play");
    startLegacyBracket(customPool);
  };

  const handleSetupSimulateAll = (customPool: string[], manualInvites: string[]) => {
    if (isRegional) {
      handleSetupSimulateAllRegional(customPool, manualInvites);
      return;
    }
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
          const stats = generateMatchStats(t1, t2, getTeamRoster(t1), getTeamRoster(t2), result.score1, result.score2, 3);
          setAllMatchStats(prev => ({ ...prev, [`${t1}-vs-${t2}`]: stats }));
        }
      }
      allRounds.push({ name: `Runda ${allRounds.length + 1}`, matches });
      current = matches.map(m => m.winner);
    }

    setLegacyCompletedRounds(allRounds);
    setLegacyQualifiedTeams(current.slice(0, qualifierSlots));
    setLegacyCurrentMatches([]);
    setPhase("finished");
  };

  const legacyUpdateMatch = useCallback((idx: number, match: MatchResult) => {
    setLegacyCurrentMatches(prev => { const n = [...prev]; n[idx] = match; return n; });
    setLegacyResolved(prev => { const n = [...prev]; n[idx] = true; return n; });
  }, []);

  const legacySimulateOne = useCallback((idx: number) => {
    const m = legacyCurrentMatches[idx];
    const result = simulateMatch(m.team1, m.team2, m.bo);
    legacyUpdateMatch(idx, result);
    const stats = generateMatchStats(m.team1, m.team2, getTeamRoster(m.team1), getTeamRoster(m.team2), result.score1, result.score2, m.bo);
    setAllMatchStats(prev => ({ ...prev, [`${m.team1}-vs-${m.team2}`]: stats }));
  }, [legacyCurrentMatches, legacyUpdateMatch]);

  const legacySimulateAllCurrent = useCallback(() => {
    const next = [...legacyCurrentMatches];
    const res = [...legacyResolved];
    const newStats: Record<string, MatchStats> = {};
    next.forEach((m, i) => {
      if (!res[i] && m.team2 !== "BYE") {
        const result = simulateMatch(m.team1, m.team2, m.bo);
        next[i] = result;
        res[i] = true;
        newStats[`${m.team1}-vs-${m.team2}`] = generateMatchStats(m.team1, m.team2, getTeamRoster(m.team1), getTeamRoster(m.team2), result.score1, result.score2, m.bo);
      }
    });
    setLegacyCurrentMatches(next);
    setLegacyResolved(res);
    setAllMatchStats(prev => ({ ...prev, ...newStats }));
  }, [legacyCurrentMatches, legacyResolved]);

  const legacyAdvanceRound = useCallback(() => {
    const roundIdx = legacyCompletedRounds.length;
    const newCompleted = [...legacyCompletedRounds, { name: legacyRoundName, matches: legacyCurrentMatches }];
    setLegacyCompletedRounds(newCompleted);
    const winners = legacyCurrentMatches.map(m => m.winner);

    if (winners.length <= qualifierSlots || roundIdx + 1 >= legacyTotalRounds) {
      setLegacyQualifiedTeams(winners.slice(0, qualifierSlots));
      setLegacyCurrentMatches([]);
      setPhase("finished");
      return;
    }

    const nextRoundIdx = roundIdx + 1;
    setLegacyRoundName(getLegacyRoundName(nextRoundIdx));
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
    setLegacyCurrentMatches(matches);
    setLegacyResolved(matches.map(m => m.team2 === "BYE"));
  }, [legacyCompletedRounds, legacyCurrentMatches, legacyRoundName, legacyTotalRounds, qualifierSlots]);

  const legacyAllResolved = legacyResolved.length > 0 && legacyResolved.every(Boolean);
  const qualType = isRegional ? "Regionalne" : tournament.qualification.qualifierType === "regional" ? "Regionalne" : "Open";

  const getStatsForMatch = (m: MatchResult): MatchStats | null => {
    return allMatchStats[`${m.team1}-vs-${m.team2}`] || null;
  };

  // Final qualified teams
  const finalQualified = isRegional ? totalRegionalQualified : legacyQualifiedTeams;

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
            isRegional={isRegional}
            regionalSlots={regionalSlots}
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
                  {qualifierSlots} miejsc do zdobycia {isRegional ? `• ${regions.length} regionów` : `• ${teamsForBracket.length} drużyn`}
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

            {/* REGIONAL BRACKETS */}
            {isRegional ? (
              <div className="space-y-4">
                {Object.entries(regionalBrackets).sort(([, a], [, b]) => b.slots - a.slots).map(([region, bracketState]) => (
                  <RegionalBracket
                    key={region}
                    state={bracketState}
                    onStateChange={(newState) => setRegionalBrackets(prev => ({ ...prev, [region]: newState }))}
                    allMatchStats={allMatchStats}
                    onUpdateStats={handleUpdateStats}
                  />
                ))}

                {allRegionsFinished && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={() => setPhase("finished")}
                      className="flex items-center gap-2 px-8 py-3 gradient-primary text-primary-foreground rounded-md font-heading font-bold hover:opacity-90 transition-opacity"
                    >
                      <Trophy className="w-5 h-5" />
                      Podsumowanie kwalifikacji →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* NON-REGIONAL BRACKET */
              <div className="bg-card border border-border rounded-lg p-4">
                {legacyActiveMatchDetail !== null && legacyCurrentMatches[legacyActiveMatchDetail] && (
                  <QualMatchDetail
                    match={legacyCurrentMatches[legacyActiveMatchDetail]}
                    onUpdate={(updated) => legacyUpdateMatch(legacyActiveMatchDetail, updated)}
                    onSimulate={() => legacySimulateOne(legacyActiveMatchDetail)}
                    resolved={legacyResolved[legacyActiveMatchDetail]}
                    matchStats={getStatsForMatch(legacyCurrentMatches[legacyActiveMatchDetail])}
                    onUpdateStats={handleUpdateStats}
                    onClose={() => setLegacyActiveMatchDetail(null)}
                  />
                )}

                {legacyActiveMatchDetail === null && (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-heading font-bold text-foreground">{legacyRoundName}</h3>
                      <div className="flex gap-2">
                        <button onClick={legacySimulateAllCurrent} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-primary border border-primary/30 rounded hover:bg-primary/10 transition-colors">
                          <SkipForward className="w-3 h-3" /> Symuluj rundę
                        </button>
                        {legacyAllResolved && (
                          <button onClick={legacyAdvanceRound} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono gradient-primary text-primary-foreground rounded hover:opacity-90 transition-opacity">
                            Dalej →
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {legacyCurrentMatches.map((m, i) => (
                        <EditableMatch
                          key={`${m.team1}-${m.team2}-${i}`}
                          match={m}
                          index={i}
                          onUpdate={legacyUpdateMatch}
                          onSimulate={legacySimulateOne}
                          resolved={legacyResolved[i]}
                          matchStats={getStatsForMatch(m)}
                          onUpdateStats={handleUpdateStats}
                          onOpenDetail={() => setLegacyActiveMatchDetail(i)}
                        />
                      ))}
                    </div>

                    {legacyCompletedRounds.length > 0 && (
                      <div className="mt-6 border-t border-border pt-4">
                        <h4 className="text-sm font-mono text-muted-foreground mb-3">Zakończone rundy</h4>
                        {legacyCompletedRounds.map((round, ri) => (
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
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* FINISHED PHASE */}
        {phase === "finished" && (
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="text-center mb-6">
              <Trophy className="w-10 h-10 text-accent mx-auto mb-3" />
              <h3 className="font-heading text-xl font-bold text-foreground">Kwalifikacje zakończone!</h3>
              <p className="text-muted-foreground text-sm mt-1">{finalQualified.length} drużyn zakwalifikowało się do {tournament.name}</p>
            </div>

            {/* Regional breakdown */}
            {isRegional && (
              <div className="space-y-3 mb-6">
                {Object.entries(regionalBrackets).sort(([, a], [, b]) => b.slots - a.slots).map(([region, bracketState]) => (
                  <div key={region} className="bg-secondary/30 border border-border/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      <h4 className="font-heading font-bold text-foreground text-sm">{regionNames[region] || region}</h4>
                      <span className="text-[10px] font-mono text-muted-foreground">({bracketState.qualifiedTeams.length} drużyn)</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {bracketState.qualifiedTeams.map((t, i) => (
                        <motion.span
                          key={t}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.05 }}
                          className="px-2 py-1 bg-win/10 text-win border border-win/20 rounded text-xs font-mono"
                        >
                          {t}
                        </motion.span>
                      ))}
                    </div>
                    {bracketState.completedRounds.length > 0 && (
                      <div className="mt-2 border-t border-border/30 pt-2">
                        {bracketState.completedRounds.map((round, ri) => (
                          <div key={ri} className="mb-1">
                            <p className="text-[10px] font-mono text-primary mb-1">{round.name}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                              {round.matches.filter(m => m.team2 !== "BYE").map((m, mi) => (
                                <div key={mi} className="flex items-center text-xs bg-secondary/50 rounded px-2 py-0.5">
                                  <span className={cn("flex-1 text-right truncate", m.winner === m.team1 ? "text-foreground font-bold" : "text-muted-foreground")}>{m.team1}</span>
                                  <span className="mx-1 font-mono text-muted-foreground text-[10px]">{m.score1}:{m.score2}</span>
                                  <span className={cn("flex-1 truncate", m.winner === m.team2 ? "text-foreground font-bold" : "text-muted-foreground")}>{m.team2}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Non-regional results */}
            {!isRegional && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
                  {finalQualified.map((t, i) => (
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

                {legacyCompletedRounds.length > 0 && (
                  <div className="border-t border-border pt-4 mb-6">
                    <h4 className="text-sm font-mono text-muted-foreground mb-3">Przebieg kwalifikacji</h4>
                    {legacyCompletedRounds.map((round, ri) => (
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
              </>
            )}

            <div className="flex justify-center">
              <button
                onClick={() => onComplete(finalQualified, activeManualInvites)}
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
