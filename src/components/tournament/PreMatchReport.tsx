// ===== Pre-Match Hub: raport map i przewidywane veto =====
import { useMemo, useState } from "react";
import { Ban, Check, Map as MapIcon, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveMaps } from "@/lib/mapPool";
import { getWorldNow } from "@/lib/worldClock";
import TeamLogo from "@/components/TeamLogo";
import { computeTeamMapStats, guessPermaban, predictVeto, type TeamMapStat } from "@/lib/mapAnalysis";

interface Props {
  team1: string;
  team2: string;
  bo: number;
  matchId?: string;
}

const PERIODS = [
  { id: 3, label: "3 mies." },
  { id: 6, label: "6 mies." },
  { id: 12, label: "Rok" },
  { id: 0, label: "Całość" },
];

const pct = (s: TeamMapStat) => (s.played ? Math.round((s.wins / s.played) * 100) : null);

const WrCell = ({ s }: { s: TeamMapStat }) => {
  const p = pct(s);
  const rd = s.roundDiff;
  return (
    <div className="flex items-baseline justify-center gap-1.5 leading-tight whitespace-nowrap">
      <span className={cn("text-sm font-mono font-bold tabular-nums",
        p === null ? "text-muted-foreground/50" : p >= 55 ? "text-win" : p <= 45 ? "text-destructive" : "text-foreground")}>
        {p === null ? "—" : `${p}%`}
      </span>
      {p !== null && (
        <span className="text-2xs font-mono text-muted-foreground tabular-nums">
          {s.wins}-{s.losses}
          {rd !== 0 && <span className={rd > 0 ? "text-win/80" : "text-destructive/80"}> {rd > 0 ? "+" : ""}{rd}</span>}
          {s.picks > 0 && <span className="text-primary"> ·{s.picks}P</span>}
        </span>
      )}
    </div>
  );
};

const MapTableHalf = ({ team1, team2, maps, all, s1, s2, perma1, perma2 }: {
  team1: string; team2: string;
  maps: string[];
  all: string[];
  s1: TeamMapStat[]; s2: TeamMapStat[];
  perma1: string | null; perma2: string | null;
}) => (
  <table className="w-full text-sm">
    <thead>
      <tr className="text-xs font-mono text-muted-foreground">
        <th className="py-1 text-center w-2/5 min-w-0">
          <span className="inline-flex items-center gap-1 max-w-full"><TeamLogo teamName={team1} size={14} rounded="md" /><span className="truncate">{team1}</span></span>
        </th>
        <th className="py-1 text-center text-2xs uppercase tracking-wider">Mapa</th>
        <th className="py-1 text-center w-2/5 min-w-0">
          <span className="inline-flex items-center gap-1 max-w-full"><span className="truncate">{team2}</span><TeamLogo teamName={team2} size={14} rounded="md" /></span>
        </th>
      </tr>
    </thead>
    <tbody>
      {maps.map(map => {
        const i = all.indexOf(map);
        return (
          <tr key={map} className="border-t border-border/40">
            <td className="py-1"><WrCell s={s1[i]} /></td>
            <td className="py-1 text-center font-mono text-xs text-foreground leading-tight">
              {map}
              {(perma1 === map || perma2 === map) && (
                <div className="text-2xs text-destructive leading-tight">
                  permaban {perma1 === map && perma2 === map ? "obu" : perma1 === map ? team1 : team2}
                </div>
              )}
            </td>
            <td className="py-1"><WrCell s={s2[i]} /></td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

export const PreMatchReport = ({ team1, team2, bo, matchId }: Props) => {
  const maps = useActiveMaps();
  const [period, setPeriod] = useState(6);

  const { s1, s2, perma1, perma2, veto } = useMemo(() => {
    const now = getWorldNow();
    const until = now.getTime();
    let since = 0;
    if (period) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - period);
      since = d.getTime();
    }
    const a = computeTeamMapStats(team1, maps, since, until, matchId);
    const b = computeTeamMapStats(team2, maps, since, until, matchId);
    return {
      s1: a, s2: b,
      perma1: guessPermaban(a), perma2: guessPermaban(b),
      veto: predictVeto(team1, team2, bo, maps, a, b),
    };
  }, [team1, team2, bo, maps, period, matchId]);

  const hasData = s1.some(s => s.played) || s2.some(s => s.played);

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider flex items-center gap-2">
          <MapIcon className="w-3.5 h-3.5" /> Raport przedmeczowy — mapy
        </h3>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button key={p.id} type="button" onClick={() => setPeriod(p.id)}
              className={cn("px-2 py-1 text-xs font-mono rounded border transition-colors",
                period === p.id ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:bg-secondary")}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!hasData && (
        <p className="text-xs font-mono text-muted-foreground">Brak rozegranych map w tym okresie — prognoza veto opiera się na równych szansach.</p>
      )}

      {/* Tabela map — dwa bloki obok siebie, żeby nie scrollować w pionie */}
      {(() => {
        const split = Math.ceil(maps.length / 2);
        const halves = [maps.slice(0, split), maps.slice(split)];
        return (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              {halves.map((group, gi) => (
                <div key={gi} className={cn(gi === 1 && "sm:border-l sm:border-border/40 sm:pl-6")}>
                  <MapTableHalf
                    team1={team1} team2={team2}
                    maps={group} all={maps}
                    s1={s1} s2={s2}
                    perma1={perma1} perma2={perma2}
                  />
                </div>
              ))}
            </div>
            <p className="text-2xs font-mono text-muted-foreground mt-1">Winrate • bilans W-L • różnica rund • P = własne picki</p>
          </div>
        );
      })()}

      {/* Przewidywane veto */}
      <div className="pt-3 border-t border-border/50">
        <p className="text-xs font-heading font-bold uppercase text-primary tracking-wider mb-2 flex items-center gap-2">
          <Target className="w-3.5 h-3.5" /> Przewidywane veto — Bo{bo}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {veto.map((v, i) => (
            <span key={i} className={cn("text-xs font-mono px-2 py-1 rounded border inline-flex items-center gap-1",
              v.action === "ban" && "text-destructive/90 bg-destructive/5 border-destructive/20",
              v.action === "pick" && "text-win bg-win/10 border-win/30 font-bold",
              v.action === "decider" && "text-primary bg-primary/10 border-primary/30 font-bold")}>
              <span className="text-muted-foreground/60">{i + 1}.</span>
              {v.action === "ban" ? <Ban className="w-3 h-3" /> : <Check className="w-3 h-3" />}
              {v.action === "decider" ? "Decider" : v.team}: {v.map}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PreMatchReport;
