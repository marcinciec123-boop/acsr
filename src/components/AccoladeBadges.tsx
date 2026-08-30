// Small badge row with year-end ceremony accolades ("#4 gracz roku 2025").
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { accoladeClass, type Accolade } from "@/lib/awardAccolades";

const AccoladeBadges = ({ accolades, className }: { accolades: Accolade[]; className?: string }) => {
  if (!accolades.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {accolades.map((a, i) => (
        <span
          key={`${a.year}-${a.label}-${i}`}
          title={`Ceremonia Nagród ACSR ${a.year}`}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-mono font-bold",
            accoladeClass(a.tone),
          )}
        >
          {a.tone === "gold" && <Crown className="w-3 h-3 text-[hsl(var(--gold))]" />}
          {a.label}
        </span>
      ))}
    </div>
  );
};

export default AccoladeBadges;
