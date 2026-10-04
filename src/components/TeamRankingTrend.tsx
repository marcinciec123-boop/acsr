import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";
import { buildTrendSeries, getTeamRankingSeries, getTeamRosterAt } from "@/lib/rankingHistory";
import { getWorldDate, WORLD_CLOCK_EVENT } from "@/lib/worldClock";
import { playerRoles, roleColors, roleIcons } from "@/data/playerRoles";
import { cn } from "@/lib/utils";

type Range = "1M" | "3M" | "6M" | "1Y" | "5Y" | "ALL";

const cutoffFor = (range: Range): string => {
  if (range === "ALL") return "0000-01-01";
  const [y, m, d] = getWorldDate().split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  if (range === "1Y") dt.setFullYear(dt.getFullYear() - 1);
  else if (range === "5Y") dt.setFullYear(dt.getFullYear() - 5);
  else dt.setMonth(dt.getMonth() - (range === "1M" ? 1 : range === "3M" ? 3 : 6));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

type Metric = "points" | "rank";

const CustomTooltip = ({ active, payload, teamName }: { active?: boolean; payload?: { value: number; dataKey?: string; color?: string; payload?: { date?: string } }[]; teamName: string }) => {
  const label = payload?.[0]?.payload?.date;
  if (!active || !payload?.length || !label) return null;
  const roster = getTeamRosterAt(teamName, label);
  const points = payload.find(p => p.dataKey === "points")?.value;
  const rank = payload.find(p => p.dataKey === "rank")?.value;
  return (
    <div className="bg-card border border-primary/40 rounded-md p-3 shadow-xl min-w-[220px]">
      <div className="text-xs font-mono text-muted-foreground uppercase mb-1">{label}</div>
      <div className="flex items-baseline gap-4 mb-2">
        {points !== undefined && (
          <div className="text-lg font-heading font-black text-primary tabular-nums">
            {points.toLocaleString()} <span className="text-xs text-muted-foreground font-mono">pkt</span>
          </div>
        )}
        {rank !== undefined && (
          <div className="text-lg font-heading font-black text-accent tabular-nums">
            #{rank} <span className="text-xs text-muted-foreground font-mono">miejsce</span>
          </div>
        )}
      </div>
      <div className="text-xs font-mono uppercase text-muted-foreground mb-1">Skład</div>
      <div className="space-y-1">
        {roster.length === 0 && <div className="text-xs text-muted-foreground italic">brak danych</div>}
        {roster.map(p => {
          const role = playerRoles[p];
          const icon = role ? roleIcons[role] : null;
          return (
            <div key={p} className="flex items-center gap-2 text-xs">
              {icon && <span className={cn("text-xs", role && roleColors[role])}>{icon}</span>}
              <span className="text-foreground font-medium">{p}</span>
              {role && <span className="text-[10px] font-mono text-muted-foreground uppercase ml-auto">{role}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TeamRankingTrend = ({ teamName }: { teamName: string }) => {
  const [range, setRange] = useState<Range>("1M");
  const [metrics, setMetrics] = useState<Metric[]>(["points", "rank"]);
  const [historyVersion, setHistoryVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setHistoryVersion(value => value + 1);
    window.addEventListener("ranking-history:update", refresh);
    window.addEventListener("ranking:update", refresh);
    window.addEventListener(WORLD_CLOCK_EVENT, refresh);
    return () => {
      window.removeEventListener("ranking-history:update", refresh);
      window.removeEventListener("ranking:update", refresh);
      window.removeEventListener(WORLD_CLOCK_EVENT, refresh);
    };
  }, []);

  const data = useMemo(
    () => buildTrendSeries(getTeamRankingSeries(teamName), cutoffFor(range)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamName, range, historyVersion],
  );

  const toggleMetric = (metric: Metric) => {
    setMetrics(current => current.includes(metric)
      ? (current.length === 1 ? current : current.filter(value => value !== metric))
      : [...current, metric]);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-heading font-black uppercase tracking-wider">Rozwój w rankingu</h4>
        </div>
        <div className="flex items-center gap-1 self-end sm:self-auto">
          {(["1M", "3M", "6M", "1Y", "5Y", "ALL"] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-2.5 py-1 text-xs font-mono uppercase rounded border",
                range === r ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/40 text-muted-foreground border-border hover:text-foreground"
              )}
            >{r}</button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => toggleMetric("points")}
          aria-pressed={metrics.includes("points")}
          className={cn(
            "flex items-center gap-2 px-2.5 py-1 text-xs font-mono uppercase rounded border transition-colors",
            metrics.includes("points") ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground",
          )}
        >
          <span className="w-4 h-0.5 bg-primary" /> Punkty
        </button>
        <button
          type="button"
          onClick={() => toggleMetric("rank")}
          aria-pressed={metrics.includes("rank")}
          className={cn(
            "flex items-center gap-2 px-2.5 py-1 text-xs font-mono uppercase rounded border transition-colors",
            metrics.includes("rank") ? "border-accent/60 bg-accent/10 text-accent" : "border-border text-muted-foreground",
          )}
        >
          <span className="w-4 h-0.5 bg-accent" /> Miejsce
        </button>
      </div>
      {data.length < 1 ? (
        <div className="h-[220px] flex items-center justify-center text-xs font-mono text-muted-foreground text-center px-4">
          Brak danych rankingowych dla tej drużyny.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(t: number) => new Date(t).toISOString().slice(0, 10)}
              minTickGap={24}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              yAxisId="points"
              hide={!metrics.includes("points")}
              domain={[0, "auto"]}
              allowDataOverflow={false}
              tick={{ fontSize: 11, fill: "hsl(var(--primary))" }}
              width={46}
            />
            <YAxis
              yAxisId="rank"
              orientation="right"
              reversed
              domain={[1, 100]}
              ticks={[1, 10, 25, 50, 75, 100]}
              allowDecimals={false}
              hide={!metrics.includes("rank")}
              tick={{ fontSize: 11, fill: "hsl(var(--accent))" }}
              width={40}
            />
            <Tooltip content={<CustomTooltip teamName={teamName} />} />
            {metrics.includes("points") && (
              <Line yAxisId="points" type="monotone" dataKey="points" name="Punkty" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 5 }} connectNulls />
            )}
            {metrics.includes("rank") && (
              <Line yAxisId="rank" type="monotone" dataKey="rank" name="Miejsce" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} activeDot={{ r: 5 }} connectNulls />
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default TeamRankingTrend;
