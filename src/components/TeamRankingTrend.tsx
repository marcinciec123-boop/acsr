import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";
import { getTeamRankingSeries, getTeamRosterAt } from "@/lib/rankingHistory";
import { getWorldDate } from "@/lib/worldClock";
import { playerRoles, roleColors, roleIcons } from "@/data/playerRoles";
import { cn } from "@/lib/utils";

type Range = "1Y" | "5Y" | "ALL";

const cutoffFor = (range: Range): string => {
  if (range === "ALL") return "0000-01-01";
  const [y, m, d] = getWorldDate().split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setFullYear(dt.getFullYear() - (range === "1Y" ? 1 : 5));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

const CustomTooltip = ({ active, payload, label, teamName }: { active?: boolean; payload?: { value: number }[]; label?: string; teamName: string }) => {
  if (!active || !payload?.length || !label) return null;
  const roster = getTeamRosterAt(teamName, label);
  return (
    <div className="bg-card border border-primary/40 rounded-md p-3 shadow-xl min-w-[220px]">
      <div className="text-xs font-mono text-muted-foreground uppercase mb-1">{label}</div>
      <div className="text-lg font-heading font-black text-primary tabular-nums mb-2">
        {payload[0].value.toLocaleString()} <span className="text-xs text-muted-foreground font-mono">pkt</span>
      </div>
      <div className="text-xs font-mono uppercase text-muted-foreground mb-1">Skład</div>
      <div className="space-y-1">
        {roster.length === 0 && <div className="text-xs text-muted-foreground italic">brak danych</div>}
        {roster.map(p => {
          const role = playerRoles[p];
          const Icon = role ? roleIcons[role] : null;
          return (
            <div key={p} className="flex items-center gap-2 text-xs">
              {Icon && <Icon className={cn("w-3 h-3", role && roleColors[role])} />}
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
  const [range, setRange] = useState<Range>("1Y");

  const data = useMemo(() => {
    const cutoff = cutoffFor(range);
    return getTeamRankingSeries(teamName).filter(p => p.date >= cutoff);
  }, [teamName, range]);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-heading font-black uppercase tracking-wider">Rozwój w rankingu</h4>
        </div>
        <div className="flex items-center gap-1">
          {(["1Y", "5Y", "ALL"] as Range[]).map(r => (
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
      {data.length < 2 ? (
        <div className="h-[220px] flex items-center justify-center text-xs font-mono text-muted-foreground text-center px-4">
          Za mało snapshotów. Historia zapisuje się automatycznie po każdym zatwierdzonym turnieju.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip content={<CustomTooltip teamName={teamName} />} />
            <Line type="monotone" dataKey="points" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default TeamRankingTrend;
