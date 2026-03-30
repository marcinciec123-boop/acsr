import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Zap, Flag, Swords, Target } from "lucide-react";
import { calendarEvents, type CalendarEvent } from "@/data/tournaments";
import { cn } from "@/lib/utils";

const eventTypeConfig = {
  match: { icon: Swords, color: "text-primary", bg: "bg-primary/10", border: "border-primary/30" },
  "tournament-start": { icon: Flag, color: "text-accent", bg: "bg-accent/10", border: "border-accent/30" },
  "tournament-end": { icon: Target, color: "text-muted-foreground", bg: "bg-muted", border: "border-border" },
  qualifier: { icon: Zap, color: "text-win", bg: "bg-win/10", border: "border-win/30" },
};

const EventCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 3)); // April 2026

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const prevMonthDays = new Date(year, month, 0).getDate();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const eventsMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    calendarEvents.forEach((event) => {
      const key = event.date;
      if (!map[key]) map[key] = [];
      map[key].push(event);
    });
    return map;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string | null>("2026-04-05");

  const selectedEvents = selectedDate ? eventsMap[selectedDate] || [] : [];

  const navigate = (dir: number) => {
    setCurrentMonth(new Date(year, month + dir));
    setSelectedDate(null);
  };

  const calendarDays = useMemo(() => {
    const days: { day: number; inMonth: boolean; dateStr: string }[] = [];

    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = month === 0 ? 12 : month;
      days.push({ day: d, inMonth: false, dateStr: `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
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
      const m = month + 2 > 12 ? 1 : month + 2;
      days.push({ day: d, inMonth: false, dateStr: `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
    }

    return days;
  }, [year, month, daysInMonth, firstDayOfWeek, prevMonthDays]);

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 mb-8">
          <CalendarIcon className="w-6 h-6 text-primary" />
          <h2 className="text-3xl font-heading font-bold text-foreground">Event Calendar</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid */}
          <div className="lg:col-span-2 bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-secondary rounded-md transition-colors text-muted-foreground hover:text-foreground">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="font-heading text-xl font-bold text-foreground">
                {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </h3>
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
                const hasEvents = eventsMap[day.dateStr]?.length > 0;
                const isSelected = selectedDate === day.dateStr;

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
                    <span className="font-mono">{day.day}</span>
                    {hasEvents && day.inMonth && (
                      <div className="flex gap-0.5 mt-0.5">
                        {eventsMap[day.dateStr].slice(0, 3).map((e, j) => (
                          <div
                            key={j}
                            className={cn("w-1.5 h-1.5 rounded-full", eventTypeConfig[e.type].bg, "border", eventTypeConfig[e.type].border)}
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
                ? new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
                : "Select a Date"}
            </h3>

            {selectedEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm">No events on this date.</p>
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
                          {event.type.replace("-", " ").toUpperCase()}
                        </span>
                      </div>
                      <h4 className="font-heading font-bold text-foreground">{event.title}</h4>
                      <p className="text-muted-foreground text-sm">{event.description}</p>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default EventCalendar;
