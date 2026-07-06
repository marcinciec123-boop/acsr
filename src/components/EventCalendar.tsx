import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Zap, Flag, Swords, Target, Trophy, CheckCircle } from "lucide-react";
import { type Tournament, type TournamentSimulation } from "@/data/tournaments";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: "match" | "tournament-start" | "tournament-end" | "qualifier";
  description: string;
  tier?: string;
  status?: string;
}

const eventTypeConfig = {
  match: { icon: Swords, color: "text-primary", bg: "bg-primary/10", border: "border-primary/30" },
  "tournament-start": { icon: Flag, color: "text-accent", bg: "bg-accent/10", border: "border-accent/30" },
  "tournament-end": { icon: Target, color: "text-muted-foreground", bg: "bg-muted", border: "border-border" },
  qualifier: { icon: Zap, color: "text-win", bg: "bg-win/10", border: "border-win/30" },
};

interface EventCalendarProps {
  tournaments: Tournament[];
  simResults: Record<string, TournamentSimulation>;
}

const EventCalendar = ({ tournaments, simResults }: EventCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    // Start at first upcoming tournament month or January 2026
    const upcoming = tournaments.find(t => t.status === "upcoming");
    if (upcoming) {
      const d = new Date(upcoming.startDate);
      return new Date(d.getFullYear(), d.getMonth());
    }
    return new Date(2026, 0);
  });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const prevMonthDays = new Date(year, month, 0).getDate();
  const dayNames = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb"];

  // Generate events from tournaments
  const calendarEvents = useMemo(() => {
    const events: CalendarEvent[] = [];
    tournaments.forEach((t, i) => {
      // Start event
      events.push({
        id: `start-${t.id}`,
        title: t.name,
        date: t.startDate,
        type: "tournament-start",
        description: `${t.prizePool} — ${t.location} (${t.tier}-Tier)`,
        tier: t.tier,
        status: t.status,
      });
      // End event
      if (t.endDate !== t.startDate) {
        events.push({
          id: `end-${t.id}`,
          title: `${t.name} — Finał`,
          date: t.endDate,
          type: "tournament-end",
          description: simResults[t.id] ? `Zwycięzca: ${simResults[t.id].winner}` : `Koniec turnieju`,
          tier: t.tier,
          status: t.status,
        });
      }
    });
    return events;
  }, [tournaments, simResults]);

  const eventsMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    calendarEvents.forEach((event) => {
      const key = event.date;
      if (!map[key]) map[key] = [];
      map[key].push(event);
    });
    return map;
  }, [calendarEvents]);

  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    // Default select first event in current month
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    const firstEvent = calendarEvents.find(e => e.date.startsWith(monthStr));
    return firstEvent?.date || null;
  });

  const selectedEvents = selectedDate ? eventsMap[selectedDate] || [] : [];

  const navigate = (dir: number) => {
    const newMonth = new Date(year, month + dir);
    setCurrentMonth(newMonth);
    // Auto-select first event in new month
    const monthStr = `${newMonth.getFullYear()}-${String(newMonth.getMonth() + 1).padStart(2, "0")}`;
    const firstEvent = calendarEvents.find(e => e.date.startsWith(monthStr));
    setSelectedDate(firstEvent?.date || null);
  };

  const calendarDays = useMemo(() => {
    const days: { day: number; inMonth: boolean; dateStr: string }[] = [];

    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevM = month === 0 ? 12 : month;
      const prevY = month === 0 ? year - 1 : year;
      days.push({ day: d, inMonth: false, dateStr: `${prevY}-${String(prevM).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        day: d,
        inMonth: true,
        dateStr: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      });
    }

    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextM = month + 2 > 12 ? 1 : month + 2;
      const nextY = month + 2 > 12 ? year + 1 : year;
      days.push({ day: d, inMonth: false, dateStr: `${nextY}-${String(nextM).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
    }

    return days;
  }, [year, month, daysInMonth, firstDayOfWeek, prevMonthDays]);

  // Count events per month for quick navigation
  const monthEventCount = useMemo(() => {
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    return calendarEvents.filter(e => e.date.startsWith(monthStr)).length;
  }, [calendarEvents, year, month]);

  const tierBadge = (tier?: string) => {
    if (!tier) return null;
    const colors: Record<string, string> = {
      S: "text-accent bg-accent/10 border-accent/30",
      A: "text-primary bg-primary/10 border-primary/30",
      B: "text-silver bg-silver/10 border-silver/30",
      C: "text-muted-foreground bg-muted border-border",
    };
    return (
      <span className={cn("text-xs font-mono px-1.5 py-0.5 rounded border", colors[tier] || colors.C)}>
        {tier}-Tier
      </span>
    );
  };

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 mb-2">
          <CalendarIcon className="w-6 h-6 text-primary" />
          <h2 className="text-3xl font-heading font-bold text-foreground">Kalendarz Sezonu 2026</h2>
        </div>
        <p className="text-muted-foreground text-sm font-mono mb-8">
          {tournaments.length} turniejów w sezonie • {tournaments.filter(t => t.status === "completed").length} zakończonych
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid */}
          <div className="lg:col-span-2 bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-secondary rounded-md transition-colors text-muted-foreground hover:text-foreground">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-center">
                <h3 className="font-heading text-xl font-bold text-foreground">
                  {currentMonth.toLocaleDateString("pl-PL", { month: "long", year: "numeric" })}
                </h3>
                <p className="text-xs font-mono text-muted-foreground">{monthEventCount} wydarzeń</p>
              </div>
              <button onClick={() => navigate(1)} className="p-2 hover:bg-secondary rounded-md transition-colors text-muted-foreground hover:text-foreground">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {dayNames.map((d) => (
                <div key={d} className="text-center text-xs font-mono text-muted-foreground py-2">
                  {d}
                </div>
              ))}

              {calendarDays.map((day, i) => {
                const dayEvents = eventsMap[day.dateStr] || [];
                const hasEvents = dayEvents.length > 0;
                const isSelected = selectedDate === day.dateStr;
                const hasCompleted = dayEvents.some(e => e.status === "completed");
                const hasTierS = dayEvents.some(e => e.tier === "S");

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(day.dateStr)}
                    className={cn(
                      "relative aspect-square flex flex-col items-center justify-center rounded-md text-sm transition-all",
                      day.inMonth ? "text-foreground" : "text-muted-foreground/30",
                      isSelected && "bg-primary/20 border border-primary/50",
                      !isSelected && hasEvents && "hover:bg-secondary",
                      !isSelected && !hasEvents && "hover:bg-secondary/50"
                    )}
                  >
                    <span className={cn("font-mono", hasTierS && day.inMonth && "font-bold text-accent")}>{day.day}</span>
                    {hasEvents && day.inMonth && (
                      <div className="flex gap-0.5 mt-0.5">
                        {dayEvents.slice(0, 3).map((e, j) => (
                          <div
                            key={j}
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              hasCompleted ? "bg-win/50" : eventTypeConfig[e.type].bg,
                              "border",
                              hasCompleted ? "border-win/30" : eventTypeConfig[e.type].border
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Event Details */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="font-heading text-lg font-bold text-foreground mb-4">
              {selectedDate
                ? new Date(selectedDate + "T12:00:00").toLocaleDateString("pl-PL", { weekday: "long", month: "long", day: "numeric" })
                : "Wybierz datę"}
            </h3>

            {selectedEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm">Brak wydarzeń w tym dniu.</p>
            ) : (
              <div className="space-y-3">
                {selectedEvents.map((event, i) => {
                  const config = eventTypeConfig[event.type];
                  const Icon = config.icon;

                  return (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={cn("p-3 rounded-md border", config.bg, config.border)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={cn("w-4 h-4", config.color)} />
                        <span className={cn("text-sm font-semibold", config.color)}>
                          {event.type === "tournament-start" ? "START" : event.type === "tournament-end" ? "FINAŁ" : event.type.replace("-", " ").toUpperCase()}
                        </span>
                        {tierBadge(event.tier)}
                        {event.status === "completed" && (
                          <CheckCircle className="w-3.5 h-3.5 text-win" />
                        )}
                      </div>
                      <h4 className="font-heading font-bold text-foreground">{event.title}</h4>
                      <p className="text-muted-foreground text-sm">{event.description}</p>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-border/50 space-y-2">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Legenda</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-accent/50 border border-accent/30" />
                  <span className="text-muted-foreground">Start turnieju</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-muted border border-border" />
                  <span className="text-muted-foreground">Finał</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-win/50 border border-win/30" />
                  <span className="text-muted-foreground">Zakończony</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-accent font-bold font-mono text-xs">5</span>
                  <span className="text-muted-foreground">Tier S</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default EventCalendar;
