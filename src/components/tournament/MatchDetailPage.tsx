import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, Plus, Trash2, Sword, Wand2, TrendingUp, TrendingDown, ArrowUp, ArrowDown, Sparkles, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MatchResult, MatchMap, MapPlayerStats } from "@/lib/types";
import { calculateRating, getRatingColor } from "@/lib/playerStats";
import { teamDatabase } from "@/data/tournaments";
import { resolveLineup } from "@/lib/tournamentLineups";
import { simulateMatch } from "@/lib/matchSimulator";
import { toast } from "@/hooks/use-toast";
import TeamLogo from "@/components/TeamLogo";
import { predictBothOutcomes, predictMatch, predictRankDelta, getRankingSnapshot } from "@/lib/vrsFormula";
import { MatchComparePanel } from "./MatchComparePanel";
import { getDisplayScore } from "@/lib/matchDisplay";
import { TeamLink, PlayerLink } from "@/lib/profileNav";
import { resolvePlayerCountry } from "@/lib/playerCountry";
import { countryFlag, normalizeCountry } from "@/lib/flags";
import { getWorldDate } from "@/lib/worldClock";

const MAP_POOL = ["Anubis", "Ancient", "Cache", "Dust II", "Inferno", "Mirage", "Nuke", "Overpass", "Train", "Tuscan", "Vertigo"];

interface Props {
  match: MatchResult;
  phaseName: string;
  bo: 1 | 3 | 5;
  tier?: string;
  tournamentId?: string;
  onBack: () => void;
  onUpdate: (patch: Partial<MatchResult>) => void;
  onConfirm?: (winner: string, loser: string, pointsWin: number, pointsLose: number) => void;
}

const blankPlayer = (name: string, team: string): MapPlayerStats => ({
  playerName: name,
  team,
  kills: 0,
  assists: 0,
  deaths: 0,
  adr: 0,
  kast: 0,
  ud: 0,
  ef: 0,
});

const getRoster = (teamName: string, tournamentId?: string): string[] => {
  const lineup = resolveLineup(tournamentId, teamName);
  if (lineup.length > 0) return lineup.slice(0, 5);
  const team = teamDatabase.find(t => t.name === teamName);
  return (team?.roster || []).slice(0, 5);
};

const ensurePlayers = (existing: MapPlayerStats[] | undefined, teamName: string, tournamentId?: string): MapPlayerStats[] => {
  const roster = getRoster(teamName, tournamentId);
  const base = roster.length === 5
    ? roster.map(n => blankPlayer(n, teamName))
    : Array.from({ length: 5 }, (_, i) => blankPlayer(roster[i] || `Player ${i + 1}`, teamName));
  if (!existing || existing.length === 0) return base;
  const merged = [...existing];
  while (merged.length < 5) merged.push(base[merged.length]);
  return merged.slice(0, 5);
};

