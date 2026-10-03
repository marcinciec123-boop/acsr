import { useMemo, useState } from "react";
import { Medal, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlayerLink, TeamLink, TournamentLink } from "@/lib/profileNav";
import { canonicalTeamName } from "@/lib/teamRenames";
import { historicMajors, isMajorName } from "@/lib/majors";
import { loadFromStorage } from "@/lib/storage";
import type { MatchResult, TournamentData } from "@/lib/types";
import "./TrophyCabinet.css";

export interface CabinetEntry {
  tournamentId: string;
  name: string;
  team: string;
  placement: number;
  date?: string;
  tier?: string;
  historic?: boolean;
}

const hash = (value: string) => {
  let h = 2166136261;
  for (const char of value.toLowerCase()) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
};

// A tournament keeps its trophy across all profiles, seasons and placements.
export const trophyVariant = (name: string) => isMajorName(name) ? 0 : 1 + hash(name) % 15;

function finalMatch(tournament: TournamentData): MatchResult | undefined {
  const phases = tournament.phases || [];
  const last = phases[phases.length - 1];
  const candidates = last?.bracket || last?.groups?.flatMap(g => g.matches) || tournament.matches || [];
  return candidates.filter(m => m.score1 !== m.score2 && m.score1 + m.score2 > 0 &&
    (/grand final|^final$|finał/i.test(m.round || "") || m.bracketSlot === "GF"))
    .at(-1);
}

export function TrophyCabinet({ entries, title = "Gablota trofeów" }: { entries: CabinetEntry[]; title?: string }) {
  const [selected, setSelected] = useState<CabinetEntry | null>(null);
  const wins = entries.filter(e => e.placement === 1).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const other = entries.filter(e => e.placement !== 1).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const tournaments = useMemo(() => loadFromStorage<TournamentData[]>("tournaments_data", []), []);
  const tournament = selected && !selected.historic ? tournaments.find(t => t.id === selected.tournamentId) : undefined;
  const historic = selected?.historic ? historicMajors.find(h => h.id === selected.tournamentId) : undefined;
  const final = tournament ? finalMatch(tournament) : undefined;
  const isTeam1 = final && selected && canonicalTeamName(final.team1) === canonicalTeamName(selected.team);
  const isTeam2 = final && selected && canonicalTeamName(final.team2) === canonicalTeamName(selected.team);
  const opponent = final && (isTeam1 || isTeam2) ? (isTeam1 ? final.team2 : final.team1) : undefined;
  const score = final && opponent ? `${isTeam1 ? final.score1 : final.score2}:${isTeam1 ? final.score2 : final.score1}` : undefined;
  const players = historic?.roster || (final?.maps?.flatMap(map => isTeam1 ? map.team1Players || [] : isTeam2 ? map.team2Players || [] : []).map(p => p.playerName) || []);
  const lineup = [...new Set(players)];

  return (
    <section className="trophy-cabinet" aria-label={title}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="font-heading font-bold text-xl text-foreground flex items-center gap-2"><Trophy className="w-5 h-5 text-accent" />{title}</h2>
        <span className="text-xs font-mono text-muted-foreground">{wins.length} zwycięstw · {other.length} pozostałych miejsc</span>
      </div>
      {wins.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {wins.map(entry => (
            <Button key={entry.tournamentId} type="button" variant="ghost" onClick={() => setSelected(entry)}
              className="trophy-tile group flex-col h-auto min-h-[198px] w-full whitespace-normal text-left items-stretch justify-start p-0 overflow-hidden border border-border bg-card hover:bg-secondary/30 hover:border-accent/50 focus-visible:ring-accent">
              <span className="trophy-stage" aria-hidden="true"><span className={`trophy-art trophy-art-${trophyVariant(entry.name)}`} /></span>
              <span className="flex flex-col gap-1 px-3 pb-3 w-full min-w-0">
                <span className="flex items-center gap-2 text-xs font-mono text-accent uppercase">{isMajorName(entry.name) ? "Major" : `Tier ${entry.tier || "—"}`} <span className="ml-auto text-muted-foreground">{entry.date?.slice(0, 4) || "—"}</span></span>
                <span className="block text-sm font-heading font-bold text-foreground leading-tight line-clamp-2 break-words">{entry.name}</span>
                <span className="block text-xs text-muted-foreground truncate">{entry.team}</span>
              </span>
            </Button>
          ))}
        </div>
      ) : <p className="text-sm text-muted-foreground py-6">Brak zdobytych pucharów.</p>}
      {other.length > 0 && (
        <div className="mt-6 border-t border-border pt-4">
          <h3 className="text-xs font-mono uppercase text-muted-foreground mb-3 flex items-center gap-2"><Medal className="w-4 h-4" />Pozostałe osiągnięcia</h3>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {other.map(entry => <div key={entry.tournamentId} className="min-w-0 flex items-start gap-3 border-b border-border/50 py-2 text-sm">
              <span className="shrink-0 font-mono text-accent">#{entry.placement}</span>
              <span className="min-w-0 flex-1"><TournamentLink tournamentId={entry.tournamentId} className="font-heading font-semibold text-foreground break-words">{entry.name}</TournamentLink><span className="block text-xs text-muted-foreground">{entry.team} · {entry.date?.slice(0, 10) || "—"}</span></span>
            </div>)}
          </div>
        </div>
      )}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {selected && <>
            <DialogHeader>
              <span className="trophy-stage trophy-stage-large" aria-hidden="true"><span className={`trophy-art trophy-art-${trophyVariant(selected.name)}`} /></span>
              <DialogTitle className="font-heading text-xl text-foreground leading-tight pr-4">{selected.name}</DialogTitle>
              <DialogDescription>{selected.date?.slice(0, 10) || "—"} · {isMajorName(selected.name) ? "Major" : selected.tier ? `Tier ${selected.tier}` : "Turniej"} · 1. miejsce</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm border-t border-border pt-4">
              <p className="text-muted-foreground">Mistrz: <TeamLink name={canonicalTeamName(selected.team)} className="font-bold text-foreground">{selected.team}</TeamLink></p>
              {opponent && <p className="text-muted-foreground">Finał: <strong className="text-foreground font-mono">{score}</strong> vs <TeamLink name={canonicalTeamName(opponent)} className="font-bold text-foreground">{opponent}</TeamLink></p>}
              {lineup.length > 0 && <div><p className="text-xs uppercase font-mono text-muted-foreground mb-2">Skład finałowy</p><div className="flex flex-wrap gap-2">{lineup.map(p => <PlayerLink key={p} name={p} className="text-foreground text-xs" />)}</div></div>}
              {tournament?.awards?.mvp && <p className="text-muted-foreground">MVP: <PlayerLink name={tournament.awards.mvp} className="font-bold text-accent" /></p>}
              {!selected.historic && <p className="pt-2"><TournamentLink tournamentId={selected.tournamentId} className="text-primary font-semibold">Otwórz turniej →</TournamentLink></p>}
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </section>
  );
}
