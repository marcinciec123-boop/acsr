// ===== Galeria Sław (Hall of Fame) =====
// Pamiątkowe tablice zawodników na sportowej emeryturze — wszystko liczone
// z zapisu: trofea, wyróżnienia z Ceremonii Nagród ACSR, mecze, kluby, zarobki.
import { useEffect, useMemo, useState } from "react";
import { Landmark, Trophy, Crown, Star } from "lucide-react";
import PlayerAvatar from "@/components/PlayerAvatar";
import AccoladeBadges from "@/components/AccoladeBadges";
import { PlayerLink, TeamLink } from "@/lib/profileNav";
import { loadRetiredPlayers } from "@/lib/retiredPlayers";
import { computeCareerStats } from "@/lib/playerCareerStats";
import { buildPlayerTeamHistory } from "@/lib/playerTeamHistory";
import { getPlayerAccolades } from "@/lib/awardAccolades";
import { getPlayerEarnings } from "@/lib/statsPortal";
import { formatMoney } from "@/lib/prizeDistribution";
import { isMajorName, historicMajorsForPlayer } from "@/lib/majors";

const yr = (d: string | null) => (d ? d.slice(0, 4) : "?");

const HallOfFamePanel = () => {
  const [retired, setRetired] = useState<string[]>(() => loadRetiredPlayers());
  useEffect(() => {
    const sync = () => setRetired(loadRetiredPlayers());
    window.addEventListener("teams:update", sync);
    return () => window.removeEventListener("teams:update", sync);
  }, []);

  const plaques = useMemo(() => retired.map(name => {
    const career = computeCareerStats(name);
    const stints = buildPlayerTeamHistory(name).filter(s => !s.coach);
    const accolades = getPlayerAccolades(name);
    const earnings = getPlayerEarnings(name).earnings;
    const wins = career.trophies.filter(t => t.placement === 1);
    const majors = wins.filter(t => isMajorName(t.tournamentName)).length + historicMajorsForPlayer(name).length;
    const bestTop = accolades.filter(a => a.rank).sort((a, b) => a.rank! - b.rank!)[0];
    const lastTeam = [...stints].sort((a, b) => (b.to || "9").localeCompare(a.to || "9"))[0]?.team;
    const score = majors * 100 + wins.length * 20 + accolades.length * 15 + career.matchesPlayed;
    return { name, career, stints, accolades, earnings, wins, majors, bestTop, lastTeam, score };
  }).sort((a, b) => b.score - a.score), [retired]);

  if (!plaques.length) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/60 p-10 text-center">
        <Landmark className="w-10 h-10 text-primary mx-auto mb-3" />
        <p className="font-heading font-bold text-foreground">Galeria Sław jest pusta</p>
        <p className="text-sm text-muted-foreground mt-1">Gracze trafią tu po przejściu na sportową emeryturę.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {plaques.map(p => (
        <div key={p.name} className="relative overflow-hidden rounded-xl border border-[hsl(var(--gold))]/40 bg-gradient-to-br from-[hsl(var(--gold))]/10 via-card/70 to-card/40">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-[hsl(var(--gold))]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex gap-4 p-4">
            <div className="w-24 h-28 shrink-0 rounded-lg overflow-hidden border border-[hsl(var(--gold))]/40">
              <PlayerAvatar playerName={p.name} teamName={p.lastTeam} fill rounded="none" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-[hsl(var(--gold))]" />
                <PlayerLink name={p.name} className="text-xl font-heading font-bold text-foreground" />
              </div>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                {p.stints.length ? `${yr(p.stints[p.stints.length - 1]?.from ?? null)} – ${yr(p.stints[0]?.to ?? null)}` : "Legenda ACSR"}
                {p.bestTop && ` · najlepiej #${p.bestTop.rank} gracz roku`}
              </p>
              <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                {[
                  ["Trofea", p.wins.length],
                  ["Majory", p.majors],
                  ["Mecze", p.career.matchesPlayed],
                  ["Rating", p.career.mapsPlayed ? p.career.careerRating.toFixed(2) : "—"],
                ].map(([l, v]) => (
                  <div key={l as string} className="rounded-md bg-background/40 border border-border/50 py-1.5">
                    <div className="text-base font-heading font-bold text-foreground">{v}</div>
                    <div className="text-2xs font-mono uppercase text-muted-foreground">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="relative px-4 pb-4 space-y-2.5">
            {p.accolades.length > 0 && <AccoladeBadges accolades={p.accolades} />}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-mono text-muted-foreground">
              <span><Star className="inline w-3 h-3 mr-1 text-primary" />{p.career.totalKills} zabójstw</span>
              <span>{p.career.mapsPlayed} map</span>
              <span>{p.career.wins}W / {p.career.losses}L</span>
              {p.earnings > 0 && <span>{formatMoney(p.earnings)}</span>}
            </div>
            {p.wins.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {p.wins.slice(0, 8).map(t => (
                  <span key={t.tournamentId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[hsl(var(--gold))]/40 text-xs text-foreground">
                    <Trophy className="w-3 h-3 text-[hsl(var(--gold))]" />{t.tournamentName}
                  </span>
                ))}
                {p.wins.length > 8 && <span className="text-xs text-muted-foreground">+{p.wins.length - 8}</span>}
              </div>
            )}
            {p.stints.length > 0 && (
              <div className="text-xs text-muted-foreground">
                Kluby:{" "}
                {p.stints.map((s, i) => (
                  <span key={`${s.team}-${i}`}>
                    {i > 0 && " · "}
                    <TeamLink name={s.team} className="text-foreground" /> ({yr(s.from)}–{s.current ? "" : yr(s.to)})
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default HallOfFamePanel;
