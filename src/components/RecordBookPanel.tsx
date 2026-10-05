import { useEffect, useMemo, useState } from "react";
import { BookOpen, Crown, ChevronDown, Search } from "lucide-react";
import TeamLogo from "@/components/TeamLogo";
import { PlayerLink, TeamLink, TournamentLink } from "@/lib/profileNav";
import { computeRecordBook, CATEGORY_LABEL, type RecordCategory, type RecordDef } from "@/lib/recordBook";
import { cn } from "@/lib/utils";
import { getRecentlyBroken } from "@/lib/recordWatcher";

const CATS = Object.keys(CATEGORY_LABEL) as RecordCategory[];

const Holder = ({ e }: { e: RecordDef["entries"][number] }) => (
  <span className="inline-flex items-center gap-1.5 min-w-0">
    {e.player ? (
      <PlayerLink name={e.player} className="font-semibold text-foreground truncate" avatarSize={22} />
    ) : e.team ? (
      <span className="inline-flex items-center gap-1.5 min-w-0">
        <TeamLogo teamName={e.team} size={20} />
        <TeamLink name={e.team} className="font-semibold text-foreground truncate" />
      </span>
    ) : (
      <span className="font-semibold text-foreground truncate">{e.context}</span>
    )}
  </span>
);

const RecordCard = ({ r, isNew }: { r: RecordDef; isNew?: boolean }) => {
  const [open, setOpen] = useState(false);
  const [first, ...rest] = r.entries;
  const ctx = first.player || first.team ? first.context : undefined;
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-3 relative overflow-hidden">
      <div className="absolute -top-8 -right-8 w-20 h-20 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-mono uppercase tracking-wide text-muted-foreground leading-tight">
          {r.title}
          {isNew && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-primary/20 text-primary text-2xs font-bold">NOWY</span>}
        </div>
        {r.desc && <span className="text-2xs font-mono text-muted-foreground/80 shrink-0">{r.desc}</span>}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Crown className="w-4 h-4 text-primary shrink-0" />
          <Holder e={first} />
        </div>
        <div className="text-xl font-heading font-bold text-primary shrink-0">{first.display}</div>
      </div>
      {(ctx || first.date) && (
        <div className="mt-1 text-xs text-muted-foreground truncate">
          {first.tournamentId && ctx ? (
            <TournamentLink tournamentId={first.tournamentId} matchId={first.matchId}>{ctx}</TournamentLink>
          ) : ctx}
          {first.date && <span className="font-mono"> · {first.date}</span>}
        </div>
      )}
      {rest.length > 0 && (
        <>
          <button
            onClick={() => setOpen(o => !o)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
            Top {r.entries.length}
          </button>
          {open && (
            <ol className="mt-2 divide-y divide-border/40 border-t border-border/40">
              {rest.map((e, i) => (
                <li key={i} className="flex items-start gap-2 py-1.5 text-sm">
                  <span className="w-4 pt-1 text-xs font-mono text-muted-foreground shrink-0">{i + 2}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 flex-1"><Holder e={e} /></span>
                      <span className="font-mono font-semibold text-foreground shrink-0 tabular-nums">{e.display}</span>
                    </div>
                    {(e.player || e.team) && e.context && (
                      <div className="mt-0.5 text-xs text-muted-foreground leading-snug break-words">
                        {e.tournamentId ? (
                          <TournamentLink tournamentId={e.tournamentId} matchId={e.matchId}>{e.context}</TournamentLink>
                        ) : e.context}
                        {e.date && <span className="font-mono"> · {e.date}</span>}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
};

const RecordBookPanel = () => {
  // Keep-alive: przelicz rekordy przy każdej zmianie danych i po sprawdzeniu rekordów.
  const [dataTick, setDataTick] = useState(0);
  useEffect(() => {
    const bump = () => setDataTick(t => t + 1);
    const events = ["records:update", "tournaments:update", "teams:update", "ranking:update", "transfers:update", "season:reset", "storage"];
    events.forEach(e => window.addEventListener(e, bump));
    return () => events.forEach(e => window.removeEventListener(e, bump));
  }, []);

  const records = useMemo(() => computeRecordBook(), [dataTick]);
  const recent = useMemo(() => getRecentlyBroken(), [dataTick]);
  const [cat, setCat] = useState<RecordCategory | "all">("all");
  const [q, setQ] = useState("");

  const filtered = records.filter(r => {
    if (cat !== "all" && r.category !== cat) return false;
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return r.title.toLowerCase().includes(s) ||
      r.entries.some(e => (e.player || "").toLowerCase().includes(s) || (e.team || "").toLowerCase().includes(s));
  });

  return (
    <section className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="flex items-center gap-2 text-lg font-heading font-bold text-foreground">
          <BookOpen className="w-5 h-5 text-primary" /> Księga Rekordów ACSR
          <span className="text-xs font-mono text-muted-foreground">({records.length})</span>
        </h3>
        <label className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Szukaj rekordu, gracza, drużyny…"
            className="pl-7 pr-2 py-1 text-sm rounded-md border border-border/60 bg-background/60 w-64 max-w-full"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(["all", ...CATS] as const).map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-mono border transition-colors",
              cat === c ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/30",
            )}
          >
            {c === "all" ? "Wszystkie" : CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      {records.length === 0 ? (
        <div className="rounded-xl border border-border/60 p-6 text-center text-sm text-muted-foreground">
          Brak rozegranych meczów w tym zapisie — rekordy pojawią się po pierwszych wynikach.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(r => <RecordCard key={r.id} r={r} isNew={recent.has(r.id)} />)}
        </div>
      )}
    </section>
  );
};

export default RecordBookPanel;