export const MatchDetailPage = ({ match, phaseName, bo, tier = "B", tournamentId, onBack, onUpdate, onConfirm }: Props) => {
  const [tab, setTab] = useState<string>("score");
  const [activeMapIdx, setActiveMapIdx] = useState(0);

  const maps: MatchMap[] = useMemo(() => match.maps || [], [match.maps]);

  const isMapDecided = (m: MatchMap) => {
    const max = Math.max(m.score1, m.score2);
    const diff = Math.abs(m.score1 - m.score2);
    // CS2 MR12: first to 13 with 2-round lead. Overtime increments by 3 (16, 19, 22, …).
    return max >= 13 && diff >= 2;
  };

  const computedScore = useMemo(() => {
    if (maps.length === 0) return { s1: match.score1, s2: match.score2 };
    let s1 = 0, s2 = 0;
    maps.forEach(m => {
      if (!isMapDecided(m)) return;
      if (m.score1 > m.score2) s1++;
      else if (m.score2 > m.score1) s2++;
    });
    return { s1, s2 };
  }, [maps, match.score1, match.score2]);


  useEffect(() => {
    if (maps.length === 0) return;
    if (computedScore.s1 !== match.score1 || computedScore.s2 !== match.score2) {
      onUpdate({ score1: computedScore.s1, score2: computedScore.s2 });
    }
  }, [computedScore.s1, computedScore.s2]);

  const updateMap = (idx: number, patch: Partial<MatchMap>) => {
    const next = maps.map((m, i) => i === idx ? { ...m, ...patch } : m);
    onUpdate({ maps: next });
  };

  // For BO3 we play to 2 wins (max 3 maps); BO5 to 3 wins (max 5).
  // Once a side reaches the required wins we forbid adding more maps.
  const mapsToWin = bo === 1 ? 1 : bo === 3 ? 2 : 3;
  const seriesDecided = computedScore.s1 >= mapsToWin || computedScore.s2 >= mapsToWin;

  const addMap = () => {
    if (maps.length >= bo) return;
    if (seriesDecided) return;
    const used = new Set(maps.map(m => m.map));
    const available = MAP_POOL.find(m => !used.has(m)) || MAP_POOL[maps.length % MAP_POOL.length];
    const newMap: MatchMap = {
      map: available,
      score1: 0,
      score2: 0,
      team1Players: ensurePlayers(undefined, match.team1, tournamentId),
      team2Players: ensurePlayers(undefined, match.team2, tournamentId),
    };
    onUpdate({ maps: [...maps, newMap] });
    setActiveMapIdx(maps.length);
  };

  const removeMap = (idx: number) => {
    onUpdate({ maps: maps.filter((_, i) => i !== idx) });
    if (activeMapIdx >= maps.length - 1) setActiveMapIdx(Math.max(0, maps.length - 2));
  };

  const handleSimulate = () => {
    if (!match.team1 || !match.team2 || match.team1 === "TBD" || match.team2 === "TBD") {
      toast({ title: "Nie można symulować", description: "Najpierw przypisz obie drużyny.", variant: "destructive" });
      return;
    }
    const result = simulateMatch(match.team1, match.team2, bo, { tournamentId });
    onUpdate({
      score1: result.score1,
      score2: result.score2,
      maps: result.maps,
    });
    setActiveMapIdx(0);
    const shown = bo === 1 && result.maps[0]
      ? `${result.maps[0].score1}-${result.maps[0].score2}`
      : `${result.score1}-${result.score2}`;
    toast({
      title: `Symulacja: ${match.team1} ${shown} ${match.team2}`,
      description: `Wygenerowano ${result.maps.length} map ze statystykami zgodnymi z siłą drużyn.`,
    });
  };

  const updatePlayer = (
    mapIdx: number,
    side: "team1Players" | "team2Players",
    playerIdx: number,
    patch: Partial<MapPlayerStats>,
  ) => {
    const m = maps[mapIdx];
    const players = (m[side] || []).map((p, i) => {
      if (i !== playerIdx) return p;
      const updated = { ...p, ...patch };
      const totalRounds = (m.score1 || 0) + (m.score2 || 0);
      updated.rating = calculateRating({ ...updated, rounds: totalRounds });
      return updated;
    });
    updateMap(mapIdx, { [side]: players } as Partial<MatchMap>);
  };

  const winner1 = computedScore.s1 > computedScore.s2 && computedScore.s1 + computedScore.s2 > 0;
  const winner2 = computedScore.s2 > computedScore.s1 && computedScore.s1 + computedScore.s2 > 0;
  const matchDecided = (winner1 || winner2) && (computedScore.s1 >= mapsToWin || computedScore.s2 >= mapsToWin);
  const winnerName = winner1 ? match.team1 : winner2 ? match.team2 : "";
  const loserName = winner1 ? match.team2 : winner2 ? match.team1 : "";

  // ===== VRS-style ranking points =====
  const ranking = useMemo(() => getRankingSnapshot(), [match.id]);
  const isNationalMatch = useMemo(() => {
    const t1 = ranking.find(t => t.name === match.team1);
    const t2 = ranking.find(t => t.name === match.team2);
    return !!(t1?.isNational || t2?.isNational);
  }, [ranking, match.team1, match.team2]);
  const previews = useMemo(() => {
    if (!match.team1 || !match.team2 || match.team1 === "TBD" || match.team2 === "TBD" || match.team2 === "BYE") {
      return null;
    }
    return predictBothOutcomes(match.team1, match.team2, tier, ranking);
  }, [match.team1, match.team2, tier, ranking]);

  // Default points come from VRS based on the currently-projected winner.
  const vrsDefaults = useMemo(() => {
    if (!winnerName || !loserName) {
      // No projected winner yet — show the prediction for team1 winning by default.
      if (previews) return { win: previews.team1Wins.winPoints, lose: previews.team1Wins.lossPoints };
      return { win: 20, lose: 10 };
    }
    const p = predictMatch(winnerName, loserName, tier, ranking);
    return { win: p.winPoints, lose: p.lossPoints };
  }, [winnerName, loserName, tier, ranking, previews]);

  const [pointsWin, setPointsWin] = useState<number>(match.pointsWinner ?? vrsDefaults.win);
  const [pointsLose, setPointsLose] = useState<number>(match.pointsLoser ?? vrsDefaults.lose);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // When the projected winner changes (and user hasn't pinned custom points), refresh defaults.
  useEffect(() => {
    if (match.pointsWinner === undefined) setPointsWin(vrsDefaults.win);
    if (match.pointsLoser === undefined) setPointsLose(vrsDefaults.lose);
  }, [vrsDefaults.win, vrsDefaults.lose]);

  useEffect(() => {
    if (match.pointsWinner !== undefined) setPointsWin(match.pointsWinner);
    if (match.pointsLoser !== undefined) setPointsLose(match.pointsLoser);
  }, [match.id]);

  const winnerRankDelta = useMemo(() => winnerName ? predictRankDelta(winnerName, pointsWin, ranking) : null, [winnerName, pointsWin, ranking]);
  const loserRankDelta = useMemo(() => loserName ? predictRankDelta(loserName, -pointsLose, ranking) : null, [loserName, pointsLose, ranking]);

  const openConfirm = () => {
    if (!matchDecided || !winnerName || !loserName) {
      toast({ title: "Mecz nierozstrzygnięty", description: `Wpisz wynik (do ${mapsToWin} wygranych map).`, variant: "destructive" });
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    onUpdate({ pointsWinner: pointsWin, pointsLoser: pointsLose, resultConfirmed: true });
    onConfirm?.(winnerName, loserName, pointsWin, pointsLose);
    toast({
      title: "Wynik zatwierdzony",
      description: `${winnerName} +${pointsWin} pkt • ${loserName} −${pointsLose} pkt`,
    });
    setConfirmOpen(false);
    onBack();
  };

  const resetToVrs = () => {
    setPointsWin(vrsDefaults.win);
    setPointsLose(vrsDefaults.lose);
  };

  return (
    <section className="py-6">
      <div className="container mx-auto px-4 max-w-6xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Powrót do turnieju
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-card to-secondary/30 border border-border rounded-xl p-6 mb-6"
        >
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Sword className="w-4 h-4 text-primary" />
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                {phaseName} • {match.round || "Mecz"}
              </span>
              <div className="flex items-center gap-1.5 ml-1">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Format:</span>
                {(() => {
                  const isFinal = /final/i.test(match.round || "") && !/semi/i.test(match.round || "");
                  const options: (1 | 3 | 5)[] = isFinal ? [3, 5] : [1, 3, 5];
                  return (
                    <select
                      value={bo}
                      onChange={e => {
                        const newBo = parseInt(e.target.value) as 1 | 3 | 5;
                        const mapsToWinNew = newBo === 1 ? 1 : newBo === 3 ? 2 : 3;
                        const trimmedMaps = (match.maps || []).slice(0, newBo);
                        // Recompute series score from trimmed maps
                        let s1 = 0, s2 = 0;
                        trimmedMaps.forEach(m => {
                          const max = Math.max(m.score1, m.score2);
                          const diff = Math.abs(m.score1 - m.score2);
                          if (max >= 13 && diff >= 2) {
                            if (m.score1 > m.score2) s1++; else s2++;
                          }
                        });
                        const patch: Partial<MatchResult> = { bo: newBo };
                        if ((match.maps || []).length !== trimmedMaps.length) {
                          patch.maps = trimmedMaps;
                          patch.score1 = s1;
                          patch.score2 = s2;
                        }
                        onUpdate(patch);
                        toast({ title: `Format meczu: BO${newBo}`, description: `Mecz rozgrywany do ${mapsToWinNew} wygranych map.` });
                      }}
                      className="h-6 px-1.5 rounded bg-secondary/40 border border-border text-xs font-mono text-foreground"
                    >
                      {options.map(o => <option key={o} value={o}>BO{o}</option>)}
                    </select>
                  );
                })()}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSimulate}
              className="h-7 gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10"
              title="Wygeneruj wynik i statystyki na podstawie siły obu drużyn"
            >
              <Wand2 className="w-3.5 h-3.5" />
              {maps.length > 0 ? "Przegeneruj" : "Symuluj mecz"}
            </Button>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
            <div className={cn("flex items-center gap-3 justify-end min-w-0", winner1 && "text-foreground")}>
              {match.team1 && match.team1 !== "TBD" && <TeamLogo teamName={match.team1} size={44} rounded="lg" />}
              <TeamLink name={match.team1} className={cn("text-2xl font-heading font-bold truncate", winner1 ? "text-foreground" : "text-muted-foreground")}>
                {match.team1 || "TBD"}
              </TeamLink>
            </div>
            <div className="flex items-center gap-3 font-mono text-5xl font-bold">
              {(() => {
                const [hs1, hs2] = bo === 1 ? getDisplayScore(match) : [computedScore.s1, computedScore.s2];
                return (<>
                  <span className={winner1 ? "text-[hsl(var(--win))]" : "text-muted-foreground"}>{hs1}</span>
                  <span className="text-muted-foreground text-3xl">:</span>
                  <span className={winner2 ? "text-[hsl(var(--win))]" : "text-muted-foreground"}>{hs2}</span>
                </>);
              })()}
            </div>
            <div className={cn("flex items-center gap-3 min-w-0", winner2 && "text-foreground")}>
              <TeamLink name={match.team2} className={cn("text-2xl font-heading font-bold truncate", winner2 ? "text-foreground" : "text-muted-foreground")}>
                {match.team2 || "TBD"}
              </TeamLink>
              {match.team2 && match.team2 !== "TBD" && <TeamLogo teamName={match.team2} size={44} rounded="lg" />}
            </div>
          </div>

          {/* Termin meczu (fikcyjny kalendarz) */}
          {(() => {
            const schedDate = match.scheduledAt?.slice(0, 10) || "";
            const schedTime = match.scheduledAt?.slice(11, 16) || "";
            const setSchedule = (d: string, t: string) => {
              if (!d) { onUpdate({ scheduledAt: undefined }); return; }
              onUpdate({ scheduledAt: `${d}T${t || "18:00"}` });
            };
            return (
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center gap-2 flex-wrap justify-center">
                <CalendarClock className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Termin</span>
                <input
                  type="date"
                  value={schedDate}
                  onChange={e => setSchedule(e.target.value, schedTime)}
                  className="h-7 px-2 rounded bg-secondary/40 border border-border text-xs font-mono text-foreground"
                />
                <input
                  type="time"
                  value={schedTime}
                  onChange={e => setSchedule(schedDate || getWorldDate(), e.target.value)}
                  className="h-7 px-2 rounded bg-secondary/40 border border-border text-xs font-mono text-foreground"
                />
                <button
                  type="button"
                  onClick={() => setSchedule(getWorldDate(), schedTime || "18:00")}
                  className="h-7 px-2 rounded border border-primary/40 text-primary hover:bg-primary/10 text-xs font-mono"
                  title="Ustaw datę z fikcyjnego kalendarza"
                >
                  Dzisiaj ({getWorldDate()})
                </button>
                {match.scheduledAt && (
                  <button
                    type="button"
                    onClick={() => onUpdate({ scheduledAt: undefined })}
                    className="h-7 px-2 rounded border border-border text-muted-foreground hover:text-foreground text-xs font-mono"
                  >
                    Wyczyść
                  </button>
                )}
              </div>
            );
          })()}
        </motion.div>


        {/* VRS prediction + confirm trigger */}
        <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> {isNationalMatch ? "Mecz reprezentacji" : `Predykcja VRS • Tier ${tier}`}
            </h3>
            {match.resultConfirmed && !isNationalMatch && (
              <span className="text-xs font-mono text-[hsl(var(--win))] uppercase tracking-wider">
                ✓ Zatwierdzone ({match.pointsWinner ?? pointsWin}/−{match.pointsLoser ?? pointsLose})
              </span>
            )}
          </div>

          {isNationalMatch ? (
            <p className="text-xs font-mono text-muted-foreground">
              Reprezentacje narodowe nie liczą się do rankingu VRS — predykcja niedostępna.
            </p>
          ) : previews ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PredictionCard
                team={match.team1}
                winPoints={previews.team1Wins.winPoints}
                lossPoints={previews.team2Wins.lossPoints}
                expected={previews.team1Wins.expectedWinner}
                upset={previews.team1Wins.upset}
                rankIfWin={predictRankDelta(match.team1, previews.team1Wins.winPoints, ranking)}
                rankIfLose={predictRankDelta(match.team1, -previews.team2Wins.lossPoints, ranking)}
                highlighted={winner1}
              />
              <PredictionCard
                team={match.team2}
                winPoints={previews.team2Wins.winPoints}
                lossPoints={previews.team1Wins.lossPoints}
                expected={previews.team2Wins.expectedWinner}
                upset={previews.team2Wins.upset}
                rankIfWin={predictRankDelta(match.team2, previews.team2Wins.winPoints, ranking)}
                rankIfLose={predictRankDelta(match.team2, -previews.team1Wins.lossPoints, ranking)}
                highlighted={winner2}
              />
            </div>
          ) : (
            <p className="text-xs font-mono text-muted-foreground">
              Predykcja dostępna po przypisaniu obu drużyn.
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={onBack} className="h-8 text-xs">
              Powrót bez zatwierdzania
            </Button>
            <Button
              size="sm"
              onClick={openConfirm}
              disabled={!matchDecided}
              className="h-8 gap-1.5 text-xs bg-[hsl(var(--win))] hover:bg-[hsl(var(--win))]/90 text-background"
              title={!matchDecided ? `Wpisz/przesymuluj wynik (do ${mapsToWin} wygranych map)` : undefined}
            >
              <Trophy className="w-3.5 h-3.5" />
              {match.resultConfirmed ? "Zaktualizuj punkty" : "Zatwierdź wynik"}
            </Button>
          </div>
        </div>


        {/* Confirmation modal */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[hsl(var(--gold))]" />
                Zatwierdź wynik meczu
              </DialogTitle>
              <DialogDescription className="text-xs">
                {phaseName} • {match.round || "Mecz"} • Tier {tier}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="text-center text-sm font-mono py-2 bg-secondary/40 rounded-md border border-border">
                <span className="text-foreground font-bold">{winnerName}</span>
                <span className="text-muted-foreground mx-2">pokonał</span>
                <span className="text-muted-foreground">{loserName}</span>
                <div className="text-[hsl(var(--win))] font-bold text-lg mt-1">
                  {Math.max(computedScore.s1, computedScore.s2)} : {Math.min(computedScore.s1, computedScore.s2)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase text-muted-foreground tracking-wider block">
                    Punkty dla zwycięzcy
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-[hsl(var(--win))] font-mono text-sm">+</span>
                    <Input
                      type="number"
                      value={pointsWin}
                      onChange={e => setPointsWin(parseInt(e.target.value) || 0)}
                      className="h-9 text-center font-mono"
                    />
                  </div>
                  {winnerRankDelta && winnerRankDelta.from > 0 && (
                    <p className="text-xs font-mono text-muted-foreground text-center">
                      Miejsce #{winnerRankDelta.from} → #{winnerRankDelta.to}
                      {winnerRankDelta.delta !== 0 && (
                        <span className={cn("ml-1 font-bold", winnerRankDelta.delta > 0 ? "text-[hsl(var(--win))]" : "text-destructive")}>
                          {winnerRankDelta.delta > 0
                            ? <><ArrowUp className="w-2.5 h-2.5 inline" />{winnerRankDelta.delta}</>
                            : <><ArrowDown className="w-2.5 h-2.5 inline" />{Math.abs(winnerRankDelta.delta)}</>}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-mono uppercase text-muted-foreground tracking-wider block">
                    Punkty odjęte przegranemu
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-destructive font-mono text-sm">−</span>
                    <Input
                      type="number"
                      value={pointsLose}
                      onChange={e => setPointsLose(parseInt(e.target.value) || 0)}
                      className="h-9 text-center font-mono"
                    />
                  </div>
                  {loserRankDelta && loserRankDelta.from > 0 && (
                    <p className="text-xs font-mono text-muted-foreground text-center">
                      Miejsce #{loserRankDelta.from} → #{loserRankDelta.to}
                      {loserRankDelta.delta !== 0 && (
                        <span className={cn("ml-1 font-bold", loserRankDelta.delta > 0 ? "text-[hsl(var(--win))]" : "text-destructive")}>
                          {loserRankDelta.delta > 0
                            ? <><ArrowUp className="w-2.5 h-2.5 inline" />{loserRankDelta.delta}</>
                            : <><ArrowDown className="w-2.5 h-2.5 inline" />{Math.abs(loserRankDelta.delta)}</>}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={resetToVrs}
                className="text-xs font-mono text-primary hover:underline w-full text-center"
              >
                ↺ Przywróć wartości VRS ({vrsDefaults.win} / {vrsDefaults.lose})
              </button>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>
                Anuluj
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                className="gap-1.5 bg-[hsl(var(--win))] hover:bg-[hsl(var(--win))]/90 text-background"
              >
                <Trophy className="w-3.5 h-3.5" />
                Potwierdź wynik
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>



        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-5 w-full max-w-2xl mb-4">
            <TabsTrigger value="score">Wynik</TabsTrigger>
            <TabsTrigger value="maps">Mapy ({maps.length}/{bo})</TabsTrigger>
            <TabsTrigger value="compare">Porównanie</TabsTrigger>
            <TabsTrigger value="t1">Stats {match.team1 || "T1"}</TabsTrigger>
            <TabsTrigger value="t2">Stats {match.team2 || "T2"}</TabsTrigger>
          </TabsList>

          <TabsContent value="compare">
            {match.team1 && match.team2 && match.team1 !== "TBD" && match.team2 !== "TBD" && match.team2 !== "BYE" ? (
              <MatchComparePanel
                team1={match.team1}
                team2={match.team2}
                tier={tier}
                bo={bo}
                tournamentId={tournamentId}
              />
            ) : (
              <div className="bg-card border border-dashed border-border rounded-lg p-10 text-center">
                <p className="text-sm text-muted-foreground font-mono">
                  Porównanie dostępne po przypisaniu obu drużyn.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="score" className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider mb-4">
                Wynik meczu (mapy wygrane)
              </h3>
              {maps.length > 0 ? (
                <p className="text-sm text-muted-foreground font-mono">
                  Wynik liczony automatycznie z zakładki <span className="text-foreground">Mapy</span>:
                  <span className="text-foreground ml-2 text-base">{computedScore.s1} – {computedScore.s2}</span>
                </p>
              ) : (
                <div className="flex items-center gap-3">
                  <Input
                    type="number" min="0"
                    value={match.score1}
                    onChange={e => onUpdate({ score1: parseInt(e.target.value) || 0 })}
                    className="w-20 text-center font-mono text-lg"
                  />
                  <span className="text-muted-foreground">:</span>
                  <Input
                    type="number" min="0"
                    value={match.score2}
                    onChange={e => onUpdate({ score2: parseInt(e.target.value) || 0 })}
                    className="w-20 text-center font-mono text-lg"
                  />
                  <span className="text-xs text-muted-foreground ml-3 font-mono">
                    Dodaj mapy w zakładce „Mapy" aby uzyskać szczegółowy scoreboard
                  </span>
                </div>
              )}
            </div>

            {maps.length > 0 && (
              <>
                <MatchPlayerTotals match={match} maps={maps} side="team1Players" teamName={match.team1} />
                <MatchPlayerTotals match={match} maps={maps} side="team2Players" teamName={match.team2} />
              </>
            )}

            {maps.length > 0 && (
              <div className="bg-card border border-border rounded-lg p-5">
                <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider mb-3">
                  Mapy
                </h3>
                <div className="space-y-2">
                  {maps.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm font-mono p-2 rounded bg-secondary/30">
                      <span className="text-xs text-muted-foreground w-6">M{i + 1}</span>
                      <span className="text-primary w-24 truncate">{m.map}</span>
                      <div className={cn("flex-1 flex items-center justify-end gap-2 min-w-0", m.score1 > m.score2 && "text-foreground font-bold")}>
                        <span className="truncate">{match.team1}</span>
                        <TeamLogo teamName={match.team1} size={18} rounded="md" />
                      </div>
                      <span className="font-bold tabular-nums">{m.score1} : {m.score2}</span>
                      <div className={cn("flex-1 flex items-center gap-2 min-w-0", m.score2 > m.score1 && "text-foreground font-bold")}>
                        <TeamLogo teamName={match.team2} size={18} rounded="md" />
                        <span className="truncate">{match.team2}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="maps" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1.5">
                {maps.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveMapIdx(i)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-mono border transition-colors",
                      activeMapIdx === i
                        ? "bg-primary/20 text-primary border-primary/40"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Mapa {i + 1} • {m.map} ({m.score1}:{m.score2})
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1"
                onClick={addMap}
                disabled={maps.length >= bo || seriesDecided}
                title={seriesDecided ? `BO${bo} rozstrzygnięte (do ${mapsToWin} wygranych map) — kolejne mapy nie są grane.` : undefined}
              >
                <Plus className="w-3 h-3" /> Dodaj mapę
              </Button>
            </div>

            {seriesDecided && maps.length < bo && (
              <p className="text-xs font-mono text-[hsl(var(--win))] -mt-1">
                ✓ BO{bo} rozstrzygnięte ({computedScore.s1}:{computedScore.s2}) — gramy do {mapsToWin} wygranych map.
              </p>
            )}

            {maps.length === 0 && (
              <div className="bg-card border border-dashed border-border rounded-lg p-10 text-center">
                <Trophy className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
                <p className="text-sm text-muted-foreground font-mono">
                  Brak map. Dodaj pierwszą mapę aby wpisać wynik i statystyki graczy.
                </p>
              </div>
            )}

            {maps[activeMapIdx] && (
              <div className="bg-card border border-border rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-heading font-bold text-foreground">Mapa {activeMapIdx + 1}</h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => removeMap(activeMapIdx)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Usuń mapę
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-mono uppercase text-muted-foreground mb-1 block">Mapa</label>
                    <select
                      value={maps[activeMapIdx].map}
                      onChange={e => updateMap(activeMapIdx, { map: e.target.value })}
                      className="w-full h-9 px-2 rounded-md bg-secondary/40 border border-border text-sm font-mono"
                    >
                      {MAP_POOL.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-mono uppercase text-muted-foreground mb-1 block">
                      Rundy {match.team1}
                    </label>
                    <Input
                      type="number" min="0"
                      value={maps[activeMapIdx].score1}
                      onChange={e => updateMap(activeMapIdx, { score1: parseInt(e.target.value) || 0 })}
                      className="text-center font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono uppercase text-muted-foreground mb-1 block">
                      Rundy {match.team2}
                    </label>
                    <Input
                      type="number" min="0"
                      value={maps[activeMapIdx].score2}
                      onChange={e => updateMap(activeMapIdx, { score2: parseInt(e.target.value) || 0 })}
                      className="text-center font-mono"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  Wpisz statystyki graczy w zakładkach <span className="text-foreground">Stats {match.team1}</span> i <span className="text-foreground">Stats {match.team2}</span>.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="t1">
            <PlayerStatsTab
              maps={maps}
              activeMapIdx={activeMapIdx}
              setActiveMapIdx={setActiveMapIdx}
              side="team1Players"
              teamName={match.team1}
              onEnsurePlayers={() => {
                const m = maps[activeMapIdx];
                if (!m) return;
                if (!m.team1Players || m.team1Players.length < 5) {
                  updateMap(activeMapIdx, { team1Players: ensurePlayers(m.team1Players, match.team1, tournamentId) });
                }
              }}
              onUpdatePlayer={(pi, patch) => updatePlayer(activeMapIdx, "team1Players", pi, patch)}
            />
          </TabsContent>

          <TabsContent value="t2">
            <PlayerStatsTab
              maps={maps}
              activeMapIdx={activeMapIdx}
              setActiveMapIdx={setActiveMapIdx}
              side="team2Players"
              teamName={match.team2}
              onEnsurePlayers={() => {
                const m = maps[activeMapIdx];
                if (!m) return;
                if (!m.team2Players || m.team2Players.length < 5) {
                  updateMap(activeMapIdx, { team2Players: ensurePlayers(m.team2Players, match.team2, tournamentId) });
                }
              }}
              onUpdatePlayer={(pi, patch) => updatePlayer(activeMapIdx, "team2Players", pi, patch)}
            />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
};

const PredictionCard = ({
  team, winPoints, lossPoints, expected, upset, rankIfWin, rankIfLose, highlighted,
}: {
  team: string;
  winPoints: number;
  lossPoints: number;
  expected: number;
  upset: boolean;
  rankIfWin: { from: number; to: number; delta: number };
  rankIfLose: { from: number; to: number; delta: number };
  highlighted: boolean;
}) => {
  const RankDelta = ({ d }: { d: { from: number; to: number; delta: number } }) => {
    if (d.from <= 0) return <span className="text-muted-foreground">—</span>;
    if (d.delta === 0) return <span className="text-muted-foreground">#{d.from} (bez zmian)</span>;
    const up = d.delta > 0;
    return (
      <span className={cn("font-mono", up ? "text-[hsl(var(--win))]" : "text-destructive")}>
        #{d.from} → #{d.to}{" "}
        {up ? <ArrowUp className="w-2.5 h-2.5 inline" /> : <ArrowDown className="w-2.5 h-2.5 inline" />}
        {Math.abs(d.delta)}
      </span>
    );
  };
  return (
    <div className={cn(
      "rounded-lg border p-3 space-y-2 bg-secondary/20",
      highlighted ? "border-[hsl(var(--win))]/60 bg-[hsl(var(--win))]/5" : "border-border",
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <TeamLogo teamName={team} size={20} rounded="md" />
          <span className="text-xs font-bold truncate">{team}</span>
        </div>
        <span className={cn(
          "text-xs font-mono px-1.5 py-0.5 rounded border",
          upset
            ? "bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/40"
            : "bg-secondary text-muted-foreground border-border",
        )}>
          {upset ? "UPSET" : `${Math.round(expected * 100)}%`}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        <div className="space-y-0.5">
          <div className="text-muted-foreground uppercase tracking-wider text-xs">Jeśli wygra</div>
          <div className="text-[hsl(var(--win))] font-bold flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +{winPoints} pkt
          </div>
          <RankDelta d={rankIfWin} />
        </div>
        <div className="space-y-0.5">
          <div className="text-muted-foreground uppercase tracking-wider text-xs">Jeśli przegra</div>
          <div className="text-destructive font-bold flex items-center gap-1">
            <TrendingDown className="w-3 h-3" /> −{lossPoints} pkt
          </div>
          <RankDelta d={rankIfLose} />
        </div>
      </div>
    </div>
  );
};

const PlayerStatsTab = ({
  maps, activeMapIdx, setActiveMapIdx, side, teamName, onEnsurePlayers, onUpdatePlayer,
}: {
  maps: MatchMap[];
  activeMapIdx: number;
  setActiveMapIdx: (i: number) => void;
  side: "team1Players" | "team2Players";
  teamName: string;
  onEnsurePlayers: () => void;
  onUpdatePlayer: (playerIdx: number, patch: Partial<MapPlayerStats>) => void;
}) => {
  useEffect(() => { onEnsurePlayers(); }, [activeMapIdx]);

  const map = maps[activeMapIdx];
  if (!map) {
    return (
      <div className="bg-card border border-dashed border-border rounded-lg p-10 text-center">
        <p className="text-sm text-muted-foreground font-mono">
          Najpierw dodaj mapę w zakładce „Mapy".
        </p>
      </div>
    );
  }

  const players = (map[side] || []) as MapPlayerStats[];
  const totalRounds = (map.score1 || 0) + (map.score2 || 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {maps.map((m, i) => (
          <button
            key={i}
            onClick={() => setActiveMapIdx(i)}
            className={cn(
              "px-3 py-1 rounded text-xs font-mono border",
              activeMapIdx === i
                ? "bg-primary/20 text-primary border-primary/40"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            M{i + 1} • {m.map}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-secondary/40 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {teamName && teamName !== "TBD" && <TeamLogo teamName={teamName} size={28} rounded="md" />}
            <h4 className="text-sm font-heading font-bold text-foreground truncate">{teamName || "Drużyna"}</h4>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            Mapa {activeMapIdx + 1} • Rundy: {totalRounds}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-xs font-mono uppercase text-muted-foreground border-b border-border/50 bg-secondary/20">
                <th className="text-left px-3 py-2">Gracz</th>
                <th className="text-center px-2 py-2">K</th>
                <th className="text-center px-2 py-2">A</th>
                <th className="text-center px-2 py-2">D</th>
                <th className="text-center px-2 py-2">ADR</th>
                <th className="text-center px-2 py-2">UD</th>
                <th className="text-center px-2 py-2">EF</th>
                <th className="text-center px-2 py-2">KAST%</th>
                <th className="text-center px-2 py-2">Rating</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => {
                const rating = p.rating ?? calculateRating({ ...p, rounds: totalRounds });
                return (
                  <tr key={i} className="border-b border-border/20 hover:bg-secondary/20">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm leading-none">{countryFlag(normalizeCountry(resolvePlayerCountry(p.playerName)))}</span>
                        <Input
                          value={p.playerName}
                          onChange={e => onUpdatePlayer(i, { playerName: e.target.value })}
                          className="h-7 text-xs font-mono w-32"
                        />
                      </div>
                    </td>
                    <td className="px-1 py-2">
                      <NumCell value={p.kills} onChange={v => onUpdatePlayer(i, { kills: v })} />
                    </td>
                    <td className="px-1 py-2">
                      <NumCell value={p.assists} onChange={v => onUpdatePlayer(i, { assists: v })} />
                    </td>
                    <td className="px-1 py-2">
                      <NumCell value={p.deaths} onChange={v => onUpdatePlayer(i, { deaths: v })} />
                    </td>
                    <td className="px-1 py-2">
                      <NumCell value={p.adr} onChange={v => onUpdatePlayer(i, { adr: v })} />
                    </td>
                    <td className="px-1 py-2">
                      <NumCell value={p.ud} onChange={v => onUpdatePlayer(i, { ud: v })} />
                    </td>
                    <td className="px-1 py-2">
                      <NumCell value={p.ef} onChange={v => onUpdatePlayer(i, { ef: v })} />
                    </td>
                    <td className="px-1 py-2">
                      <NumCell value={p.kast} onChange={v => onUpdatePlayer(i, { kast: Math.min(100, v) })} max={100} />
                    </td>
                    <td className={cn("text-center px-2 py-2 font-mono font-bold tabular-nums", getRatingColor(rating))}>
                      {rating.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const NumCell = ({ value, onChange, max }: { value: number; onChange: (v: number) => void; max?: number }) => {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      type="number"
      min="0"
      max={max}
      value={draft ?? (value ? String(value) : "")}
      placeholder="0"
      onChange={e => {
        const raw = e.target.value;
        setDraft(raw);
        onChange(raw === "" ? 0 : parseInt(raw) || 0);
      }}
      onBlur={() => setDraft(null)}
      className="h-7 w-14 text-center text-xs font-mono px-1"
    />
  );
};

interface AggRow {
  name: string;
  kills: number;
  assists: number;
  deaths: number;
  ud: number;
  ef: number;
  adrSum: number;     // weighted by rounds
  kastSum: number;    // weighted by rounds
  rounds: number;
  ratings: number[];
  mapsPlayed: number;
}

const MatchPlayerTotals = ({
  match, maps, side, teamName,
}: {
  match: MatchResult;
  maps: MatchMap[];
  side: "team1Players" | "team2Players";
  teamName: string;
}) => {
  const rows = useMemo(() => {
    const agg = new Map<string, AggRow>();
    for (const m of maps) {
      const list = (m[side] || []) as MapPlayerStats[];
      const totalRounds = (m.score1 || 0) + (m.score2 || 0);
      if (totalRounds <= 0) continue;
      for (const p of list) {
        if (!p.playerName) continue;
        let r = agg.get(p.playerName);
        if (!r) {
          r = { name: p.playerName, kills: 0, assists: 0, deaths: 0, ud: 0, ef: 0, adrSum: 0, kastSum: 0, rounds: 0, ratings: [], mapsPlayed: 0 };
          agg.set(p.playerName, r);
        }
        r.kills += p.kills || 0;
        r.assists += p.assists || 0;
        r.deaths += p.deaths || 0;
        r.ud += p.ud || 0;
        r.ef += p.ef || 0;
        r.adrSum += (p.adr || 0) * totalRounds;
        r.kastSum += (p.kast || 0) * totalRounds;
        r.rounds += totalRounds;
        r.mapsPlayed += 1;
        const rt = (p.rating && p.rating > 0) ? p.rating : calculateRating({ ...p, rounds: totalRounds });
        if (rt > 0) r.ratings.push(rt);
      }
    }
    return Array.from(agg.values()).map(r => ({
      ...r,
      adr: r.rounds > 0 ? r.adrSum / r.rounds : 0,
      kast: r.rounds > 0 ? r.kastSum / r.rounds : 0,
      rating: r.ratings.length > 0 ? r.ratings.reduce((a, b) => a + b, 0) / r.ratings.length : 0,
    })).sort((a, b) => b.rating - a.rating);
  }, [maps, side]);

  if (rows.length === 0 || !teamName || teamName === "TBD") return null;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-secondary/40 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <TeamLogo teamName={teamName} size={28} rounded="md" />
          <TeamLink name={teamName} className="text-sm font-heading font-bold text-foreground truncate">{teamName}</TeamLink>
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            • Statystyki łączne ({maps.length} {maps.length === 1 ? "mapa" : "map"})
          </span>
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          K/A/D/UD/EF: suma · ADR/KAST/Rating: średnia
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-xs font-mono uppercase text-muted-foreground border-b border-border/50 bg-secondary/20">
              <th className="text-left px-3 py-2">Gracz</th>
              <th className="text-center px-2 py-2">Mapy</th>
              <th className="text-center px-2 py-2">K</th>
              <th className="text-center px-2 py-2">A</th>
              <th className="text-center px-2 py-2">D</th>
              <th className="text-center px-2 py-2">+/−</th>
              <th className="text-center px-2 py-2">ADR</th>
              <th className="text-center px-2 py-2">UD</th>
              <th className="text-center px-2 py-2">EF</th>
              <th className="text-center px-2 py-2">KAST%</th>
              <th className="text-center px-2 py-2">Rating</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.name} className="border-b border-border/20 hover:bg-secondary/20 font-mono">
                <td className="px-3 py-2 text-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm leading-none">{countryFlag(normalizeCountry(resolvePlayerCountry(r.name)))}</span>
                    <PlayerLink name={r.name}>{r.name}</PlayerLink>
                  </span>
                </td>
                <td className="text-center px-2 py-2 text-muted-foreground">{r.mapsPlayed}</td>
                <td className="text-center px-2 py-2 text-foreground">{r.kills}</td>
                <td className="text-center px-2 py-2 text-foreground">{r.assists}</td>
                <td className="text-center px-2 py-2 text-foreground">{r.deaths}</td>
                <td className={cn("text-center px-2 py-2", r.kills - r.deaths > 0 ? "text-[hsl(var(--win))]" : r.kills - r.deaths < 0 ? "text-[hsl(var(--loss))]" : "text-muted-foreground")}>
                  {r.kills - r.deaths > 0 ? "+" : ""}{r.kills - r.deaths}
                </td>
                <td className="text-center px-2 py-2 text-muted-foreground">{r.adr.toFixed(1)}</td>
                <td className="text-center px-2 py-2 text-foreground">{r.ud}</td>
                <td className="text-center px-2 py-2 text-foreground">{r.ef}</td>
                <td className="text-center px-2 py-2 text-muted-foreground">{r.kast.toFixed(0)}%</td>
                <td className={cn("text-center px-2 py-2 font-bold tabular-nums", getRatingColor(r.rating))}>
                  {r.rating.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
