import { useState } from "react";
import { ChevronDown, ChevronUp, BarChart3, Edit3, Check, X, Map, PlusCircle, Keyboard } from "lucide-react";
import { type PlayerMatchStats, type MatchStats, type MapStats, calculateRating, getRatingColor, getKDColor } from "@/lib/playerStats";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { teamDatabase } from "@/data/tournaments";
import { resolvePlayerCountry } from "@/lib/playerCountry";
import { countryFlag, normalizeCountry } from "@/lib/flags";

interface MatchStatsPanelProps {
  stats: MatchStats | null;
  team1: string;
  team2: string;
  bo?: number;
  onUpdateStats?: (stats: MatchStats) => void;
  onCreateStats?: () => void;
}

const getTeamRosterForStats = (teamName: string): string[] => {
  const team = teamDatabase.find(t => t.name === teamName);
  return team?.roster?.slice(0, 5) || [teamName + "_p1", teamName + "_p2", teamName + "_p3", teamName + "_p4", teamName + "_p5"];
};

const createBlankPlayerStats = (playerName: string, team: string, rounds: number): PlayerMatchStats => ({
  playerName, team, kills: 0, assists: 0, deaths: 0, adr: 0, kast: 0, ud: 0, ef: 0, rounds, rating: 0,
});

const StatInput = ({ value, onChange, className }: { value: number; onChange: (v: number) => void; className?: string }) => {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      type="number"
      min="0"
      placeholder="0"
      value={draft ?? (value ? String(value) : "")}
      onChange={e => {
        const raw = e.target.value;
        setDraft(raw);
        onChange(raw === "" ? 0 : parseInt(raw) || 0);
      }}
      onBlur={() => setDraft(null)}
      className={cn("w-12 h-6 text-center font-mono text-xs p-0 bg-background", className)}
    />
  );
};

const PlayerStatsRow = ({ player, editing, onUpdate }: {
  player: PlayerMatchStats;
  editing: boolean;
  onUpdate?: (updated: PlayerMatchStats) => void;
}) => {
  if (editing && onUpdate) {
    return (
      <div className="grid grid-cols-[minmax(80px,1fr)_repeat(8,minmax(40px,60px))] gap-1 px-2 py-1 items-center text-xs border-t border-border/30">
        <div className="font-medium text-foreground truncate flex items-center gap-1.5"><span className="text-sm leading-none">{countryFlag(normalizeCountry(resolvePlayerCountry(player.playerName)))}</span>{player.playerName}</div>
        <StatInput value={player.kills} onChange={v => onUpdate({ ...player, kills: v })} />
        <StatInput value={player.assists} onChange={v => onUpdate({ ...player, assists: v })} />
        <StatInput value={player.deaths} onChange={v => onUpdate({ ...player, deaths: v })} />
        <StatInput value={player.adr} onChange={v => onUpdate({ ...player, adr: v })} />
        <StatInput value={player.kast} onChange={v => onUpdate({ ...player, kast: Math.min(100, v) })} />
        <StatInput value={player.ud} onChange={v => onUpdate({ ...player, ud: v })} />
        <StatInput value={player.ef} onChange={v => onUpdate({ ...player, ef: v })} />
        <div className={cn("font-mono font-bold text-center", getRatingColor(calculateRating(player)))}>
          {calculateRating(player).toFixed(2)}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(80px,1fr)_repeat(8,minmax(40px,60px))] gap-1 px-2 py-1.5 items-center text-xs border-t border-border/30 hover:bg-secondary/30 transition-colors">
      <div className="font-medium text-foreground truncate flex items-center gap-1.5"><span className="text-sm leading-none">{countryFlag(normalizeCountry(resolvePlayerCountry(player.playerName)))}</span>{player.playerName}</div>
      <div className={cn("font-mono text-center", getKDColor(player.kills, player.deaths))}>{player.kills}</div>
      <div className="font-mono text-center text-muted-foreground">{player.assists}</div>
      <div className="font-mono text-center text-muted-foreground">{player.deaths}</div>
      <div className="font-mono text-center text-foreground">{player.adr}</div>
      <div className="font-mono text-center text-foreground">{player.kast}%</div>
      <div className="font-mono text-center text-muted-foreground">{player.ud}</div>
      <div className="font-mono text-center text-muted-foreground">{player.ef}</div>
      <div className={cn("font-mono font-bold text-center", getRatingColor(player.rating || 0))}>
        {(player.rating || 0).toFixed(2)}
      </div>
    </div>
  );
};

