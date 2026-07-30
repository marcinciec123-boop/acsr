import { Trash2, Maximize2, ArrowUp, ArrowDown, Plus, Pencil, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useScrollRestore } from "@/lib/uiPrefs";
import type { MatchResult } from "@/lib/types";
import { isPlaceholder } from "@/lib/teamHelpers";
import TeamLogo from "@/components/TeamLogo";
import { getDisplayScore } from "@/lib/matchDisplay";

import MatchPredictionBadge from "./MatchPredictionBadge";

interface Props {
  matches: MatchResult[];
  /** Tournament tier for VRS predictions. */
  tier?: string;
  onUpdate: (id: string, score1: number, score2: number, team1?: string, team2?: string, round?: string) => void;
  onDelete?: (id: string) => void;
  onMove?: (id: string, dir: -1 | 1) => void;
  onAdd?: (round: string) => void;
  onOpenMatch?: (id: string) => void;
  allTeams?: string[];
  /** Stable key used to remember the horizontal pan position of the bracket. */
  scrollKey?: string;
}

const TeamRow = ({
  name, score, isWinner, isFinal,
}: { name: string; score: number; isWinner: boolean; isFinal: boolean }) => {
  const placeholder = isPlaceholder(name);
  return (
    <div className={cn(
      "flex justify-between items-center px-3 py-2 transition-colors",
      isWinner && "bg-[hsl(var(--win))]/12",
      !isWinner && score >= 0 && "bg-card/60",
    )}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {isWinner && isFinal && <Crown className="w-3.5 h-3.5 text-[hsl(var(--gold))] shrink-0" />}
        {!placeholder && <TeamLogo teamName={name} size={22} rounded="md" />}
        <TeamLink
          name={placeholder ? undefined : name}
          className={cn(
            "truncate text-[13px]",
            isWinner ? "font-bold text-foreground" : placeholder ? "text-muted-foreground italic" : "text-foreground/85"
          )}
        >
          {name || "TBD"}
        </TeamLink>

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
export const BracketView = ({ matches, tier, onUpdate, onDelete, onMove, onAdd, onOpenMatch, allTeams = [], scrollKey }: Props) => {
  const panRef = useScrollRestore<HTMLDivElement>(`bracket_${scrollKey || matches[0]?.id || "default"}`);
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
  const nonThirdRounds = allRoundNames.filter(r => !isThirdPlace(r));
  const grouped = groupedAll;

  // === Detect double-elim structure by bracket slots ===
  // Upper row: UB-* rounds + GF (Grand Final). Lower row: LB-* rounds.
  const roundKind = (r: string): "upper" | "lower" | "other" => {
    const ms = grouped[r] || [];
    if (ms.length === 0) return "other";
    if (ms.every(m => /^LB-/i.test(m.bracketSlot || ""))) return "lower";
    if (ms.every(m => /^UB-/i.test(m.bracketSlot || "") || (m.bracketSlot || "") === "GF")) return "upper";
    return "other";
  };
  const upperRounds = nonThirdRounds.filter(r => roundKind(r) === "upper");
  const lowerRounds = nonThirdRounds.filter(r => roundKind(r) === "lower");
  const otherRounds = nonThirdRounds.filter(r => roundKind(r) === "other");
  const isDoubleElim = upperRounds.length > 0 && lowerRounds.length > 0;
  const rounds = isDoubleElim ? upperRounds : nonThirdRounds;

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

  const isLowerRound = (round: string) => /lower|low|losers/i.test(round);

  // Fixed dimensions so cards never clip and connector math stays stable.
  const MATCH_H = 112;
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

  const buildLayout = (list: string[]) => list.reduce<Record<string, { depth: number; showConnector: boolean }>>((acc, round, idx) => {
    const prevRound = idx > 0 ? list[idx - 1] : undefined;
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
    const showPrediction = !decided && !isEditing && m.team1 && m.team2 && m.team2 !== "BYE";
    return (
      <div
        key={m.id}
        style={!isEditing ? { height: MATCH_H } : undefined}
        className="relative group text-xs flex flex-col"
      >
        <div className={cn(
          "border rounded-md shadow-md bg-card/60 backdrop-blur-sm flex flex-col flex-1",
          isLast
            ? "border-[hsl(var(--gold))]/50 shadow-[0_0_16px_hsl(var(--gold)/0.18)]"
            : decided
              ? "border-primary/40"
              : "border-border/70"
        )}>
          <div className={cn(
            "px-2.5 py-1 text-xs font-mono uppercase tracking-[0.18em] flex items-center justify-between border-b shrink-0",
            isLast
              ? "bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/30"
              : "bg-secondary/40 text-muted-foreground border-border/50"
          )}>
            <span>BO{m.bo || 3}</span>
            {decided && <span className="text-[hsl(var(--win))]">✓</span>}
          </div>
          {showPrediction && (
            <div className="absolute top-full left-0 right-0 z-20 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity rounded-b-md border border-t-0 border-primary/40 bg-card shadow-lg overflow-hidden">
              <MatchPredictionBadge team1={m.team1} team2={m.team2} tier={tier || "B"} />
            </div>
          )}
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
                  className="h-7 text-xs font-mono"
                />
              </div>
            ) : (
              <button
                onClick={() => setEditingRoundFor(m.id)}
                className="text-xs font-mono text-muted-foreground hover:text-primary flex items-center gap-1 w-full"
              >
                <Pencil className="w-2.5 h-2.5" /> Runda: {m.round || "Match"}
              </button>
            )}
            <div className="flex gap-1 items-center">
              <select
                value={m.team1}
                onChange={e => onUpdate(m.id, m.score1, m.score2, e.target.value, m.team2)}
                className="flex-1 px-1.5 py-1 rounded bg-card border border-border text-xs font-mono"
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
                className="flex-1 px-1.5 py-1 rounded bg-card border border-border text-xs font-mono"
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
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-primary hover:text-primary"
                  onClick={() => onOpenMatch(m.id)}>
                  <Maximize2 className="w-3 h-3 mr-1" /> Otwórz
                </Button>
              )}
              {onDelete && (
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onDelete(m.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
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
              {(() => { const [d1, d2] = getDisplayScore(m); return (<>
              <TeamRow name={m.team1} score={d1} isWinner={winner1} isFinal={isLast} />
              <div className="h-px bg-border/60" />
              <TeamRow name={m.team2} score={d2} isWinner={winner2} isFinal={isLast} />
              </>); })()}
            </div>
          </button>
        )}
        </div>
      </div>
    );
  };

  const renderRoundHeader = (round: string, isLast: boolean, lower: boolean) => (
    <div className="flex items-center justify-between gap-1 px-1 h-6 mb-2">
      <h5 className={cn(
        "text-xs font-mono uppercase font-bold tracking-[0.15em] truncate",
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

  /** Keep matches on their original bracket slot so deleting one doesn't shift the rest up. */
  const positionMatches = (list: MatchResult[]) => {
    const used = new Set<number>();
    const placed = list.map((m, i) => {
      const mm = /-M(\d+)$/i.exec(m.bracketSlot || "");
      let idx = mm ? parseInt(mm[1], 10) - 1 : i;
      if (idx < 0) idx = i;
      while (used.has(idx)) idx++;
      used.add(idx);
      return { m, idx };
    });
    const slotCount = placed.length ? Math.max(...placed.map(p => p.idx)) + 1 : 0;
    const bySlot = new Map(placed.map(p => [p.idx, p.m]));
    return { slotCount, bySlot };
  };

  const renderRoundRow = (list: string[], goldLastRound: boolean, forceLowerStyle = false) => {
    const layout = buildLayout(list);
    return (
      <div className="flex items-start justify-center min-w-fit gap-0 mx-auto">
        {list.map((round, ri) => {
          const matchesInRound = grouped[round];
          const { slotCount, bySlot } = positionMatches(matchesInRound);
          const isLast = goldLastRound && ri === list.length - 1;
          const lower = forceLowerStyle || isLowerRound(round);
          const { depth, showConnector } = layout[round];
          const gap = gapForDepth(depth);
          const offset = offsetForDepth(depth);
          return (
            <div key={round} className="flex items-start">
              {showConnector && (
                <div
                  className="flex flex-col w-10 shrink-0"
                  style={{ paddingTop: HEADER_H + offsetForDepth(depth - 1) + MATCH_H / 2, gap: `${MATCH_H + gapForDepth(depth - 1)}px` }}
                >
                  {Array.from({ length: slotCount }).map((_, i) => {
                    const span = MATCH_H + gapForDepth(depth - 1);
                    if (!bySlot.has(i)) return <div key={i} style={{ height: span }} />;
                    return (
                      <div key={i} className="relative" style={{ height: span }}>
                        <div className="absolute left-0 top-0 w-3 h-px bg-primary/50" />
                        <div className="absolute left-0 bottom-0 w-3 h-px bg-primary/50" />
                        <div className="absolute left-3 top-0 bottom-0 w-px bg-primary/50" />
                        <div className="absolute left-3 top-1/2 right-0 h-px bg-primary/50 -translate-y-px" />
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex flex-col w-[260px] shrink-0">
                {renderRoundHeader(round, isLast, lower)}
                <div className="flex flex-col" style={{ paddingTop: offset, gap: `${gap}px` }}>
                  {Array.from({ length: slotCount }).map((_, i) => {
                    const m = bySlot.get(i);
                    return m
                      ? renderMatchCard(m, isLast)
                      : <div key={`empty-${i}`} style={{ height: MATCH_H }} aria-hidden />;
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };


  return (
    <div className="space-y-6">
      <div ref={panRef} className="overflow-x-auto pb-3 px-1">
        {isDoubleElim ? (
          <div className="space-y-8">
            <div>
              <div className="text-xs font-mono uppercase font-black tracking-widest text-primary mb-2 px-1">Upper Bracket</div>
              {renderRoundRow(upperRounds, true)}
            </div>
            <div className="border-t border-border/50 pt-6">
              <div className="text-xs font-mono uppercase font-black tracking-widest text-destructive/80 mb-2 px-1">Lower Bracket</div>
              {renderRoundRow(lowerRounds, false, true)}
            </div>
            {otherRounds.length > 0 && (
              <div className="border-t border-border/40 pt-4">
                {renderRoundRow(otherRounds, false)}
              </div>
            )}
          </div>
        ) : (
          renderRoundRow(rounds, true)
        )}

        {thirdPlaceRounds.length > 0 && (
          <div className="flex items-start ml-8 pl-8 border-l border-border/40 mt-4">
            {thirdPlaceRounds.map((round) => (
              <div key={round} className="flex flex-col w-[260px] shrink-0">
                {renderRoundHeader(round, false, false)}
                <div className="flex flex-col" style={{ gap: `${BASE_GAP}px` }}>
                  {grouped[round].map(m => renderMatchCard(m, false))}
                </div>
              </div>
            ))}
          </div>
        )}
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
          <p className="text-xs font-mono text-muted-foreground self-center">
            💡 PPM na meczu = szybka edycja • Klik na rundzie + = dodaj mecz
          </p>
        </div>
      )}
    </div>
  );
};
