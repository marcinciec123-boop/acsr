// History of year-end ceremonies with a season (year) filter.

import { useMemo, useState } from "react";
import { Trophy, Crown, Star, Zap, Flame, Award, Users, Target, ArrowRightLeft, Play, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import PanelHeader from "@/components/PanelHeader";
import YearAwardsCeremony from "@/components/YearAwardsCeremony";
import TeamLogo from "@/components/TeamLogo";
import { loadYearAwardsHistory, type YearAwards, type PlayerAward, type TeamAward } from "@/lib/yearAwards";

const Row = ({ icon, label, name, sub, value, children }: {
  icon: React.ReactNode; label: string; name?: string; sub?: string; value?: string; children?: React.ReactNode;
}) => (
  <div className="border-b border-border/60 last:border-0">
    <div className="flex items-center gap-3 py-2">
      <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-mono uppercase text-muted-foreground">{label}</div>
        <div className="text-sm font-heading font-bold text-foreground truncate">{name || "—"}</div>
        {sub && <div className="text-xs font-mono text-muted-foreground truncate">{sub}</div>}
      </div>
      {value && (
        <div className="text-lg font-heading font-black text-primary tabular-nums shrink-0">{value}</div>
      )}
    </div>
    {children}
  </div>
);

const ExpandableRow = ({ icon, label, name, sub, value, expanded, onToggle, children }: {
  icon: React.ReactNode; label: string; name?: string; sub?: string; value?: string;
  expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) => (
  <div className="border-b border-border/60 last:border-0">
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 py-2 text-left group"
      aria-expanded={expanded}
    >
      <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-mono uppercase text-muted-foreground">{label}</div>
        <div className="text-sm font-heading font-bold text-foreground truncate">{name || "—"}</div>
        {sub && <div className="text-xs font-mono text-muted-foreground truncate">{sub}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {value && (
          <div className="text-lg font-heading font-black text-primary tabular-nums">{value}</div>
        )}
        <div className={"p-1 rounded-md transition-colors " + (expanded ? "bg-primary/20 text-primary" : "text-muted-foreground group-hover:text-foreground")}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>
    </button>
    {expanded && (
      <div className="pb-3 pl-11 pr-2">
        {children}
      </div>
    )}
  </div>
);

const TeamTopList = ({ teams }: { teams?: TeamAward[] }) => {
  const list = teams || [];
  if (list.length === 0) return <div className="text-xs font-mono text-muted-foreground">Brak danych rankingu drużyn.</div>;
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/20 overflow-hidden">
      {list.map((t, i) => (
        <div key={t.team} className="flex items-center gap-3 px-3 py-2 border-b border-border/40 last:border-0 hover:bg-primary/5">
          <div className="w-6 text-center text-xs font-heading font-black text-muted-foreground tabular-nums">#{i + 1}</div>
          <TeamLogo teamName={t.team} size={22} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-heading font-bold text-foreground truncate">{t.team}</div>
            <div className="text-xs font-mono text-muted-foreground">{t.trophies}🏆 · {t.finals} finałów · {t.top3} top3</div>
          </div>
        </div>
      ))}
    </div>
  );
};

const PlayerTopList = ({ players }: { players?: PlayerAward[] }) => {
  const list = players || [];
  if (list.length === 0) return <div className="text-xs font-mono text-muted-foreground">Brak danych rankingu graczy.</div>;
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/20 overflow-hidden max-h-[260px] overflow-y-auto">
      {list.map((p, i) => (
        <div key={p.player} className="flex items-center gap-3 px-3 py-2 border-b border-border/40 last:border-0 hover:bg-primary/5">
          <div className="w-6 text-center text-xs font-heading font-black text-muted-foreground tabular-nums">#{i + 1}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-heading font-bold text-foreground truncate">{p.player}</div>
            <div className="text-xs font-mono text-muted-foreground truncate">{p.team}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-heading font-black text-primary tabular-nums">{p.rating.toFixed(2)}</div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground">{p.matches} mecz.</div>
          </div>
        </div>
      ))}
    </div>
  );
};

const AwardsHistoryPanel = () => {
  const history = loadYearAwardsHistory();
  const years = useMemo(
    () => Object.keys(history).map(Number).sort((a, b) => b - a),
    [history],
  );
  const [selectedYear, setSelectedYear] = useState<number | "all">(years[0] ?? "all");
  const [replayYear, setReplayYear] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (year: number, key: "team" | "player") => {
    const id = `${year}-${key}`;
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const visible: YearAwards[] = useMemo(() => {
    if (selectedYear === "all") return years.map(y => history[String(y)]);
    const a = history[String(selectedYear)];
    return a ? [a] : [];
  }, [selectedYear, years, history]);

  return (
    <div className="container mx-auto px-4 py-6">
      <PanelHeader
        icon={Trophy}
        title="Historia Ceremonii Nagród ACSR"
        meta={`${years.length} ${years.length === 1 ? "sezon" : "sezonów"} w archiwum`}
        actions={
          <div className="flex items-center gap-2">
            <label className="text-xs font-mono uppercase text-muted-foreground">Sezon</label>
            <select
              value={String(selectedYear)}
              onChange={(e) => setSelectedYear(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="bg-secondary/60 border border-border rounded-md px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:border-primary"
            >
              <option value="all">Wszystkie</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        }
      />

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <div className="text-sm font-mono text-muted-foreground">
            Brak ceremonii w archiwum. Ceremonia odpali się automatycznie 31 grudnia w fikcyjnym kalendarzu.
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {visible.map((a) => (
            <div key={a.year} className="rounded-xl border border-primary/25 bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-primary/15 to-transparent flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-mono uppercase text-muted-foreground">Sezon</div>
                  <div className="text-2xl font-heading font-black text-foreground leading-none">{a.year}</div>
                </div>
                <div className="text-right text-xs font-mono text-muted-foreground">
                  <div>{a.totalTournaments} turniejów</div>
                  <div>{a.totalMatches} meczów</div>
                </div>
                <button
                  onClick={() => setReplayYear(a.year)}
                  className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-mono font-black uppercase tracking-wider hover:bg-primary/90 flex items-center gap-1"
                  title="Odtwórz ceremonię"
                >
                  <Play className="w-3 h-3" /> Odtwórz
                </button>
              </div>

              <div className="p-4">
                <ExpandableRow
                  icon={<Crown className="w-4 h-4" />}
                  label="Drużyna Roku"
                  name={a.teamOfYear?.team}
                  sub={a.teamOfYear ? `${a.teamOfYear.trophies} trofeów · ${a.teamOfYear.top3} podium` : ""}
                  expanded={expanded.has(`${a.year}-team`)}
                  onToggle={() => toggle(a.year, "team")}
                >
                  <TeamTopList teams={a.teamTop5?.length ? a.teamTop5 : a.teamTop3} />
                </ExpandableRow>
                <ExpandableRow
                  icon={<Star className="w-4 h-4" />}
                  label="Gracz Roku"
                  name={a.playerOfYear?.player}
                  sub={a.playerOfYear?.team}
                  value={a.playerOfYear ? a.playerOfYear.rating.toFixed(2) : undefined}
                  expanded={expanded.has(`${a.year}-player`)}
                  onToggle={() => toggle(a.year, "player")}
                >
                  <PlayerTopList players={a.playerTop20?.length ? a.playerTop20 : a.playerTop5} />
                </ExpandableRow>
                <Row icon={<Zap className="w-4 h-4" />} label="Odkrycie Roku" name={a.rookieOfYear?.player}
                  sub={a.rookieOfYear?.team} value={a.rookieOfYear ? a.rookieOfYear.rating.toFixed(2) : undefined} />
                <Row icon={<Flame className="w-4 h-4" />} label="Top Fragger" name={a.topFragger?.player}
                  sub={a.topFragger?.team} value={a.topFragger ? a.topFragger.kills.toLocaleString() : undefined} />
                <Row icon={<Award className="w-4 h-4" />} label="Król MVP" name={a.mvpKing?.player}
                  sub={a.mvpKing?.team} value={a.mvpKing ? String(a.mvpKing.mvps) : undefined} />
                <Row icon={<Users className="w-4 h-4" />} label="Trener Roku" name={a.coachOfYear?.coach}
                  sub={a.coachOfYear?.team} value={a.coachOfYear ? String(a.coachOfYear.trophies) : undefined} />
                <Row icon={<Target className="w-4 h-4" />} label="Turniej Roku" name={a.tournamentOfYear?.name}
                  sub={a.tournamentOfYear ? `Tier ${a.tournamentOfYear.tier} · zw. ${a.tournamentOfYear.winner}` : ""} />
                <Row icon={<ArrowRightLeft className="w-4 h-4" />} label="Transfer Roku" name={a.transferOfYear?.player}
                  sub={a.transferOfYear ? `${a.transferOfYear.oldTeam || "—"} → ${a.transferOfYear.newTeam}` : ""}
                  value={a.transferOfYear ? a.transferOfYear.postRating.toFixed(2) : undefined} />
              </div>
            </div>
          ))}
        </div>
      )}

      {replayYear != null && (
        <YearAwardsCeremony forceYear={replayYear} onClose={() => setReplayYear(null)} />
      )}
    </div>
  );
};

export default AwardsHistoryPanel;