const TeamStatsTable = ({ players, teamName, editing, onUpdatePlayer, roundsInfo }: {
  players: PlayerMatchStats[];
  teamName: string;
  editing: boolean;
  onUpdatePlayer?: (index: number, player: PlayerMatchStats) => void;
  roundsInfo?: string;
}) => {
  const sorted = [...players].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  const avgRating = players.length > 0
    ? players.reduce((sum, p) => sum + (p.rating || calculateRating(p)), 0) / players.length
    : 0;

  return (
    <div className="bg-background rounded-md border border-border/50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/50">
        <div className="flex items-center gap-2">
          <span className="font-heading font-bold text-sm text-foreground">{teamName}</span>
          {roundsInfo && <span className="text-xs font-mono text-muted-foreground">{roundsInfo}</span>}
        </div>
        <span className={cn("font-mono text-xs font-bold", getRatingColor(avgRating))}>
          Avg: {avgRating.toFixed(2)}
        </span>
      </div>
      <div className="grid grid-cols-[minmax(80px,1fr)_repeat(8,minmax(40px,60px))] gap-1 px-2 py-1 text-xs font-mono text-muted-foreground uppercase">
        <div>Gracz</div>
        <div className="text-center">K</div>
        <div className="text-center">A</div>
        <div className="text-center">D</div>
        <div className="text-center">ADR</div>
        <div className="text-center">KAST</div>
        <div className="text-center">UD</div>
        <div className="text-center">EF</div>
        <div className="text-center">Rating</div>
      </div>
      {sorted.map((p) => (
        <PlayerStatsRow
          key={p.playerName}
          player={p}
          editing={editing}
          onUpdate={onUpdatePlayer ? (updated) => {
            const origIdx = players.findIndex(op => op.playerName === p.playerName);
            if (origIdx >= 0) onUpdatePlayer(origIdx, updated);
          } : undefined}
        />
      ))}
    </div>
  );
};

