import { useState } from "react";
import { Info } from "lucide-react";
import { Portal } from "@radix-ui/react-hover-card";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import TeamLogo from "@/components/TeamLogo";
import { getDisplayScore } from "@/lib/matchDisplay";
import { isMapDecided, isMapUnplayed, isMatchDecided, isMatchInProgress } from "@/lib/matchStatus";
import { getMatchTimestamp } from "@/lib/matchTime";
import { isPlaceholder } from "@/lib/teamHelpers";
import { cn } from "@/lib/utils";
import type { MatchResult } from "@/lib/types";

/** Reads only the supplied match; artwork is loaded only while the preview is open. */
export default function MatchHoverPreview({ match }: { match: MatchResult }) {
  const [open, setOpen] = useState(false);
  const decided = isMatchDecided(match);
  const status = decided ? "Zakończony" : isMatchInProgress(match) ? "W trakcie" : "Zaplanowany";
  const [score1, score2] = getDisplayScore(match);
  const timestamp = getMatchTimestamp(match);
  const date = timestamp ? new Intl.DateTimeFormat("pl-PL", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(timestamp) : "Termin nieustalony";

  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={200} closeDelay={150}>
      <HoverCardTrigger asChild>
        <Button
          type="button" variant="ghost" size="icon"
          className="h-5 w-5 shrink-0 p-0 text-muted-foreground hover:text-primary [&_svg]:size-3"
          aria-label={`Podgląd meczu: ${match.team1 || "TBD"} — ${match.team2 || "TBD"}`}
          onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
          onClick={(event) => { event.stopPropagation(); setOpen(true); }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Info />
        </Button>
      </HoverCardTrigger>
      <Portal>
        <HoverCardContent
          side="right" align="start" sideOffset={10} collisionPadding={12}
          className="w-80 max-w-[calc(100vw-24px)] p-0 overflow-hidden"
          onClick={(event) => event.stopPropagation()}
          aria-label="Podgląd meczu"
        >
          <div className="border-b border-border bg-secondary/40 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-mono text-muted-foreground">BO{match.bo || 1}</span>
              <span className={cn("font-medium", decided ? "text-foreground" : "text-primary")}>{status}</span>
            </div>
            {match.round && <div className="mt-1 break-words text-sm font-semibold">{match.round}</div>}
            <div className="mt-1 text-xs text-muted-foreground">{date}</div>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-4">
            {[1, 2].map((side) => {
              const name = side === 1 ? match.team1 : match.team2;
              const winner = decided && (side === 1 ? match.score1 > match.score2 : match.score2 > match.score1);
              return (
                <div key={side} className={cn("flex min-w-0 flex-col items-center gap-2 text-center", side === 1 ? "col-start-1 row-start-1" : "col-start-3 row-start-1")}>
                  {!isPlaceholder(name) && name && <TeamLogo teamName={name} size={36} rounded="md" />}
                  <span className={cn("w-full break-words text-sm", winner ? "font-bold text-primary" : "font-medium")}>{name || "TBD"}</span>
                </div>
              );
            })}
            <span className="col-start-2 row-start-1 whitespace-nowrap font-mono text-xl font-bold tabular-nums">{score1} : {score2}</span>
          </div>
          {Boolean(match.maps?.length) && (
            <div className="border-t border-border">
              {match.maps?.map((map, index) => isMapUnplayed(match.maps || [], index, match.bo) ? (
                <div key={`${map.map}-${index}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border/50 px-3 py-2 text-muted-foreground last:border-0">
                  <span className="text-right font-mono text-sm">–</span>
                  <div className="text-center">
                    <div className="text-xs font-semibold line-through">{map.map || `Mapa ${index + 1}`}</div>
                    <div className="mt-0.5 text-xs">nie grano</div>
                  </div>
                  <span className="font-mono text-sm">–</span>
                </div>
              ) : (
                <div key={`${map.map}-${index}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border/50 px-3 py-2 last:border-0">
                  <span className={cn("text-right font-mono text-sm font-bold", isMapDecided(map) && map.score1 > map.score2 && "text-primary")}>{map.score1}</span>
                  <div className="text-center">
                    <div className="text-xs font-semibold">{map.map || `Mapa ${index + 1}`}</div>
                    {map.half1Score1 !== undefined && map.half1Score2 !== undefined && (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {map.team1StartSide ? `${map.team1StartSide} / ${map.team1StartSide === "T" ? "CT" : "T"} · ` : "1. połowa · "}
                        {map.half1Score1} : {map.half1Score2}
                      </div>
                    )}
                  </div>
                  <span className={cn("font-mono text-sm font-bold", isMapDecided(map) && map.score2 > map.score1 && "text-primary")}>{map.score2}</span>
                </div>
              ))}
            </div>
          )}
          {Boolean(match.veto?.length) && (
            <div className="border-t border-border px-3 py-2">
              <div className="mb-1 text-xs font-semibold text-muted-foreground">Veto</div>
              <ol className="space-y-1 text-xs">
                {match.veto?.map((entry, index) => (
                  <li key={`${index}-${entry.map}`} className="break-words">
                    <span className="text-muted-foreground">{index + 1}. </span>
                    {entry.action === "decider" ? "Decydująca mapa" : `${entry.team === 1 ? match.team1 : entry.team === 2 ? match.team2 : "—"} ${entry.action === "ban" ? "banuje" : "wybiera"}`}
                    {" · "}<span className={cn("font-medium", entry.action === "ban" && "text-muted-foreground")}>{entry.map}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </HoverCardContent>
      </Portal>
    </HoverCard>
  );
}