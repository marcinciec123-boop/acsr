// ===== Pre-Match Hub: raport map i przewidywane veto =====
import { useEffect, useMemo, useState } from "react";
import { Ban, Check, Map as MapIcon, Swords, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useActiveMaps } from "@/lib/mapPool";
import { getWorldNow } from "@/lib/worldClock";
import TeamLogo from "@/components/TeamLogo";
import { computeH2H, computeTeamMapStats, guessPermaban, predictVeto, type H2HSummary, type TeamMapStat } from "@/lib/mapAnalysis";

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

const WrCell = ({ s }: { s?: TeamMapStat }) => {
  if (!s) return <div className="text-center text-muted-foreground/50 font-mono text-sm">—</div>;
  const p = pct(s);
  const rd = s.roundDiff;
  return (
    <div className="flex items-baseline justify-center gap-1.5 leading-tight whitespace-nowrap">
      <span className={cn("text-sm font-mono font-bold tabular-nums",
        p === null ? "text-muted-foreground/50" : p >= 55 ? "text-win" : p <= 45 ? "text-destructive" : "text-foreground")}>
        {p === null ? "—" : `${p}%`}
      </span>
      {p === null && (s.picks > 0 || s.bans > 0) && (
        <span className="text-2xs font-mono tabular-nums">
          {s.picks > 0 && <span className="text-primary">{s.picks}P </span>}
          {s.bans > 0 && <span className="text-destructive/80">{s.bans}B</span>}
        </span>
      )}
      {p !== null && (
        <span className="text-2xs font-mono text-muted-foreground tabular-nums">
          {s.wins}-{s.losses}
          {rd !== 0 && <span className={rd > 0 ? "text-win/80" : "text-destructive/80"}> {rd > 0 ? "+" : ""}{rd}</span>}
          {s.picks > 0 && <span className="text-primary"> ·{s.picks}P</span>}
          {s.bans > 0 && <span className="text-destructive/80"> ·{s.bans}B</span>}
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

const H2HBlock = ({ team1, team2, h }: { team1: string; team2: string; h: H2HSummary }) => {
  const total = h.wins1 + h.wins2;
  const p1 = total ? (h.wins1 / total) * 100 : 50;
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider flex items-center gap-2">
        <Swords className="w-3.5 h-3.5" /> Bilans H2H
      </h3>
      {!total ? (
        <p className="text-xs font-mono text-muted-foreground">Te drużyny jeszcze ze sobą nie grały.</p>
      ) : (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            <div className="flex items-center gap-1.5 min-w-0"><TeamLogo teamName={team1} size={22} rounded="md" /><span className="text-xs font-heading font-bold truncate">{team1}</span></div>
            <div className="font-mono font-bold text-xl tabular-nums">
              <span className={h.wins1 >= h.wins2 ? "text-win" : "text-muted-foreground"}>{h.wins1}</span>
              <span className="text-muted-foreground/50 mx-1.5">:</span>
              <span className={h.wins2 >= h.wins1 ? "text-win" : "text-muted-foreground"}>{h.wins2}</span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0 justify-end"><span className="text-xs font-heading font-bold truncate">{team2}</span><TeamLogo teamName={team2} size={22} rounded="md" /></div>
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden flex">
            <div className="bg-primary h-full" style={{ width: `${p1}%` }} />
            <div className="bg-muted-foreground/40 h-full flex-1" />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Mecze", total],
              ["Mapy", `${h.maps1}-${h.maps2}`],
              ["Rundy", `${h.rounds1}-${h.rounds2}`],
            ].map(([l, v]) => (
              <div key={l as string} className="bg-secondary/40 rounded px-1 py-1.5">
                <div className="text-2xs font-mono uppercase text-muted-foreground">{l}</div>
                <div className="text-sm font-mono font-bold tabular-nums">{v}</div>
              </div>
            ))}
          </div>
          {h.streak && (
            <p className="text-xs font-mono text-muted-foreground">
              Seria: <span className="text-foreground font-bold">{h.streak.side === 1 ? team1 : team2}</span> wygrywa {h.streak.count} {h.streak.count === 1 ? "mecz" : "z rzędu"}
              {" · "}ostatnio: {h.meetings[0].tournament}
            </p>
          )}
          {h.mapRecord.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {h.mapRecord.map(m => (
                <span key={m.map} className="text-2xs font-mono px-1.5 py-0.5 rounded border border-border">
                  {m.map} <span className={m.w1 > m.w2 ? "text-win" : m.w1 < m.w2 ? "text-destructive" : ""}>{m.w1}-{m.w2}</span>
                </span>
              ))}
            </div>
          )}
          <div className="space-y-1">
            <p className="text-2xs font-mono uppercase text-muted-foreground tracking-wider">Ostatnie spotkania</p>
            {h.meetings.slice(0, 5).map(mt => (
              <div key={mt.id} className="flex items-center gap-2 text-xs font-mono border-t border-border/40 pt-1">
                <span className={cn("w-4 text-center font-bold", mt.winner === 1 ? "text-win" : "text-destructive")}>{mt.winner === 1 ? "W" : "L"}</span>
                <span className="font-bold tabular-nums">{mt.s1}-{mt.s2}</span>
                <span className="truncate text-muted-foreground flex-1 min-w-0">{mt.tournament}</span>
                {mt.ts > 0 && <span className="text-muted-foreground/70 shrink-0">{new Date(mt.ts).toLocaleDateString("pl-PL")}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const PreMatchReport = ({ team1, team2, bo, matchId }: Props) => {
  const maps = useActiveMaps();
  const [period, setPeriod] = useState(6);
  const [dataTick, setDataTick] = useState(0);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => { t = null; setDataTick(x => x + 1); }, 120);
    };
    const events = ["tournaments:update", "season:reset", "storage"];
    events.forEach(e => window.addEventListener(e, bump));
    return () => { events.forEach(e => window.removeEventListener(e, bump)); if (t) clearTimeout(t); };
  }, []);

  const { s1, s2, perma1, perma2, veto } = useMemo(() => {
    // Rozegrane mecze to fakt — nie odcinamy ich górną granicą daty
    // (data świata gry potrafi stać przed terminami meczów sezonu).
    const now = getWorldNow();
    let since = 0;
    if (period) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - period);
      since = d.getTime();
    }
    const a = computeTeamMapStats(team1, maps, since, 0, matchId);
    const b = computeTeamMapStats(team2, maps, since, 0, matchId);
    return {
      s1: a, s2: b,
      perma1: guessPermaban(a), perma2: guessPermaban(b),
      veto: predictVeto(team1, team2, bo, maps, a, b),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team1, team2, bo, maps, period, matchId, dataTick]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const h2h = useMemo(() => computeH2H(team1, team2, matchId), [team1, team2, matchId, dataTick]);
  const hasData = s1.some(s => s.played) || s2.some(s => s.played);

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <H2HBlock team1={team1} team2={team2} h={h2h} />
      <div className="border-t border-border/50" />
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
        const halves = [maps];
        return (
          <div>
            <div className="grid grid-cols-1">
              {halves.map((group, gi) => (
                <div key={gi} className={cn(false)}>
                  <MapTableHalf
                    team1={team1} team2={team2}
                    maps={group} all={maps}
                    s1={s1} s2={s2}
                    perma1={perma1} perma2={perma2}
                  />
                </div>
              ))}
            </div>
            <p className="text-2xs font-mono text-muted-foreground mt-1">Winrate • bilans W-L • różnica rund • P = picki · B = bany (z map veto)</p>
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
