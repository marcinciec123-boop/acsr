import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, Plus, Trash2, Sword, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { MatchResult, MatchMap, MapPlayerStats } from "@/lib/types";
import { calculateRating, getRatingColor } from "@/lib/playerStats";
import { teamDatabase } from "@/data/tournaments";
import { simulateMatch } from "@/lib/matchSimulator";
import { toast } from "@/hooks/use-toast";

const MAP_POOL = ["Anubis", "Ancient", "Cache", "Dust II", "Inferno", "Mirage", "Nuke", "Overpass", "Train", "Vertigo"];

interface Props {
  match: MatchResult;
  phaseName: string;
  bo: 1 | 3 | 5;
  onBack: () => void;
  onUpdate: (patch: Partial<MatchResult>) => void;
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

const getRoster = (teamName: string): string[] => {
  const team = teamDatabase.find(t => t.name === teamName);
  return (team?.roster || []).slice(0, 5);
};

const ensurePlayers = (existing: MapPlayerStats[] | undefined, teamName: string): MapPlayerStats[] => {
  const roster = getRoster(teamName);
  const base = roster.length === 5
    ? roster.map(n => blankPlayer(n, teamName))
    : Array.from({ length: 5 }, (_, i) => blankPlayer(roster[i] || `Player ${i + 1}`, teamName));
  if (!existing || existing.length === 0) return base;
  const merged = [...existing];
  while (merged.length < 5) merged.push(base[merged.length]);
  return merged.slice(0, 5);
};

export const MatchDetailPage = ({ match, phaseName, bo, onBack, onUpdate }: Props) => {
  const [tab, setTab] = useState<string>("score");
  const [activeMapIdx, setActiveMapIdx] = useState(0);

  const maps: MatchMap[] = useMemo(() => match.maps || [], [match.maps]);

  const computedScore = useMemo(() => {
    if (maps.length === 0) return { s1: match.score1, s2: match.score2 };
    let s1 = 0, s2 = 0;
    maps.forEach(m => {
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
      team1Players: ensurePlayers(undefined, match.team1),
      team2Players: ensurePlayers(undefined, match.team2),
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
    const result = simulateMatch(match.team1, match.team2, bo);
    onUpdate({
      score1: result.score1,
      score2: result.score2,
      maps: result.maps,
    });
    setActiveMapIdx(0);
    toast({
      title: `Symulacja: ${match.team1} ${result.score1}-${result.score2} ${match.team2}`,
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
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Sword className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {phaseName} • {match.round || "Mecz"} • BO{bo}
              </span>
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
            <div className={cn("text-right", winner1 && "text-foreground")}>
              <p className={cn("text-2xl font-heading font-bold truncate", winner1 ? "text-foreground" : "text-muted-foreground")}>
                {match.team1 || "TBD"}
              </p>
            </div>
            <div className="flex items-center gap-3 font-mono text-5xl font-bold">
              <span className={winner1 ? "text-[hsl(var(--win))]" : "text-muted-foreground"}>{computedScore.s1}</span>
              <span className="text-muted-foreground text-3xl">:</span>
              <span className={winner2 ? "text-[hsl(var(--win))]" : "text-muted-foreground"}>{computedScore.s2}</span>
            </div>
            <div className={cn("text-left", winner2 && "text-foreground")}>
              <p className={cn("text-2xl font-heading font-bold truncate", winner2 ? "text-foreground" : "text-muted-foreground")}>
                {match.team2 || "TBD"}
              </p>
            </div>
          </div>
        </motion.div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-4 w-full max-w-xl mb-4">
            <TabsTrigger value="score">Wynik</TabsTrigger>
            <TabsTrigger value="maps">Mapy ({maps.length}/{bo})</TabsTrigger>
            <TabsTrigger value="t1">Stats {match.team1 || "T1"}</TabsTrigger>
            <TabsTrigger value="t2">Stats {match.team2 || "T2"}</TabsTrigger>
          </TabsList>

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
              <div className="bg-card border border-border rounded-lg p-5">
                <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider mb-3">
                  Mapy
                </h3>
                <div className="space-y-2">
                  {maps.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm font-mono p-2 rounded bg-secondary/30">
                      <span className="text-[10px] text-muted-foreground w-6">M{i + 1}</span>
                      <span className="text-primary w-24 truncate">{m.map}</span>
                      <span className={cn("flex-1 text-right truncate", m.score1 > m.score2 && "text-foreground font-bold")}>
                        {match.team1}
                      </span>
                      <span className="font-bold tabular-nums">{m.score1} : {m.score2}</span>
                      <span className={cn("flex-1 truncate", m.score2 > m.score1 && "text-foreground font-bold")}>
                        {match.team2}
                      </span>
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
              <p className="text-[11px] font-mono text-[hsl(var(--win))] -mt-1">
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
                    <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">Mapa</label>
                    <select
                      value={maps[activeMapIdx].map}
                      onChange={e => updateMap(activeMapIdx, { map: e.target.value })}
                      className="w-full h-9 px-2 rounded-md bg-secondary/40 border border-border text-sm font-mono"
                    >
                      {MAP_POOL.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">
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
                    <label className="text-[10px] font-mono uppercase text-muted-foreground mb-1 block">
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
                  updateMap(activeMapIdx, { team1Players: ensurePlayers(m.team1Players, match.team1) });
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
                  updateMap(activeMapIdx, { team2Players: ensurePlayers(m.team2Players, match.team2) });
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
          <h4 className="text-sm font-heading font-bold text-foreground">{teamName || "Drużyna"}</h4>
          <span className="text-[10px] font-mono text-muted-foreground">
            Mapa {activeMapIdx + 1} • Rundy: {totalRounds}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] font-mono uppercase text-muted-foreground border-b border-border/50 bg-secondary/20">
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
                      <Input
                        value={p.playerName}
                        onChange={e => onUpdatePlayer(i, { playerName: e.target.value })}
                        className="h-7 text-xs font-mono w-32"
                      />
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

const NumCell = ({ value, onChange, max }: { value: number; onChange: (v: number) => void; max?: number }) => (
  <Input
    type="number"
    min="0"
    max={max}
    value={value || 0}
    onChange={e => onChange(parseInt(e.target.value) || 0)}
    className="h-7 w-14 text-center text-xs font-mono px-1"
  />
);
