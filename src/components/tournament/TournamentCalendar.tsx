import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Trophy, MapPin, Users, Crown } from "lucide-react";
import { type Tournament } from "@/data/tournaments";
import { cn } from "@/lib/utils";
import { getWorldNow, WORLD_CLOCK_EVENT } from "@/lib/worldClock";

type ViewMode = "month" | "year";

interface Props {
  tournaments: Tournament[];
  view: ViewMode;
  onOpen: (id: string) => void;
}

const tierBg: Record<string, string> = {
  S: "bg-accent/20 text-accent border-accent/40",
  A: "bg-primary/20 text-primary border-primary/40",
  B: "bg-[hsl(var(--silver)/0.15)] text-[hsl(var(--silver))] border-[hsl(var(--silver)/0.4)]",
  C: "bg-muted/60 text-muted-foreground border-border",
};

const statusDot: Record<string, string> = {
  live: "bg-destructive animate-pulse",
  upcoming: "bg-primary",
  completed: "bg-[hsl(var(--win))]",
};

const toIsoLocal = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const parseIsoLocal = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const dateRangeDays = (start: string, end: string): string[] => {
  const out: string[] = [];
  const s = parseIsoLocal(start);
  const e = parseIsoLocal(end);
  const cur = new Date(s);
  while (cur <= e) {
    out.push(toIsoLocal(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
};

const TournamentCalendar = ({ tournaments, view, onOpen }: Props) => {
  const years = useMemo(() => {
    const set = new Set<number>();
    tournaments.forEach(t => set.add(parseIsoLocal(t.startDate).getFullYear()));
    return Array.from(set).sort();
  }, [tournaments]);

  const initialYear = years[years.length - 1] || getWorldNow().getFullYear();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(getWorldNow().getMonth());
  // Re-render "today" highlight when the fictional world clock changes.
  const [worldTick, setWorldTick] = useState(0);
  useEffect(() => {
    const bump = () => setWorldTick(k => k + 1);
    window.addEventListener(WORLD_CLOCK_EVENT, bump);
    return () => window.removeEventListener(WORLD_CLOCK_EVENT, bump);
  }, []);

  // Index: dateISO → tournaments intersecting that day
  const dayIndex = useMemo(() => {
    const map: Record<string, Tournament[]> = {};
    tournaments.forEach(t => {
      dateRangeDays(t.startDate, t.endDate).forEach(d => {
        (map[d] ??= []).push(t);
      });
    });
    return map;
  }, [tournaments]);

  if (view === "year") {
    // Timeline: 12 months × horizontal bars per tournament
    const yearTournaments = tournaments
      .filter(t => parseIsoLocal(t.startDate).getFullYear() === year || parseIsoLocal(t.endDate).getFullYear() === year)
      .sort((a, b) => parseIsoLocal(a.startDate).getTime() - parseIsoLocal(b.startDate).getTime());

    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/40">
          <button
            onClick={() => setYear(y => y - 1)}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-heading font-black text-lg text-foreground">{year}</span>
          <button
            onClick={() => setYear(y => y + 1)}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Month header */}
        <div className="grid grid-cols-[180px_1fr] border-b border-border/60 text-xs font-mono uppercase text-muted-foreground">
          <div className="px-3 py-2">Turniej</div>
          <div className="grid grid-cols-12">
            {["Sty","Lut","Mar","Kwi","Maj","Cze","Lip","Sie","Wrz","Paź","Lis","Gru"].map(m => (
              <div key={m} className="text-center py-2 border-l border-border/40">{m}</div>
            ))}
          </div>
        </div>

        <div className="max-h-[600px] overflow-y-auto">
          {yearTournaments.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground font-mono">
              Brak turniejów w {year}.
            </div>
          )}
          {yearTournaments.map(t => {
            const s = parseIsoLocal(t.startDate);
            const e = parseIsoLocal(t.endDate);
            const startDay = s.getFullYear() === year ? s.getMonth() * 30 + s.getDate() : 0;
            const endDay = e.getFullYear() === year ? e.getMonth() * 30 + e.getDate() : 360;
            const left = (startDay / 360) * 100;
            const width = Math.max(1.5, ((endDay - startDay) / 360) * 100);
            return (
              <button
                key={t.id}
                onClick={() => onOpen(t.id)}
                className="w-full grid grid-cols-[180px_1fr] items-center hover:bg-secondary/30 transition-colors text-left border-b border-border/30"
              >
                <div className="px-3 py-2 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("text-xs font-mono font-black px-1 rounded border", tierBg[t.tier])}>{t.tier}</span>
                    <span className={cn("w-1.5 h-1.5 rounded-full", statusDot[t.status])} />
                    <span className="text-xs font-heading font-bold text-foreground truncate">{t.name}</span>
                  </div>
                </div>
                <div className="relative h-8">
                  <div className="absolute inset-y-0 grid grid-cols-12 w-full">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="border-l border-border/20" />
                    ))}
                  </div>
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    style={{ left: `${left}%`, width: `${width}%`, transformOrigin: "left" }}
                    className={cn(
                      "absolute top-1.5 h-5 rounded-md border",
                      t.status === "completed" ? "bg-[hsl(var(--win)/0.25)] border-[hsl(var(--win)/0.5)]" :
                      t.status === "live" ? "bg-destructive/25 border-destructive/60" :
                      "bg-primary/20 border-primary/50"
                    )}
                    title={`${t.name} • ${t.startDate} → ${t.endDate}`}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ==== Month grid ====
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // Monday=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = first.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/40">
        <button
          onClick={() => {
            if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1);
          }}
          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="font-heading font-black text-lg text-foreground capitalize">{monthLabel}</span>
        <button
          onClick={() => {
            if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1);
          }}
          className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-xs font-mono uppercase text-muted-foreground border-b border-border/60">
        {["Pon","Wto","Śro","Czw","Pią","Sob","Nie"].map(d => (
          <div key={d} className="text-center py-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="min-h-20 md:min-h-24 border-t border-l border-border/30 bg-secondary/10" />;
          const iso = toIsoLocal(day);
          const items = dayIndex[iso] || [];
          const isToday = iso === toIsoLocal(getWorldNow()) && worldTick >= 0;
          return (
            <div
              key={i}
              className={cn(
                "min-h-20 md:min-h-24 border-t border-l border-border/30 p-1 text-left flex flex-col gap-1",
                isToday && "bg-primary/[0.06]",
              )}
            >
              <div className={cn(
                "text-xs font-mono",
                isToday ? "text-primary font-black" : "text-muted-foreground"
              )}>
                {day.getDate()}
              </div>
              <div className="flex-1 space-y-0.5 overflow-hidden">
                {items.slice(0, 3).map(t => (
                  <button
                    key={t.id}
                    onClick={() => onOpen(t.id)}
                    className={cn(
                      "w-full text-left text-xs font-mono px-1 py-0.5 rounded border truncate hover:brightness-125 transition-all",
                      tierBg[t.tier],
                    )}
                    title={t.name}
                  >
                    <span className={cn("inline-block w-1 h-1 rounded-full mr-1 align-middle", statusDot[t.status])} />
                    {t.name}
                  </button>
                ))}
                {items.length > 3 && (
                  <div className="text-xs font-mono text-muted-foreground pl-1">
                    +{items.length - 3} więcej
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TournamentCalendar;
