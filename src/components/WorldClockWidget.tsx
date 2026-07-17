import { useEffect, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, ChevronsRight, RotateCcw, X, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  formatWorldDate,
  resetWorldClock,
  shiftWorldDays,
  WORLD_CLOCK_EVENT,
} from "@/lib/worldClock";

/**
 * Floating "FIFA-career style" world clock panel.
 * Lets the user step the fictional date forward/back from anywhere in the app.
 * All in-app time windows (news, ratings for last month/year, "today" in calendars)
 * read from the same world clock, so bumping the day here updates them all.
 */
const STORAGE_KEY = "world_clock_widget_collapsed";

const WorldClockWidget = () => {
  const [, force] = useState(0);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    const bump = () => force(k => k + 1);
    window.addEventListener(WORLD_CLOCK_EVENT, bump);
    return () => window.removeEventListener(WORLD_CLOCK_EVENT, bump);
  }, []);

  const toggle = (next: boolean) => {
    setCollapsed(next);
    try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
  };

  const label = formatWorldDate();

  return (
    <div className="fixed bottom-4 right-4 z-40 print:hidden">
      <AnimatePresence mode="wait" initial={false}>
        {collapsed ? (
          <motion.button
            key="pill"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => toggle(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-card/95 backdrop-blur border border-primary/40 shadow-lg shadow-primary/10 hover:border-primary transition-colors"
            title="Rozwiń zegar świata"
          >
            <CalendarClock className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono text-foreground capitalize">{label}</span>
          </motion.button>
        ) : (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="w-[260px] rounded-xl border border-primary/40 bg-card/95 backdrop-blur shadow-2xl shadow-primary/10 overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-primary" />
                <span className="text-xs font-mono uppercase tracking-wider text-primary font-black">
                  Data w grze
                </span>
              </div>
              <button
                onClick={() => toggle(true)}
                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                title="Zwiń"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="px-3 py-3 text-center">
              <div className="text-xs font-heading font-black text-foreground capitalize leading-tight">
                {label}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1 px-2 pb-2">
              <button
                onClick={() => shiftWorldDays(-7)}
                className="col-span-1 h-9 rounded-md border border-border bg-secondary/40 hover:bg-secondary text-xs font-mono text-muted-foreground hover:text-foreground flex items-center justify-center gap-0.5"
                title="Cofnij tydzień"
              >
                <ChevronLeft className="w-3 h-3" />7
              </button>
              <button
                onClick={() => shiftWorldDays(-1)}
                className="col-span-1 h-9 rounded-md border border-border bg-secondary/40 hover:bg-secondary text-xs font-mono text-muted-foreground hover:text-foreground flex items-center justify-center"
                title="Cofnij dzień"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => shiftWorldDays(1)}
                className={cn(
                  "col-span-1 h-9 rounded-md border text-xs font-mono font-black flex items-center justify-center",
                  "border-primary/50 bg-primary/15 text-primary hover:bg-primary/25",
                )}
                title="Następny dzień"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => shiftWorldDays(7)}
                className="col-span-1 h-9 rounded-md border border-border bg-secondary/40 hover:bg-secondary text-xs font-mono text-muted-foreground hover:text-foreground flex items-center justify-center gap-0.5"
                title="Do przodu o tydzień"
              >
                7<ChevronsRight className="w-3 h-3" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-1 px-2 pb-2">
              <button
                onClick={() => shiftWorldDays(1)}
                className="flex-1 h-8 rounded-md border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-mono font-black uppercase tracking-wider"
              >
                Następny dzień
              </button>
              <button
                onClick={() => { if (confirm("Zresetować datę do 2026-01-01?")) resetWorldClock(); }}
                className="h-8 w-8 rounded-md border border-border bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center"
                title="Reset do 2026-01-01"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorldClockWidget;
