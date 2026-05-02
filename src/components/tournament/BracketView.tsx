import { Trash2, Maximize2, ArrowUp, ArrowDown, Plus, Pencil, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState } from "react";
import type { MatchResult } from "@/lib/types";
import { getTeamFlag, isPlaceholder } from "@/lib/teamHelpers";

interface Props {
  matches: MatchResult[];
  onUpdate: (id: string, score1: number, score2: number, team1?: string, team2?: string, round?: string) => void;
  onDelete?: (id: string) => void;
  onMove?: (id: string, dir: -1 | 1) => void;
  onAdd?: (round: string) => void;
  onOpenMatch?: (id: string) => void;
  allTeams?: string[];
}

const TeamRow = ({
  name, score, isWinner, isFinal,
}: { name: string; score: number; isWinner: boolean; isFinal: boolean }) => {
  const placeholder = isPlaceholder(name);
  const flag = !placeholder ? getTeamFlag(name) : "";
  return (
    <div className={cn(
      "flex justify-between items-center px-3 py-2 transition-colors",
      isWinner && "bg-[hsl(var(--win))]/12",
      !isWinner && score >= 0 && "bg-card/60",
    )}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {isWinner && isFinal && <Crown className="w-3.5 h-3.5 text-[hsl(var(--gold))] shrink-0" />}
        {flag && <span className="text-base leading-none shrink-0">{flag}</span>}
        <span className={cn(
          "truncate text-[13px]",
          isWinner ? "font-bold text-foreground" : placeholder ? "text-muted-foreground italic" : "text-foreground/85"
        )}>
          {name || "TBD"}
        </span>
      </div>
      <span className={cn(
        "font-mono font-bold ml-2 text-sm tabular-nums",
        isWinner ? "text-[hsl(var(--win))]" : "text-muted-foreground/70"
      )}>
        {score}
      </span>
    </div>
  );
};

