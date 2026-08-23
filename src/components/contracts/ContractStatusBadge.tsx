import { AlertTriangle, CircleAlert, CircleCheck, CircleSlash, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STATUS_CLASS, STATUS_LABEL, contractStatus, daysLeft, formatRemaining,
  type ContractStatus, type PlayerContract,
} from "@/lib/contracts";

const ICONS: Record<ContractStatus, typeof Clock> = {
  active: CircleCheck,
  warning: Clock,
  critical: AlertTriangle,
  expired: CircleAlert,
  terminated: CircleSlash,
};

interface Props {
  contract?: PlayerContract;
  /** Pokaż pozostały czas obok statusu. */
  showRemaining?: boolean;
  compact?: boolean;
  className?: string;
}

/** Uniwersalny badge statusu kontraktu (skład, profil, panel kontraktów). */
const ContractStatusBadge = ({ contract, showRemaining, compact, className }: Props) => {
  if (!contract) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-mono",
        "text-muted-foreground border-border bg-secondary/40", className,
      )}>
        <CircleSlash className="w-3 h-3" /> {compact ? "—" : "Brak kontraktu"}
      </span>
    );
  }
  const status = contractStatus(contract);
  const Icon = ICONS[status];
  const days = daysLeft(contract.endDate);
  return (
    <span
      title={`${STATUS_LABEL[status]} • do ${new Date(contract.endDate).toLocaleDateString("pl-PL")}`}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-mono whitespace-nowrap",
        STATUS_CLASS[status], className,
      )}
    >
      <Icon className="w-3 h-3 shrink-0" />
      {!compact && STATUS_LABEL[status]}
      {showRemaining && <span className="opacity-80">{compact ? formatRemaining(days) : `• ${formatRemaining(days)}`}</span>}
    </span>
  );
};

export default ContractStatusBadge;
