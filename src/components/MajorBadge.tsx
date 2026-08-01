// Prestige badge for Major tournaments.
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";

const MajorBadge = ({ className, compact }: { className?: string; compact?: boolean }) => (
  <span
    title="Major — najważniejszy turniej sezonu"
    className={cn(
      "inline-flex items-center gap-1 rounded-md border border-[hsl(var(--gold))]/60",
      "bg-gradient-to-r from-[hsl(var(--gold))]/30 via-[hsl(var(--gold))]/10 to-transparent",
      "text-[hsl(var(--gold))] font-heading font-black uppercase tracking-widest",
      "shadow-[0_0_12px_hsl(var(--gold)/0.35)]",
      compact ? "px-1.5 py-0.5 text-2xs" : "px-2 py-0.5 text-xs",
      className,
    )}
  >
    <Crown className={compact ? "w-2.5 h-2.5" : "w-3 h-3"} />
    Major
  </span>
);

export default MajorBadge;
