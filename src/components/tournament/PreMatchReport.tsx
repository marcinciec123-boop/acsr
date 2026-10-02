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
  return (
    <div className="text-center leading-tight">
      <div className={cn("text-sm font-mono font-bold tabular-nums",
        p === null ? "text-muted-foreground/50" : p >= 55 ? "text-win" : p <= 45 ? "text-destructive" : "text-foreground")}>
        {p === null ? "—" : `${p}%`}
      </div>
      <div className="text-2xs font-mono text-muted-foreground tabular-nums">
        {s.played ? `${s.wins}-${s.losses} • ${s.roundDiff > 0 ? "+" : ""}${s.roundDiff}` : "brak"}
        {s.picks > 0 && <span className="text-primary"> • {s.picks}P</span>}
      </div>
    </div>
  );
};

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

      {/* Tabela map */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs font-mono text-muted-foreground">
              <th className="py-1.5 text-center w-1/3">
                <span className="inline-flex items-center gap-1.5"><TeamLogo teamName={team1} size={16} rounded="md" />{team1}</span>
              </th>
              <th className="py-1.5 text-center">Mapa</th>
              <th className="py-1.5 text-center w-1/3">
                <span className="inline-flex items-center gap-1.5"><TeamLogo teamName={team2} size={16} rounded="md" />{team2}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {maps.map((map, i) => (
              <tr key={map} className="border-t border-border/40">
                <td className="py-1.5"><WrCell s={s1[i]} /></td>
                <td className="py-1.5 text-center font-mono text-xs text-foreground">
                  {map}
                  {(perma1 === map || perma2 === map) && (
                    <div className="text-2xs text-destructive">
                      permaban {perma1 === map && perma2 === map ? "obu" : perma1 === map ? team1 : team2}
                    </div>
                  )}
                </td>
                <td className="py-1.5"><WrCell s={s2[i]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-2xs font-mono text-muted-foreground mt-1">Winrate • bilans W-L • różnica rund • P = własne picki</p>
      </div>

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
