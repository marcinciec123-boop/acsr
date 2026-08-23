import { useCallback, useEffect, useMemo, useState } from "react";
import { FileSignature, History, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ContractStatusBadge from "./ContractStatusBadge";
import RenewContractDialog from "./RenewContractDialog";
import {
  CONTRACTS_EVENT, contractStatus, daysLeft, formatDatePl, formatRemaining, formatSalary,
  getContractHistory, getCurrentContract, monthsBetween, suggestSalary,
} from "@/lib/contracts";

interface Props {
  player: string;
}

/** Sekcja kontraktu na profilu zawodnika: warunki + historia. */
const PlayerContractCard = ({ player }: Props) => {
  const [tick, setTick] = useState(0);
  const [renewOpen, setRenewOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    window.addEventListener(CONTRACTS_EVENT, refresh);
    window.addEventListener("worldclock:update", refresh);
    return () => {
      window.removeEventListener(CONTRACTS_EVENT, refresh);
      window.removeEventListener("worldclock:update", refresh);
    };
  }, [refresh]);

  const current = useMemo(() => getCurrentContract(player), [player, tick]);
  const history = useMemo(() => getContractHistory(player), [player, tick]);

  if (!current) {
    return (
      <div className="rounded-xl border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2 mb-2">
          <FileSignature className="w-4 h-4 text-primary" />
          <h3 className="font-heading font-bold text-sm">Kontrakt</h3>
        </div>
        <p className="text-xs font-mono text-muted-foreground">
          Zawodnik nie ma aktywnego kontraktu (wolny agent). Kontrakt powstaje automatycznie przy transferze do drużyny.
        </p>
      </div>
    );
  }

  const days = daysLeft(current.endDate);
  const status = contractStatus(current);
  const total = Math.max(1, (new Date(current.endDate).getTime() - new Date(current.startDate).getTime()) / 86_400_000);
  const pct = Math.max(0, Math.min(100, ((total - days) / total) * 100));
  const market = suggestSalary(player, current.team, "renew");

  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <FileSignature className="w-4 h-4 text-primary" />
        <h3 className="font-heading font-bold text-sm">Kontrakt</h3>
        <ContractStatusBadge contract={current} showRemaining />
        <Button size="sm" variant="outline" className="ml-auto gap-1.5" onClick={() => setRenewOpen(true)}>
          <FileSignature className="w-3.5 h-3.5" /> Odnów
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: "Drużyna", value: current.team },
          { label: "Pensja", value: `${formatSalary(current.salary)}/mies.` },
          { label: "Od", value: formatDatePl(current.startDate) },
          { label: "Do", value: formatDatePl(current.endDate) },
        ].map(s => (
          <div key={s.label} className="rounded border border-border bg-secondary/30 p-2">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="text-sm font-heading font-bold truncate">{s.value}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex justify-between text-xs font-mono text-muted-foreground mb-1">
          <span>Postęp kontraktu</span>
          <span>{formatRemaining(days)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
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
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono text-muted-foreground">
        <span className="flex items-center gap-1"><Wallet className="w-3 h-3" /> Wycena rynkowa: <span className="text-primary">{formatSalary(market)}</span></span>
        {current.terms?.buyout ? <span>Buyout: <span className="text-foreground">{formatSalary(current.terms.buyout)}</span></span> : null}
        {current.terms?.signingBonus ? <span>Bonus: <span className="text-foreground">{formatSalary(current.terms.signingBonus)}</span></span> : null}
        {current.terms?.role ? <span>Rola: <span className="text-foreground">{current.terms.role}</span></span> : null}
      </div>
      {current.terms?.note && (
        <p className="text-xs font-mono text-muted-foreground border-l-2 border-primary/40 pl-2">{current.terms.note}</p>
      )}

      {history.length > 1 && (
        <div className="pt-2 border-t border-border/60">
          <button
            onClick={() => setShowHistory(v => !v)}
            className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors"
          >
            <History className="w-3.5 h-3.5" /> Historia kontraktów ({history.length})
          </button>
          {showHistory && (
            <div className="mt-2 space-y-1.5">
              {history.map(c => (
                <div key={c.id} className="flex flex-wrap items-center gap-2 rounded border border-border bg-secondary/20 px-2 py-1.5 text-xs font-mono">
                  <span className="font-bold text-foreground">{c.team}</span>
                  <span className="text-muted-foreground">{formatDatePl(c.startDate)} — {formatDatePl(c.terminatedAt || c.endDate)}</span>
                  <span className="text-muted-foreground">({monthsBetween(c.startDate, c.terminatedAt || c.endDate)} mies.)</span>
                  <span className="ml-auto text-primary">{formatSalary(c.salary)}/mies.</span>
                  <ContractStatusBadge contract={c} compact />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <RenewContractDialog
        contract={current}
        open={renewOpen}
        onOpenChange={setRenewOpen}
        onRenewed={refresh}
      />
    </div>
  );
};

export default PlayerContractCard;
