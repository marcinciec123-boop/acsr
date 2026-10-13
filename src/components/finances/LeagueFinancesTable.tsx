import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { getLeagueFinances, HEALTH_LABEL } from "@/lib/teamFinances";
import { HEALTH_CLASS, money, useFinanceTick } from "./TeamFinancePanel";

const LeagueFinancesTable = ({ onSelectTeam }: { onSelectTeam?: (team: string) => void }) => {
  const tick = useFinanceTick();
  const list = useMemo(() => getLeagueFinances(), [tick]);
  return (
    <div className="space-y-1">
      {list.map((f, i) => (
        <button key={f.team} type="button" onClick={() => onSelectTeam?.(f.team)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-card/50 hover:border-primary/40 text-left text-xs font-mono">
          <span className="w-6 text-muted-foreground">{i + 1}.</span>
          <span className="flex-1 min-w-0 truncate font-heading font-bold text-sm">{f.team}</span>
          <span className={cn("hidden sm:inline px-2 py-0.5 rounded border text-[10px]", HEALTH_CLASS[f.health])}>{HEALTH_LABEL[f.health]}</span>
          <span className={f.balance >= 0 ? "text-emerald-400" : "text-destructive"}>{money(f.balance)}</span>
        </button>
      ))}
    </div>
  );
};

export default LeagueFinancesTable;
