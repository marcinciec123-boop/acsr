// ===== Widgety aktualności: baner okładki, karty meczu/gracza, sonda, nastroje =====

import { useMemo, useState } from "react";
import { BarChart3, Flame, Snowflake } from "lucide-react";
import TeamLogo from "@/components/TeamLogo";
import { cn } from "@/lib/utils";
import type { NewsCover, NewsEmbed, NewsPoll } from "@/lib/newsExtras";
import { findMatch, getMyVote, getPostHype, matchMvp, setMyVote } from "@/lib/newsExtras";
import { computeCareerStats } from "@/lib/playerCareerStats";
import { playerRoles } from "@/data/playerRoles";
import { loadAllTeams } from "@/lib/teamManagement";
import { openPlayerProfile, openTeamProfile } from "@/lib/profileNav";

export const CoverBanner = ({ cover }: { cover: NewsCover }) => (
  <div className="relative overflow-hidden rounded-md border border-border mb-3 h-36 sm:h-44 bg-gradient-to-br from-primary/25 via-card to-accent/20">
    <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--primary)/0.5),transparent_55%),radial-gradient(circle_at_70%_50%,hsl(var(--accent)/0.45),transparent_55%)]" />
    <div className="relative h-full flex items-center justify-center gap-6 sm:gap-10 px-4">
      <div className="flex flex-col items-center gap-1.5 min-w-0">
        <TeamLogo teamName={cover.teamA} size={64} rounded="xl" />
        <span className="text-xs sm:text-sm font-heading font-bold text-foreground truncate max-w-[120px]">{cover.teamA}</span>
      </div>
      {cover.teamB && (
        <>
          <span className="font-heading font-black text-2xl sm:text-3xl text-primary tracking-widest">VS</span>
          <div className="flex flex-col items-center gap-1.5 min-w-0">
            <TeamLogo teamName={cover.teamB} size={64} rounded="xl" />
            <span className="text-xs sm:text-sm font-heading font-bold text-foreground truncate max-w-[120px]">{cover.teamB}</span>
          </div>
        </>
      )}
    </div>
    {cover.label && (
      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-background/80 border border-primary/40 text-xs font-mono font-bold text-primary uppercase tracking-wider">
        {cover.label}
      </span>
    )}
  </div>
);

const MatchCard = ({ tournamentId, matchId }: { tournamentId: string; matchId: string }) => {
  const ref = useMemo(() => findMatch(tournamentId, matchId), [tournamentId, matchId]);
  if (!ref) return null;
  const m = ref.match;
  const mvp = matchMvp(m);
  const w1 = m.score1 > m.score2;
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-2.5 min-w-[240px] flex-1">
      <div className="text-xs font-mono text-muted-foreground mb-1.5 truncate">
        {ref.tournamentName}{m.round ? ` · ${m.round}` : ""}
      </div>
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 min-w-0 flex-1" onClick={() => openTeamProfile(m.team1)}>
          <TeamLogo teamName={m.team1} size={22} />
          <span className={cn("text-sm font-bold truncate", w1 ? "text-foreground" : "text-muted-foreground")}>{m.team1}</span>
        </button>
        <span className="font-mono font-bold text-sm">
          <span className={w1 ? "text-emerald-400" : "text-red-400"}>{m.score1}</span>
          <span className="text-muted-foreground">:</span>
          <span className={!w1 ? "text-emerald-400" : "text-red-400"}>{m.score2}</span>
        </span>
        <button className="flex items-center gap-1.5 min-w-0 flex-1 justify-end" onClick={() => openTeamProfile(m.team2)}>
          <span className={cn("text-sm font-bold truncate", !w1 ? "text-foreground" : "text-muted-foreground")}>{m.team2}</span>
          <TeamLogo teamName={m.team2} size={22} />
        </button>
      </div>
      {(m.maps?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {m.maps!.map((mp, i) => (
            <span key={i} className="text-xs font-mono px-1.5 py-0.5 rounded bg-background/60 text-muted-foreground">
              {mp.map} {mp.score1}:{mp.score2}
            </span>
          ))}
        </div>
      )}
      {mvp && (
        <div className="text-xs font-mono text-muted-foreground mt-1.5">
          MVP: <button className="text-primary hover:underline" onClick={() => openPlayerProfile(mvp.name)}>{mvp.name}</button> · {mvp.rating.toFixed(2)}
        </div>
      )}
    </div>
  );
};

