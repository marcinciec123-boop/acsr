// History of year-end ceremonies with a season (year) filter.

import { useMemo, useState } from "react";
import { Trophy, Crown, Star, Zap, Flame, Award, Users, Target, ArrowRightLeft, Play, Sparkles } from "lucide-react";
import PanelHeader from "@/components/PanelHeader";
import YearAwardsCeremony from "@/components/YearAwardsCeremony";
import { loadYearAwardsHistory, type YearAwards } from "@/lib/yearAwards";

const Row = ({ icon, label, name, sub, value }: {
  icon: React.ReactNode; label: string; name?: string; sub?: string; value?: string;
}) => (
  <div className="flex items-center gap-3 py-2 border-b border-border/60 last:border-0">
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
);

const AwardsHistoryPanel = () => {
  const history = loadYearAwardsHistory();
  const years = useMemo(
    () => Object.keys(history).map(Number).sort((a, b) => b - a),
    [history],
  );
  const [selectedYear, setSelectedYear] = useState<number | "all">(years[0] ?? "all");
  const [replayYear, setReplayYear] = useState<number | null>(null);

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
                <Row icon={<Crown className="w-4 h-4" />} label="Drużyna Roku" name={a.teamOfYear?.team}
                  sub={a.teamOfYear ? `${a.teamOfYear.trophies} trofeów · ${a.teamOfYear.top3} podium` : ""} />
                <Row icon={<Star className="w-4 h-4" />} label="Gracz Roku" name={a.playerOfYear?.player}
                  sub={a.playerOfYear?.team} value={a.playerOfYear ? a.playerOfYear.rating.toFixed(2) : undefined} />
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