const MatchStatsPanel = ({ stats, team1, team2, bo, onUpdateStats, onCreateStats }: MatchStatsPanelProps) => {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [localStats, setLocalStats] = useState<MatchStats | null>(stats);
  const [selectedMap, setSelectedMap] = useState<number | "total">("total");

  // Sync if stats prop changes externally
  if (stats && !localStats) {
    setLocalStats(stats);
  }

  const hasMaps = localStats?.maps && localStats.maps.length > 1;

  const createBlankStats = () => {
    const rounds = 24;
    const roster1 = getTeamRosterForStats(team1);
    const roster2 = getTeamRosterForStats(team2);
    const blank: MatchStats = {
      matchId: `${team1}-vs-${team2}`,
      team1Stats: roster1.map(p => createBlankPlayerStats(p, team1, rounds)),
      team2Stats: roster2.map(p => createBlankPlayerStats(p, team2, rounds)),
      bo: bo || 1,
    };
    setLocalStats(blank);
    setEditing(true);
    setExpanded(true);
  };

  // No stats yet — offer to generate or create manually
  if (!localStats) {
    return (
      <div className="mt-1 border-t border-border/30">
        <div className="flex">
          <button
            onClick={() => { if (onCreateStats) onCreateStats(); }}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-mono text-accent hover:text-accent/80 transition-colors px-2 py-1.5 hover:bg-accent/5"
          >
            <PlusCircle className="w-3 h-3" />
            Generuj statystyki
          </button>
          <div className="w-px bg-border/30" />
          <button
            onClick={createBlankStats}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-mono text-primary hover:text-primary/80 transition-colors px-2 py-1.5 hover:bg-primary/5"
          >
            <Keyboard className="w-3 h-3" />
            Wpisz ręcznie
          </button>
        </div>
      </div>
    );
  }

  const handleUpdateTeam1Player = (index: number, player: PlayerMatchStats) => {
    const updated = { ...localStats, team1Stats: localStats.team1Stats.map((p, i) => i === index ? { ...player, rating: calculateRating(player) } : p) };
    setLocalStats(updated);
  };

  const handleUpdateTeam2Player = (index: number, player: PlayerMatchStats) => {
    const updated = { ...localStats, team2Stats: localStats.team2Stats.map((p, i) => i === index ? { ...player, rating: calculateRating(player) } : p) };
    setLocalStats(updated);
  };

  const handleSave = () => {
    if (onUpdateStats && localStats) {
      onUpdateStats(localStats);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setLocalStats(stats);
    setEditing(false);
  };

  const getDisplayStats = () => {
    if (selectedMap === "total" || !hasMaps) {
      return { t1: localStats.team1Stats, t2: localStats.team2Stats, roundsInfo1: undefined, roundsInfo2: undefined };
    }
    const map = localStats.maps![selectedMap as number];
    return {
      t1: map.team1Stats,
      t2: map.team2Stats,
      roundsInfo1: `${map.team1RoundsWon} rund`,
      roundsInfo2: `${map.team2RoundsWon} rund`,
    };
  };

  const display = getDisplayStats();

  return (
    <div className="mt-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-primary transition-colors px-2 py-1 w-full justify-center"
      >
        <BarChart3 className="w-3 h-3" />
        Statystyki {hasMaps ? `(${localStats.maps!.length} mapy)` : ""}
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="p-2 space-y-2 bg-secondary/20 rounded-b-md border-t border-border/30">
          {/* Map tabs for Bo3/Bo5 */}
          {hasMaps && (
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setSelectedMap("total")}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-mono transition-colors border",
                  selectedMap === "total"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/50 text-muted-foreground border-border/50 hover:text-foreground"
                )}
              >
                Σ Suma
              </button>
              {localStats.maps!.map((map, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedMap(i)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-mono transition-colors border flex items-center gap-1",
                    selectedMap === i
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/50 text-muted-foreground border-border/50 hover:text-foreground"
                  )}
                >
                  <Map className="w-2.5 h-2.5" />
                  {map.mapName}
                  <span className="opacity-70">({map.team1RoundsWon}:{map.team2RoundsWon})</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-1">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-xs font-mono text-accent hover:text-accent/80 transition-colors px-2 py-0.5 border border-accent/30 rounded"
              >
                <Edit3 className="w-2.5 h-2.5" /> Edytuj
              </button>
            ) : (
              <>
                <button onClick={handleSave} className="flex items-center gap-1 text-xs font-mono text-win hover:text-win/80 px-2 py-0.5 border border-win/30 rounded">
                  <Check className="w-2.5 h-2.5" /> Zapisz
                </button>
                <button onClick={handleCancel} className="flex items-center gap-1 text-xs font-mono text-destructive hover:text-destructive/80 px-2 py-0.5 border border-destructive/30 rounded">
                  <X className="w-2.5 h-2.5" /> Anuluj
                </button>
              </>
            )}
          </div>
          <TeamStatsTable
            players={display.t1}
            teamName={team1}
            editing={editing && selectedMap === "total"}
            onUpdatePlayer={selectedMap === "total" ? handleUpdateTeam1Player : undefined}
            roundsInfo={display.roundsInfo1}
          />
          <TeamStatsTable
            players={display.t2}
            teamName={team2}
            editing={editing && selectedMap === "total"}
            onUpdatePlayer={selectedMap === "total" ? handleUpdateTeam2Player : undefined}
            roundsInfo={display.roundsInfo2}
          />
        </div>
      )}
    </div>
  );
};

export default MatchStatsPanel;
