import { useMemo, useState } from "react";
import { BarChart3, Trophy, Target, Skull, Zap, Filter, X, Map as MapIcon, Clock, Crosshair, Layers } from "lucide-react";
import type { TournamentData, MapPlayerStats } from "@/lib/types";
import { calculateRating, getRatingColor } from "@/lib/playerStats";
import { cn } from "@/lib/utils";
import TeamLogo from "@/components/TeamLogo";

interface Props {
  tournament: TournamentData;
}

interface MapAgg {
  map: string;
  played: number;
  rounds: number;
  overtimes: number;
  kills: number;
  ctRounds: number;
  tRounds: number;
  sidedRounds: number;
  closest: number;      // min round diff
  biggest: number;      // max round diff
}


interface PlayerAgg {
  name: string;
  team: string;
  kills: number;
  deaths: number;
  assists: number;
  rounds: number;
  adrSum: number;          // weighted by rounds
  kastSum: number;         // weighted by rounds
  ud: number;
  ef: number;
  maps: number;
  ratings: number[];       // per-map rating samples (averaged for tournament rating)
}

interface TeamAgg {
  team: string;
  matchesPlayed: number;
  matchesWon: number;
  mapsWon: number;
  mapsLost: number;
  roundsWon: number;
  roundsLost: number;
  ratings: number[];       // per-map team avg rating
}

const isPlaceholder = (s?: string) => !s || s === "BYE" || s === "TBD" || s.startsWith("TBD");