/** Liquipedia-style bracket with SVG connectors between rounds */
export const BracketView = ({ matches, onUpdate, onDelete, onMove, onAdd, onOpenMatch, allTeams = [] }: Props) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRoundFor, setEditingRoundFor] = useState<string | null>(null);

  const displayRoundName = (round?: string) => {
    const clean = (round || "Match").trim();
    return clean
      .replace(/\s+[—-]?\s*M(?:atch)?\s*\d+$/i, "")
      .replace(/\s+#\d+$/i, "")
      .trim() || "Match";
  };

  // Group by display round name preserving insertion order. Seeded imports may store
  // every match as "1ST ROUND M1", "1ST ROUND M2" etc.; visually that is one round.
  const groupedAll = matches.reduce<Record<string, MatchResult[]>>((acc, m) => {
    const key = displayRoundName(m.round);
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});
  const allRoundNames = Object.keys(groupedAll);

  // Separate "3rd place" / "third place" rounds — they don't belong in the main bracket flow
  const isThirdPlace = (round: string) => /3rd\s*place|third\s*place|bronze/i.test(round);
  const thirdPlaceRounds = allRoundNames.filter(isThirdPlace);
  const rounds = allRoundNames.filter(r => !isThirdPlace(r));
  const grouped = groupedAll;

  if (matches.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-muted-foreground font-mono mb-2">Brak meczów w drabince</p>
        {onAdd && (
          <Button size="sm" variant="outline" onClick={() => onAdd("Round 1")}>
            <Plus className="w-3 h-3 mr-1" /> Dodaj mecz
          </Button>
        )}
      </div>
    );
  }

  const isFinalRound = (idx: number) => idx === rounds.length - 1;
  const isLowerRound = (round: string) => /lower|low|losers/i.test(round);

  // Fixed dimensions so cards never clip and connector math stays stable.
  const MATCH_H = 92;
  const BASE_GAP = 14;
  const HEADER_H = 32;
  const gapForDepth = (depth: number) => BASE_GAP + (Math.pow(2, depth) - 1) * (MATCH_H + BASE_GAP);
  const offsetForDepth = (depth: number) => depth === 0 ? 0 : (Math.pow(2, depth - 1) * (MATCH_H + BASE_GAP)) - BASE_GAP / 2 - MATCH_H / 2;

  const looksLikePlayoffRound = (round: string, roundMatches: MatchResult[]) => {
    const lower = round.toLowerCase();
    return lower.includes("quarter")
      || lower.includes("semi")
      || lower === "final"
      || lower.includes("grand final")
      || roundMatches.every(m => /^UB-R\d+-M\d+$/i.test(m.bracketSlot || ""));
  };

  const feedsDirectlyIntoRound = (prevName: string, nextName: string, prevRound: MatchResult[], nextRound: MatchResult[]) => {
    if (prevRound.length !== nextRound.length * 2) return false;
    const nextIds = new Set(nextRound.map(m => m.id));
    const feedCount = prevRound.filter(m => (m.winnerTo && nextIds.has(m.winnerTo)) || (m.loserTo && nextIds.has(m.loserTo))).length;
    return feedCount === prevRound.length || (feedCount === 0 && looksLikePlayoffRound(prevName, prevRound) && looksLikePlayoffRound(nextName, nextRound));
  };

  const roundLayout = rounds.reduce<Record<string, { depth: number; showConnector: boolean }>>((acc, round, idx) => {
    const prevRound = idx > 0 ? rounds[idx - 1] : undefined;
    const showConnector = !!prevRound && feedsDirectlyIntoRound(prevRound, round, grouped[prevRound], grouped[round]);
    acc[round] = {
      depth: showConnector ? acc[prevRound!].depth + 1 : 0,
      showConnector,
    };
    return acc;
  }, {});

  const renderMatchCard = (m: MatchResult, isLast: boolean) => {
    const isEditing = editingId === m.id;
    const decided = m.score1 + m.score2 > 0 && m.score1 !== m.score2;
    const winner1 = decided && m.score1 > m.score2;
    const winner2 = decided && m.score2 > m.score1;
    const editingRound = editingRoundFor === m.id;
    return (
      <div
        key={m.id}
        style={!isEditing ? { height: MATCH_H } : undefined}
        className={cn(
          "border rounded-md overflow-hidden text-xs shadow-md bg-card/60 backdrop-blur-sm flex flex-col",
          isLast
            ? "border-[hsl(var(--gold))]/50 shadow-[0_0_16px_hsl(var(--gold)/0.18)]"
            : decided
              ? "border-primary/40"
              : "border-border/70"
        )}
      >
        <div className={cn(
          "px-2.5 py-1 text-[9px] font-mono uppercase tracking-[0.18em] flex items-center justify-between border-b shrink-0",
          isLast
            ? "bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/30"
            : "bg-secondary/40 text-muted-foreground border-border/50"
        )}>
          <span>BO{m.bo || 3}</span>
          {decided && <span className="text-[hsl(var(--win))]">✓</span>}
        </div>
        {isEditing ? (
          <div className="p-2 space-y-1.5 bg-card min-h-[128px]">
            {editingRound ? (
              <div className="flex gap-1 items-center">
                <Input
                  defaultValue={m.round || ""}
                  placeholder="Nazwa rundy..."
                  onBlur={e => {
                    onUpdate(m.id, m.score1, m.score2, undefined, undefined, e.target.value || "Match");
                    setEditingRoundFor(null);
                  }}
                  onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  autoFocus
                  className="h-7 text-[11px] font-mono"
                />
              </div>
            ) : (
              <button
                onClick={() => setEditingRoundFor(m.id)}
                className="text-[10px] font-mono text-muted-foreground hover:text-primary flex items-center gap-1 w-full"
              >
                <Pencil className="w-2.5 h-2.5" /> Runda: {m.round || "Match"}
              </button>
            )}
            <div className="flex gap-1 items-center">
              <select
                value={m.team1}
                onChange={e => onUpdate(m.id, m.score1, m.score2, e.target.value, m.team2)}
                className="flex-1 px-1.5 py-1 rounded bg-card border border-border text-[11px] font-mono"
              >
                <option value="">—</option>
                <option value="BYE">BYE</option>
                {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <Input type="number" min="0" value={m.score1}
                onChange={e => onUpdate(m.id, parseInt(e.target.value) || 0, m.score2)}
                className="w-12 h-7 text-center text-xs" />
            </div>
            <div className="flex gap-1 items-center">
              <select
                value={m.team2}
                onChange={e => onUpdate(m.id, m.score1, m.score2, m.team1, e.target.value)}
                className="flex-1 px-1.5 py-1 rounded bg-card border border-border text-[11px] font-mono"
              >
                <option value="">—</option>
                <option value="BYE">BYE</option>
                {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <Input type="number" min="0" value={m.score2}
                onChange={e => onUpdate(m.id, m.score1, parseInt(e.target.value) || 0)}
                className="w-12 h-7 text-center text-xs" />
            </div>
            <div className="flex gap-1 justify-end items-center flex-wrap">
              {onMove && (
                <>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onMove(m.id, -1)} title="W górę">
                    <ArrowUp className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onMove(m.id, 1)} title="W dół">
                    <ArrowDown className="w-3 h-3" />
                  </Button>
                </>
              )}
              {onOpenMatch && (
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-primary hover:text-primary"
                  onClick={() => onOpenMatch(m.id)}>
                  <Maximize2 className="w-3 h-3 mr-1" /> Otwórz
                </Button>
              )}
              {onDelete && (
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onDelete(m.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                onClick={() => { setEditingId(null); setEditingRoundFor(null); }}>
                OK
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => onOpenMatch ? onOpenMatch(m.id) : setEditingId(m.id)}
            onContextMenu={(e) => { e.preventDefault(); setEditingId(m.id); }}
            title={onOpenMatch ? "Klik: szczegóły meczu • PPM: szybka edycja" : "Klik: edytuj"}
            className="w-full text-left hover:brightness-110 transition-all flex-1 flex flex-col min-h-0"
          >
            <div className="flex-1 flex flex-col">
              <TeamRow name={m.team1} score={m.score1} isWinner={winner1} isFinal={isLast} />
              <div className="h-px bg-border/60" />
              <TeamRow name={m.team2} score={m.score2} isWinner={winner2} isFinal={isLast} />
            </div>
          </button>
        )}
      </div>
    );
  };

  const renderRoundHeader = (round: string, isLast: boolean, lower: boolean) => (
    <div className="flex items-center justify-between gap-1 px-1 h-6 mb-2">
      <h5 className={cn(
        "text-[10px] font-mono uppercase font-bold tracking-[0.15em] truncate",
        isLast ? "text-[hsl(var(--gold))]" : lower ? "text-destructive/80" : "text-primary"
      )}>
        {isLast && "★ "}{round}
      </h5>
      {onAdd && (
        <button onClick={() => onAdd(round)}
          className="text-muted-foreground hover:text-primary transition-colors p-0.5 rounded hover:bg-secondary/50"
          title="Dodaj mecz w tej rundzie">
          <Plus className="w-3 h-3" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto pb-3 px-1">
        <div className="flex items-start min-w-fit gap-0">
          {rounds.map((round, ri) => {
            const matchesInRound = grouped[round];
            const isLast = isFinalRound(ri);
            const lower = isLowerRound(round);
            const { depth, showConnector } = roundLayout[round];
            const gap = gapForDepth(depth);
            const offset = offsetForDepth(depth);

            return (
              <div key={round} className="flex items-start">
                {/* Connector column to PREVIOUS round */}
                {showConnector && (
                  <div
                    className="flex flex-col w-7 shrink-0"
                    style={{ paddingTop: HEADER_H + offsetForDepth(depth - 1) + MATCH_H / 2, gap: `${MATCH_H + gapForDepth(depth - 1)}px` }}
                  >
                    {Array.from({ length: matchesInRound.length }).map((_, i) => {
                      // Each connector spans from match (2i) center to match (2i+1) center in previous round
                      const span = MATCH_H + gapForDepth(depth - 1);
                      return (
                        <div
                          key={i}
                          style={{ height: span }}
                          className="border-l border-t border-b border-border/70 rounded-l-sm relative"
                        >
                          {/* horizontal stub into next match */}
                          <div className="absolute top-1/2 -right-0 w-[14px] h-px bg-border/70 -translate-y-1/2" />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Round column */}
                <div className="flex flex-col w-[260px] shrink-0">
                  {renderRoundHeader(round, isLast, lower)}
                  <div
                    className="flex flex-col"
                    style={{ paddingTop: offset, gap: `${gap}px` }}
                  >
                    {matchesInRound.map(m => renderMatchCard(m, isLast))}
                  </div>
                </div>
              </div>
            );
          })}

          {/* 3rd place — separate side panel, intentionally not part of the bracket flow */}
          {thirdPlaceRounds.length > 0 && (
            <div className="flex items-start ml-8 pl-8 border-l border-border/40">
              {thirdPlaceRounds.map((round) => (
                <div key={round} className="flex flex-col w-[260px] shrink-0">
                  {renderRoundHeader(round, false, false)}
                  <div
                    className="flex flex-col"
                    style={{ gap: `${BASE_GAP}px` }}
                  >
                    {grouped[round].map(m => renderMatchCard(m, false))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {onAdd && (
        <div className="flex gap-2 pt-2 border-t border-border/40">
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => {
              const name = prompt("Nazwa nowej rundy:", `Round ${rounds.length + 1}`);
              if (name) onAdd(name);
            }}
          >
            <Plus className="w-3 h-3 mr-1" /> Nowa runda
          </Button>
          <p className="text-[10px] font-mono text-muted-foreground self-center">
            💡 PPM na meczu = szybka edycja • Klik na rundzie + = dodaj mecz
          </p>
        </div>
      )}
    </div>
  );
};