const PlayerCard = ({ name }: { name: string }) => {
  const data = useMemo(() => {
    let rating = 0, maps = 0, adr = 0;
    try {
      const cs = computeCareerStats(name);
      rating = cs.careerRating; maps = cs.mapsPlayed; adr = cs.avgAdr;
    } catch { /* brak danych */ }
    const team = loadAllTeams().find(t => t.roster.some(r => r?.toLowerCase() === name.toLowerCase()))?.name;
    return { rating, maps, adr, team };
  }, [name]);
  const role = playerRoles[name];
  return (
    <button
      onClick={() => openPlayerProfile(name)}
      className="rounded-md border border-border bg-secondary/30 p-2.5 min-w-[200px] flex-1 flex items-center gap-2.5 text-left hover:border-primary/50 transition-colors"
    >
      {data.team ? <TeamLogo teamName={data.team} size={34} /> : <span className="w-[34px] h-[34px] rounded bg-muted" />}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-foreground truncate">{name}</div>
        <div className="text-xs font-mono text-muted-foreground truncate">{data.team || "Wolny agent"}{role ? ` · ${role}` : ""}</div>
      </div>
      <div className="text-right">
        <div className={cn("text-lg font-heading font-black leading-none",
          data.rating >= 1.16 ? "text-emerald-400" : data.rating >= 1.05 ? "text-lime-400" : data.rating >= 0.96 ? "text-foreground" : "text-red-400")}>
          {data.maps ? data.rating.toFixed(2) : "—"}
        </div>
        <div className="text-xs font-mono text-muted-foreground">{data.maps ? `${data.maps} map · ADR ${data.adr.toFixed(0)}` : "brak map"}</div>
      </div>
    </button>
  );
};

export const EmbedCards = ({ embeds }: { embeds: NewsEmbed[] }) => (
  <div className="flex flex-wrap gap-2 mb-3">
    {embeds.map((e, i) =>
      e.kind === "match"
        ? <MatchCard key={i} tournamentId={e.tournamentId} matchId={e.matchId} />
        : <PlayerCard key={i} name={e.name} />,
    )}
  </div>
);

export const PollBox = ({ postId, poll }: { postId: string; poll: NewsPoll }) => {
  const [mine, setMine] = useState<number | null>(() => getMyVote(postId));
  const votes = poll.votes.map((v, i) => v + (mine === i ? 1 : 0));
  const total = votes.reduce((a, b) => a + b, 0) || 1;
  const max = Math.max(...votes);
  const vote = (i: number) => {
    const next = mine === i ? null : i;
    setMine(next);
    setMyVote(postId, next);
  };
  return (
    <div className="rounded-md border border-border bg-secondary/20 p-3 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        <span className="text-sm font-bold text-foreground">{poll.question}</span>
      </div>
      <div className="space-y-1.5">
        {poll.options.map((o, i) => {
          const pct = Math.round((votes[i] / total) * 100);
          return (
            <button
              key={i}
              onClick={() => vote(i)}
              className={cn(
                "relative w-full overflow-hidden rounded border text-left px-2.5 py-1.5 transition-colors",
                mine === i ? "border-primary" : "border-border hover:border-primary/50",
              )}
            >
              <span
                className={cn("absolute inset-y-0 left-0", votes[i] === max ? "bg-primary/25" : "bg-muted/60")}
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex justify-between text-xs font-mono">
                <span className="text-foreground">{mine === i ? "✓ " : ""}{o}</span>
                <span className="text-muted-foreground">{pct}%</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="text-xs font-mono text-muted-foreground mt-1.5">{total.toLocaleString("pl-PL")} głosów</div>
    </div>
  );
};

export const SentimentBar = ({ postId, category, version }: { postId: string; category?: string; version?: number }) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const hype = useMemo(() => getPostHype(postId, category), [postId, category, version]);
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs font-mono mb-1">
        <span className="inline-flex items-center gap-1 text-primary"><Flame className="w-3 h-3" /> Hype {hype}%</span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">Sceptycyzm {100 - hype}% <Snowflake className="w-3 h-3" /></span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
        <span className="bg-primary h-full" style={{ width: `${hype}%` }} />
      </div>
    </div>
  );
};
