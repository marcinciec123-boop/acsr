import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpDown, FileSignature, Search, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ContractStatusBadge from "./ContractStatusBadge";
import RenewContractDialog from "./RenewContractDialog";
import PlayerAvatar from "@/components/PlayerAvatar";
import {
  CONTRACTS_EVENT, contractStatus, daysLeft, formatDatePl, formatRemaining, formatSalary,
  getTeamContracts, summarizeTeamContracts, type ContractStatus, type PlayerContract,
} from "@/lib/contracts";

type SortKey = "end" | "salary" | "player" | "status";
type FilterKey = "all" | "warning" | "critical" | "expired";

interface Props {
  team: string;
  onSelectPlayer?: (player: string) => void;
}

const STATUS_ORDER: Record<ContractStatus, number> = {
  expired: 0, critical: 1, warning: 2, active: 3, terminated: 4,
};

/** Pełny panel zarządzania kontraktami drużyny. */
const TeamContractsPanel = ({ team, onSelectPlayer }: Props) => {
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("end");
  const [desc, setDesc] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [renewTarget, setRenewTarget] = useState<PlayerContract | undefined>();

  const refresh = useCallback(() => setTick(t => t + 1), []);
  useEffect(() => {
    window.addEventListener(CONTRACTS_EVENT, refresh);
    window.addEventListener("worldclock:update", refresh);
    return () => {
      window.removeEventListener(CONTRACTS_EVENT, refresh);
      window.removeEventListener("worldclock:update", refresh);
    };
  }, [refresh]);

  const contracts = useMemo(() => getTeamContracts(team), [team, tick]);
  const summary = useMemo(() => summarizeTeamContracts(team), [team, tick]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = contracts
      .map(c => ({ c, status: contractStatus(c), days: daysLeft(c.endDate) }))
      .filter(r => (!q || r.c.player.toLowerCase().includes(q)))
      .filter(r => {
        if (filter === "all") return true;
        if (filter === "expired") return r.status === "expired";
        if (filter === "critical") return r.status === "critical";
        return r.status === "warning" || r.status === "critical";
      });

    list.sort((a, b) => {
      let cmp = 0;
      if (sort === "end") cmp = a.days - b.days;
      else if (sort === "salary") cmp = b.c.salary - a.c.salary;
      else if (sort === "player") cmp = a.c.player.localeCompare(b.c.player);
      else cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      return desc ? -cmp : cmp;
    });
    return list;
  }, [contracts, search, sort, desc, filter]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setDesc(d => !d);
    else { setSort(key); setDesc(false); }
  };

  const SortHead = ({ id, label, className }: { id: SortKey; label: string; className?: string }) => (
    <button
      onClick={() => toggleSort(id)}
      className={cn(
        "flex items-center gap-1 text-xs font-mono uppercase tracking-wider transition-colors",
        sort === id ? "text-primary" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {label} <ArrowUpDown className="w-3 h-3" />
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: "Kontrakty", value: summary.total, cls: "text-foreground" },
          { label: "Aktywne", value: summary.active, cls: "text-emerald-400" },
          { label: "≤90 dni", value: summary.warning, cls: "text-amber-400" },
          { label: "≤30 dni", value: summary.critical, cls: "text-orange-400" },
          { label: "Wygasłe", value: summary.expired, cls: "text-destructive" },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border bg-card/60 p-2.5">
            <p className="text-xs font-mono uppercase text-muted-foreground tracking-wider">{s.label}</p>
            <p className={cn("text-xl font-heading font-bold", s.cls)}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 flex items-center gap-2">
        <Wallet className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-mono text-muted-foreground">Miesięczny payroll</span>
        <span className="ml-auto font-heading font-bold text-primary">{formatSalary(summary.payroll)}</span>
      </div>

      {(summary.critical > 0 || summary.expired > 0) && (
        <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
          <p className="text-xs font-mono text-orange-200">
            {summary.expired > 0 && <>{summary.expired} kontrakt(ów) wygasło — zawodnicy trafiają do wolnych agentów. </>}
            {summary.critical > 0 && <>{summary.critical} kontrakt(ów) kończy się w ciągu 30 dni. Rozważ odnowienie.</>}
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Szukaj zawodnika..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 bg-secondary/40"
          />
        </div>
        {([
          { v: "all", label: "Wszystkie" },
          { v: "warning", label: "Wygasające" },
          { v: "critical", label: "Pilne" },
          { v: "expired", label: "Wygasłe" },
        ] as { v: FilterKey; label: string }[]).map(o => (
          <button
            key={o.v}
            onClick={() => setFilter(o.v)}
            className={cn(
              "px-2 py-1.5 text-xs font-mono rounded border transition-colors",
              filter === o.v ? "bg-primary/20 text-primary border-primary/40" : "text-muted-foreground border-border hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Table header */}
      <div className="hidden md:grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_auto] gap-2 px-3">
        <SortHead id="player" label="Zawodnik" />
        <SortHead id="salary" label="Pensja" />
        <SortHead id="end" label="Koniec" />
        <SortHead id="status" label="Status" />
        <span className="text-xs font-mono uppercase text-muted-foreground tracking-wider">Akcja</span>
      </div>

      <div className="space-y-1.5">
        {rows.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs font-mono text-muted-foreground">
            Brak kontraktów spełniających kryteria.
          </div>
        )}
        {rows.map(({ c, status, days }) => {
          const total = Math.max(1, (new Date(c.endDate).getTime() - new Date(c.startDate).getTime()) / 86_400_000);
          const pct = Math.max(0, Math.min(100, ((total - days) / total) * 100));
          return (
            <div
              key={c.id}
              className="rounded-lg border border-border bg-card/60 hover:bg-card transition-colors p-3 grid md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_auto] gap-2 items-center"
            >
              <button
                type="button"
                onClick={() => onSelectPlayer?.(c.player)}
                className="flex items-center gap-2 min-w-0 text-left"
              >
                <PlayerAvatar player={c.player} team={c.team} size={34} />
                <div className="min-w-0">
                  <p className="font-heading font-bold text-sm truncate hover:text-primary transition-colors">{c.player}</p>
                  <p className="text-xs font-mono text-muted-foreground truncate">
                    {c.terms?.role || "—"}{c.terms?.buyout ? ` • buyout ${formatSalary(c.terms.buyout)}` : ""}
                  </p>
                </div>
              </button>

              <div className="font-mono text-sm text-foreground">
                {formatSalary(c.salary)}<span className="text-xs text-muted-foreground">/mies.</span>
              </div>

              <div className="min-w-0">
                <p className="font-mono text-xs text-foreground">{formatDatePl(c.endDate)}</p>
                <div className="h-1 mt-1 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      status === "expired" ? "bg-destructive"
                        : status === "critical" ? "bg-orange-400"
                        : status === "warning" ? "bg-amber-400" : "bg-primary",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs font-mono text-muted-foreground mt-0.5">{formatRemaining(days)}</p>
              </div>

              <ContractStatusBadge contract={c} />

              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setRenewTarget(c)}>
                <FileSignature className="w-3.5 h-3.5" /> Odnów
              </Button>
            </div>
          );
        })}
      </div>

      <RenewContractDialog
        contract={renewTarget}
        open={!!renewTarget}
        onOpenChange={o => { if (!o) setRenewTarget(undefined); }}
        onRenewed={refresh}
      />
    </div>
  );
};

export default TeamContractsPanel;
