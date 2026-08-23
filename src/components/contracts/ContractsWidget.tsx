import { useEffect, useState } from "react";
import { ChevronRight, FileSignature } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONTRACTS_EVENT, formatSalary, summarizeTeamContracts } from "@/lib/contracts";

interface Props {
  team: string;
  onOpen?: () => void;
}

/** Mały widget kontraktów na dashboardzie drużyny. */
const ContractsWidget = ({ team, onOpen }: Props) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const refresh = () => setTick(t => t + 1);
    window.addEventListener(CONTRACTS_EVENT, refresh);
    window.addEventListener("worldclock:update", refresh);
    return () => {
      window.removeEventListener(CONTRACTS_EVENT, refresh);
      window.removeEventListener("worldclock:update", refresh);
    };
  }, []);

  const s = summarizeTeamContracts(team);
  void tick;

  const rows = [
    { label: "aktywnych kontraktów", value: s.active, cls: "text-emerald-400" },
    { label: "wygasa w ciągu 90 dni", value: s.warning, cls: "text-amber-400" },
    { label: "wygasa w ciągu 30 dni", value: s.critical, cls: "text-orange-400" },
    { label: "wygasłych", value: s.expired, cls: "text-destructive" },
  ];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-xl border border-border bg-card/60 hover:border-primary/40 hover:bg-card transition-colors p-4 group"
    >
      <div className="flex items-center gap-2 mb-3">
        <FileSignature className="w-4 h-4 text-primary" />
        <h4 className="font-heading font-bold text-sm">Kontrakty</h4>
        {(s.critical > 0 || s.expired > 0) && (
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
        )}
        <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <ul className="space-y-1">
        {rows.map(r => (
          <li key={r.label} className="flex items-center gap-2 text-xs font-mono">
            <span className={cn("font-bold w-5 text-right", r.cls)}>{r.value}</span>
            <span className="text-muted-foreground">{r.label}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 pt-2 border-t border-border/60 flex justify-between text-xs font-mono">
        <span className="text-muted-foreground">Payroll / mies.</span>
        <span className="text-primary font-bold">{formatSalary(s.payroll)}</span>
      </div>
    </button>
  );
};

export default ContractsWidget;