export const TournamentStatsPanel = ({ tournament }: Props) => {
  const { players, teams, maps, summary } = useMemo(() => {
    const pmap = new Map<string, PlayerAgg>();
    const mmap = new Map<string, MapAgg>();
    let totalMatches = 0;
    let totalKills = 0;

    const tmap = new Map<string, TeamAgg>();

    const ensurePlayer = (name: string, team: string): PlayerAgg => {
      const key = `${team}::${name}`;
      let p = pmap.get(key);
      if (!p) {
        p = { name, team, kills: 0, deaths: 0, assists: 0, rounds: 0, adrSum: 0, kastSum: 0, ud: 0, ef: 0, maps: 0, ratings: [] };
        pmap.set(key, p);
      }
      return p;
    };
    const ensureTeam = (team: string): TeamAgg => {
      let t = tmap.get(team);
      if (!t) {
        t = { team, matchesPlayed: 0, matchesWon: 0, mapsWon: 0, mapsLost: 0, roundsWon: 0, roundsLost: 0, ratings: [] };
        tmap.set(team, t);
      }
      return t;
    };

    const allMatches = tournament.phases.flatMap(ph => [
      ...(ph.bracket || []),
      ...(ph.groups?.flatMap(g => g.matches) || []),
    ]);

    for (const m of allMatches) {
      if (isPlaceholder(m.team1) || isPlaceholder(m.team2)) continue;
      if ((m.score1 || 0) + (m.score2 || 0) === 0) continue;

      totalMatches++;
      const t1 = ensureTeam(m.team1);
      const t2 = ensureTeam(m.team2);
      t1.matchesPlayed++; t2.matchesPlayed++;
      if (m.score1 > m.score2) t1.matchesWon++; else if (m.score2 > m.score1) t2.matchesWon++;
      t1.mapsWon += m.score1; t1.mapsLost += m.score2;
      t2.mapsWon += m.score2; t2.mapsLost += m.score1;

      for (const map of m.maps || []) {
        t1.roundsWon += map.score1; t1.roundsLost += map.score2;
        t2.roundsWon += map.score2; t2.roundsLost += map.score1;
        const totalRounds = (map.score1 || 0) + (map.score2 || 0);
        if (totalRounds > 0 && map.map) {
          const key = map.map;
          let ma = mmap.get(key);
          if (!ma) {
            ma = { map: key, played: 0, rounds: 0, overtimes: 0, kills: 0, ctRounds: 0, tRounds: 0, sidedRounds: 0, closest: 99, biggest: 0 };
            mmap.set(key, ma);
          }
          ma.played++;
          ma.rounds += totalRounds;
          if (totalRounds > 24) ma.overtimes++;
          const diff = Math.abs((map.score1 || 0) - (map.score2 || 0));
          ma.closest = Math.min(ma.closest, diff);
          ma.biggest = Math.max(ma.biggest, diff);
          const mapKills = [...(map.team1Players || []), ...(map.team2Players || [])]
            .reduce((s, p) => s + (p.kills || 0), 0);
          ma.kills += mapKills;
          totalKills += mapKills;
          // Side split (only when half data exists and no overtime distortion)
          if (map.team1StartSide && map.half1Score1 != null && map.half1Score2 != null && totalRounds <= 24) {
            const h1a = map.half1Score1, h1b = map.half1Score2;
            const h2a = (map.score1 || 0) - h1a, h2b = (map.score2 || 0) - h1b;
            if (map.team1StartSide === "T") {
              ma.tRounds += h1a + h2b;
              ma.ctRounds += h1b + h2a;
            } else {
              ma.ctRounds += h1a + h2b;
              ma.tRounds += h1b + h2a;
            }
            ma.sidedRounds += totalRounds;
          }
        }
        if (totalRounds <= 0) continue;

        const sides: { players?: MapPlayerStats[]; team: string }[] = [
          { players: map.team1Players, team: m.team1 },
          { players: map.team2Players, team: m.team2 },
        ];

        for (const side of sides) {
          if (!side.players || side.players.length === 0) continue;
          const sideRatings: number[] = [];
          for (const pl of side.players) {
            const agg = ensurePlayer(pl.playerName, side.team);
            agg.kills += pl.kills;
            agg.deaths += pl.deaths;
            agg.assists += pl.assists;
            agg.rounds += totalRounds;
            agg.adrSum += (pl.adr || 0) * totalRounds;
            agg.kastSum += (pl.kast || 0) * totalRounds;
            agg.ud += pl.ud || 0;
            agg.ef += pl.ef || 0;
            agg.maps += 1;
            const r = (pl.rating && pl.rating > 0)
              ? pl.rating
              : calculateRating({ ...pl, rounds: totalRounds });
            if (r > 0) {
              agg.ratings.push(r);
              sideRatings.push(r);
            }
          }
          if (sideRatings.length > 0) {
            const teamAgg = ensureTeam(side.team);
            teamAgg.ratings.push(sideRatings.reduce((a, b) => a + b, 0) / sideRatings.length);
          }
        }
      }
    }

    const players = Array.from(pmap.values())
      .filter(p => p.rounds >= 12)
      .map(p => {
        const adr = p.rounds > 0 ? p.adrSum / p.rounds : 0;
        const kast = p.rounds > 0 ? p.kastSum / p.rounds : 0;
        const rating = p.ratings.length > 0
          ? p.ratings.reduce((a, b) => a + b, 0) / p.ratings.length
          : calculateRating({
              playerName: p.name, team: p.team,
              kills: p.kills, deaths: p.deaths, assists: p.assists,
              adr, kast, ud: p.ud, ef: p.ef, rounds: p.rounds,
            });
        const kd = p.deaths > 0 ? p.kills / p.deaths : p.kills;
        return { ...p, adr, kast, rating, kd };
      })
      .sort((a, b) => b.rating - a.rating);

    const teams = Array.from(tmap.values())
      .filter(t => t.matchesPlayed > 0)
      .map(t => ({
        ...t,
        avgRating: t.ratings.length > 0 ? t.ratings.reduce((a, b) => a + b, 0) / t.ratings.length : 0,
        winRate: t.matchesPlayed > 0 ? t.matchesWon / t.matchesPlayed : 0,
      }))
      .sort((a, b) => b.avgRating - a.avgRating || b.winRate - a.winRate);

    const mapsArr = Array.from(mmap.values()).sort((a, b) => b.played - a.played);
    const totalMapsPlayed = mapsArr.reduce((s, m) => s + m.played, 0);
    const totalRoundsPlayed = mapsArr.reduce((s, m) => s + m.rounds, 0);
    const summary = {
      matches: totalMatches,
      mapsPlayed: totalMapsPlayed,
      rounds: totalRoundsPlayed,
      kills: totalKills,
      overtimes: mapsArr.reduce((s, m) => s + m.overtimes, 0),
      avgRoundsPerMap: totalMapsPlayed > 0 ? totalRoundsPlayed / totalMapsPlayed : 0,
      killsPerRound: totalRoundsPlayed > 0 ? totalKills / totalRoundsPlayed : 0,
      distinctMaps: mapsArr.length,
    };

    return { players, teams, maps: mapsArr, summary };

  }, [tournament]);

  // Placement-derived team sets for filter presets
  const placedTeams = useMemo(() => {
    const sorted = [...(tournament.placements || [])].sort((a, b) => a.placement - b.placement);
    return {
      top2: new Set(sorted.slice(0, 2).map(p => p.team)),
      top4: new Set(sorted.slice(0, 4).map(p => p.team)),
      top8: new Set(sorted.slice(0, 8).map(p => p.team)),
    };
  }, [tournament.placements]);

  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [presetKey, setPresetKey] = useState<"all" | "top2" | "top4" | "top8" | "custom">("all");

  const activeFilter = useMemo(() => {
    if (presetKey === "top2") return placedTeams.top2;
    if (presetKey === "top4") return placedTeams.top4;
    if (presetKey === "top8") return placedTeams.top8;
    if (presetKey === "custom" && selectedTeams.size > 0) return selectedTeams;
    return null;
  }, [presetKey, selectedTeams, placedTeams]);

  const filteredPlayers = useMemo(
    () => activeFilter ? players.filter(p => activeFilter.has(p.team)) : players,
    [players, activeFilter],
  );

  if (players.length === 0 && teams.length === 0) {
    return null;
  }

  const topPlayers = filteredPlayers.slice(0, 10);
  const topByMetric = (metric: "kd" | "adr" | "kast", n = 5) =>
    [...filteredPlayers].sort((a, b) => (b as any)[metric] - (a as any)[metric]).slice(0, n);

  const toggleTeam = (team: string) => {
    setPresetKey("custom");
    setSelectedTeams(prev => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team); else next.add(team);
      return next;
    });
  };

  const presets: { key: typeof presetKey; label: string; disabled?: boolean }[] = [
    { key: "all", label: "Wszystkie" },
    { key: "top2", label: `Finał (${placedTeams.top2.size})`, disabled: placedTeams.top2.size === 0 },
    { key: "top4", label: `Top 4 (${placedTeams.top4.size})`, disabled: placedTeams.top4.size === 0 },
    { key: "top8", label: `Top 8 (${placedTeams.top8.size})`, disabled: placedTeams.top8.size === 0 },
  ];

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-6">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <BarChart3 className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider">
          Statystyki turnieju
        </h3>
        <span className="text-xs font-mono text-muted-foreground">
          • {filteredPlayers.length}/{players.length} graczy • {teams.length} drużyn
        </span>
      </div>

      {/* Team / phase filter */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground mr-1">Filtr MVP:</span>
          {presets.map(p => (
            <button
              key={p.key}
              type="button"
              disabled={p.disabled}
              onClick={() => { setPresetKey(p.key); if (p.key !== "custom") setSelectedTeams(new Set()); }}
              className={cn(
                "px-2 py-1 rounded text-xs font-mono border transition-colors",
                presetKey === p.key
                  ? "bg-primary/20 border-primary text-primary"
                  : "bg-secondary/40 border-border text-muted-foreground hover:border-primary/40",
                p.disabled && "opacity-40 cursor-not-allowed",
              )}
            >
              {p.label}
            </button>
          ))}
          {presetKey === "custom" && selectedTeams.size > 0 && (
            <button
              type="button"
              onClick={() => { setSelectedTeams(new Set()); setPresetKey("all"); }}
              className="px-2 py-1 rounded text-xs font-mono border border-destructive/40 text-destructive hover:bg-destructive/10 inline-flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Wyczyść ({selectedTeams.size})
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {teams.map(t => {
            const active = presetKey === "custom" ? selectedTeams.has(t.team) : (activeFilter?.has(t.team) ?? false);
            return (
              <button
                key={t.team}
                type="button"
                onClick={() => toggleTeam(t.team)}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-mono border transition-colors inline-flex items-center gap-1",
                  active
                    ? "bg-primary/15 border-primary/60 text-primary"
                    : "bg-secondary/30 border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                <TeamLogo teamName={t.team} size={12} rounded="md" />
                {t.team}
              </button>
            );
          })}
        </div>
      </div>


      <div className="grid lg:grid-cols-2 gap-4">
        {/* Top players by rating */}
        <div className="bg-secondary/20 border border-border rounded-md overflow-hidden">
          <div className="px-3 py-2 bg-secondary/40 border-b border-border flex items-center gap-1.5">
            <Trophy className="w-3 h-3 text-[hsl(var(--gold))]" />
            <span className="text-xs font-mono uppercase tracking-wider text-foreground">Najlepsze ratingi</span>
          </div>
          <div className="divide-y divide-border/50">
            <div className="grid grid-cols-12 gap-1 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
              <span className="col-span-1">#</span>
              <span className="col-span-4">Gracz</span>
              <span className="col-span-3">Drużyna</span>
              <span className="col-span-1 text-right">K-D</span>
              <span className="col-span-1 text-right">ADR</span>
              <span className="col-span-2 text-right">Rating</span>
            </div>
            {topPlayers.map((p, i) => (
              <div key={`${p.team}-${p.name}`} className="grid grid-cols-12 gap-1 px-3 py-1.5 text-xs font-mono items-center hover:bg-secondary/30">
                <span className={cn("col-span-1", i < 3 ? "text-[hsl(var(--gold))] font-bold" : "text-muted-foreground")}>{i + 1}</span>
                <span className="col-span-4 truncate text-foreground">{p.name}</span>
                <span className="col-span-3 min-w-0 inline-flex items-center gap-1.5 text-muted-foreground">
                  <TeamLogo teamName={p.team} size={16} rounded="md" />
                  <span className="truncate">{p.team}</span>
                </span>
                <span className="col-span-1 text-right text-muted-foreground">{p.kills}-{p.deaths}</span>
                <span className="col-span-1 text-right text-muted-foreground">{p.adr.toFixed(0)}</span>
                <span className={cn("col-span-2 text-right font-bold", getRatingColor(p.rating))}>{p.rating.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top teams */}
        <div className="bg-secondary/20 border border-border rounded-md overflow-hidden">
          <div className="px-3 py-2 bg-secondary/40 border-b border-border flex items-center gap-1.5">
            <Target className="w-3 h-3 text-primary" />
            <span className="text-xs font-mono uppercase tracking-wider text-foreground">Drużyny — performance</span>
          </div>
          <div className="divide-y divide-border/50">
            <div className="grid grid-cols-12 gap-1 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
              <span className="col-span-1">#</span>
              <span className="col-span-5">Drużyna</span>
              <span className="col-span-2 text-right">W-L</span>
              <span className="col-span-2 text-right">Mapy</span>
              <span className="col-span-2 text-right">Ø Rating</span>
            </div>
            {teams.slice(0, 10).map((t, i) => (
              <div key={t.team} className="grid grid-cols-12 gap-1 px-3 py-1.5 text-xs font-mono items-center hover:bg-secondary/30">
                <span className={cn("col-span-1", i < 3 ? "text-[hsl(var(--gold))] font-bold" : "text-muted-foreground")}>{i + 1}</span>
                <span className="col-span-5 min-w-0 inline-flex items-center gap-1.5 text-foreground">
                  <TeamLogo teamName={t.team} size={18} rounded="md" />
                  <span className="truncate">{t.team}</span>
                </span>
                <span className="col-span-2 text-right text-muted-foreground">{t.matchesWon}-{t.matchesPlayed - t.matchesWon}</span>
                <span className="col-span-2 text-right text-muted-foreground">{t.mapsWon}-{t.mapsLost}</span>
                <span className={cn("col-span-2 text-right font-bold", getRatingColor(t.avgRating))}>
                  {t.avgRating > 0 ? t.avgRating.toFixed(2) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Leaderboards mini */}
      <div className="grid sm:grid-cols-3 gap-3 mt-4">
        <MiniBoard title="Top K/D" icon={<Skull className="w-3 h-3 text-loss" />} entries={topByMetric("kd").map(p => ({ name: p.name, team: p.team, value: p.kd.toFixed(2) }))} />
        <MiniBoard title="Top ADR" icon={<Zap className="w-3 h-3 text-accent" />} entries={topByMetric("adr").map(p => ({ name: p.name, team: p.team, value: p.adr.toFixed(0) }))} />
        <MiniBoard title="Top KAST%" icon={<Target className="w-3 h-3 text-primary" />} entries={topByMetric("kast").map(p => ({ name: p.name, team: p.team, value: `${p.kast.toFixed(0)}%` }))} />
      </div>
    </div>
  );
};

const MiniBoard = ({ title, icon, entries }: { title: string; icon: React.ReactNode; entries: { name: string; team: string; value: string }[] }) => (
  <div className="bg-secondary/20 border border-border rounded-md overflow-hidden">
    <div className="px-3 py-1.5 bg-secondary/40 border-b border-border flex items-center gap-1.5">
      {icon}
      <span className="text-xs font-mono uppercase tracking-wider text-foreground">{title}</span>
    </div>
    <div className="divide-y divide-border/50">
      {entries.map((e, i) => (
        <div key={`${e.team}-${e.name}`} className="px-3 py-1.5 flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-1.5">
            <span className="text-xs font-mono text-muted-foreground w-3">{i + 1}</span>
            <span className="text-xs font-mono text-foreground truncate">{e.name}</span>
            <TeamLogo teamName={e.team} size={14} rounded="md" className="hidden sm:flex" />
            <span className="text-xs font-mono text-muted-foreground truncate hidden sm:inline">· {e.team}</span>
          </div>
          <span className="text-xs font-mono font-bold text-primary tabular-nums">{e.value}</span>
        </div>
      ))}
      {entries.length === 0 && (
        <div className="px-3 py-2 text-xs font-mono text-muted-foreground italic">Brak danych</div>
      )}
    </div>
  </div>
);
