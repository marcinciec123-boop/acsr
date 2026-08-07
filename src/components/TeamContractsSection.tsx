import { useCallback, useEffect, useMemo, useState } from "react";
import { FileSignature, TrendingUp, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  CONTRACTS_EVENT, formatMoney, formatRemaining, getContractInfo, getMarketValue,
  renewContract, suggestSalary, type ContractInfo,
} from "@/lib/contracts";
import { WORLD_CLOCK_EVENT } from "@/lib/worldClock";
import type { TeamData } from "@/lib/types";

interface Row {
  player: string;
  isCoach: boolean;
  info: ContractInfo | null;
  marketValue: number;
  rating: number;
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
};

const urgencyClass = (u?: string) =>
  u === "critical" || u === "urgent"
    ? "text-[hsl(var(--loss))]"
    : u === "soon"
      ? "text-amber-400"
      : "text-foreground";

const TeamContractsSection = ({ team }: { team: TeamData }) => {
  const people = useMemo(
    () => [...team.roster.map(p => ({ player: p, isCoach: false })), ...(team.coach ? [{ player: team.coach, isCoach: true }] : [])],
    [team.roster, team.coach],
  );

  const build = useCallback((): Row[] => people.map(p => {
    const mv = getMarketValue(p.player, team.name);
    return { ...p, info: getContractInfo(p.player), marketValue: mv.value, rating: mv.rating };
  }), [people, team.name]);

  const [rows, setRows] = useState<Row[]>(build);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<{ endDate: string; salary: string }>({ endDate: "", salary: "" });

  useEffect(() => {
    const sync = () => setRows(build());
    sync();
    window.addEventListener(CONTRACTS_EVENT, sync);
    window.addEventListener(WORLD_CLOCK_EVENT, sync);
    return () => {
      window.removeEventListener(CONTRACTS_EVENT, sync);
      window.removeEventListener(WORLD_CLOCK_EVENT, sync);
    };
  }, [build]);

  const startEdit = (row: Row) => {
    setEditing(row.player);
    setForm({
      endDate: row.info?.contract.end_date.slice(0, 10) || "",
      salary: String(row.info?.contract.salary ?? suggestSalary(row.player, team.name)),
    });
  };

  const save = (row: Row) => {
    if (!form.endDate) {
      toast({ title: "Podaj datę końca kontraktu", variant: "destructive" });
      return;
    }
    renewContract(row.player, {
      endDate: form.endDate,
      salary: parseInt(form.salary) || 0,
      team: team.name,
    });
    setEditing(null);
    toast({ title: "Kontrakt odnowiony", description: `${row.player} — do ${fmtDate(form.endDate)}` });
  };

  if (rows.length === 0) {
    return <p className="text-xs font-mono text-muted-foreground px-2.5 pb-2.5">Brak zawodników w składzie.</p>;
  }

  return (
    <div className="border-t border-border/60 px-2.5 py-2 space-y-1.5">
      <div className="hidden sm:grid grid-cols-[1fr_100px_90px_100px_70px] gap-2 px-1 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        <span>Zawodnik</span>
        <span>Do</span>
        <span>Płaca</span>
        <span>Wartość</span>
        <span />
      </div>
      {rows.map(row => {
        const isEditing = editing === row.player;
        return (
          <div
            key={row.player}
            className={cn(
              "grid grid-cols-1 sm:grid-cols-[1fr_100px_90px_100px_70px] gap-2 items-center rounded px-1 py-1",
              isEditing && "bg-primary/5",
            )}
          >
            <div className="min-w-0 flex items-center gap-2">
              <span className="font-heading font-bold text-xs text-foreground truncate">{row.player}</span>
              {row.isCoach && <span className="text-[10px] font-mono text-muted-foreground">COACH</span>}
              {row.rating > 0 && (
                <span className="text-[11px] font-mono text-muted-foreground">{row.rating.toFixed(2)}</span>
              )}
            </div>

            {isEditing ? (
              <>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  className="h-7 text-xs px-1.5"
                />
                <Input
                  type="number"
                  value={form.salary}
                  onChange={e => setForm(f => ({ ...f, salary: e.target.value }))}
                  placeholder="EUR / mies."
                  className="h-7 text-xs px-1.5"
                />
                <span className="text-xs font-mono text-primary flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> {formatMoney(row.marketValue)}
                </span>
                <div className="flex items-center gap-1 justify-end">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-primary" onClick={() => save(row)}>
                    <Save className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setEditing(null)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <span className={cn("text-xs font-mono", urgencyClass(row.info?.urgency))}>
                  {row.info ? fmtDate(row.info.contract.end_date) : "—"}
                  {row.info && (
                    <span className="block text-[10px] text-muted-foreground">{formatRemaining(row.info.daysLeft)}</span>
                  )}
                </span>
                <span className="text-xs font-mono text-emerald-400">
                  {row.info?.contract.salary ? formatMoney(row.info.contract.salary) : "—"}
                </span>
                <span className="text-xs font-mono text-primary flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> {formatMoney(row.marketValue)}
                </span>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px] font-mono"
                    onClick={() => startEdit(row)}
                    title="Odnów kontrakt"
                  >
                    <FileSignature className="w-3.5 h-3.5 mr-1" /> Odnów
                  </Button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TeamContractsSection;
