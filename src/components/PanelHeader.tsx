import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PanelHeaderProps {
  icon: LucideIcon;
  title: string;
  /** Small monospaced meta line under the title. */
  meta?: React.ReactNode;
  /** Right-hand side content — usually action buttons. */
  actions?: React.ReactNode;
  /** Optional badges/pills rendered next to the title. */
  chips?: React.ReactNode;
  className?: string;
}

/**
 * Reusable panel header banner — gradient tinted with the current theme's
 * primary color, an icon plate, title, optional meta line and action slot.
 * Kept fully driven by semantic tokens so it adapts to every theme.
 */
const PanelHeader = ({ icon: Icon, title, meta, actions, chips, className }: PanelHeaderProps) => (
  <div
    className={cn(
      "relative overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-primary/12 via-primary/[0.04] to-transparent p-4 sm:p-5 mb-5",
      className,
    )}
  >
    <div className="absolute -top-12 -right-12 w-44 h-44 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
    <div className="absolute -bottom-16 -left-10 w-48 h-48 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
    <div className="relative flex items-start justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-11 h-11 shrink-0 rounded-lg bg-primary/15 border border-primary/40 flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary)/0.15)]">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-heading font-bold text-foreground leading-tight tracking-tight">
              {title}
            </h2>
            {chips}
          </div>
          {meta && (
            <p className="text-xs text-muted-foreground font-mono mt-1 truncate">
              {meta}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2 items-center">{actions}</div>}
    </div>
  </div>
);

export default PanelHeader;
