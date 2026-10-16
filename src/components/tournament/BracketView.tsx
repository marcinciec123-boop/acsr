import { Trash2, Maximize2, ArrowUp, ArrowDown, Plus, Pencil, Crown, Camera } from "lucide-react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { useScrollRestore } from "@/lib/uiPrefs";
import type { MatchResult } from "@/lib/types";
import { isPlaceholder } from "@/lib/teamHelpers";
import TeamLogo from "@/components/TeamLogo";
import { TeamLink } from "@/lib/profileNav";
import { getDisplayScore } from "@/lib/matchDisplay";
import { computeBracketLayout } from "@/lib/bracketLayout";

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
  const isChampion = isWinner && isFinal;
  return (
    <div className={cn(
      "relative flex justify-between items-center px-3 py-2 transition-colors",
      isWinner && (isChampion ? "bg-[hsl(var(--gold))]/12" : "bg-[hsl(var(--win))]/12"),
      !isWinner && score >= 0 && "bg-card/60",
    )}>
      {isWinner && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-0 inset-y-0 w-[3px]",
            isChampion
              ? "bg-[hsl(var(--gold))] shadow-[0_0_6px_hsl(var(--gold)/0.6)]"
              : "bg-[hsl(var(--win))] shadow-[0_0_6px_hsl(var(--win)/0.55)]",
          )}
        />
      )}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {isWinner && isFinal && <Crown className="w-3.5 h-3.5 text-[hsl(var(--gold))] shrink-0" />}
        {!placeholder && <TeamLogo teamName={name} size={22} rounded="md" />}
        <TeamLink
          name={placeholder ? undefined : name}
          className={cn(
            "truncate text-[13px]",
            isChampion
              ? "font-bold text-[hsl(var(--gold))]"
              : isWinner
                ? "font-bold text-foreground"
                : placeholder ? "text-muted-foreground italic" : "text-foreground/85"
          )}
        >
          {name || "TBD"}
        </TeamLink>

      </div>
      <span className={cn(
        "font-mono font-bold ml-2 text-sm tabular-nums",
        isChampion ? "text-[hsl(var(--gold))]" : isWinner ? "text-[hsl(var(--win))]" : "text-muted-foreground/70"
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
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollEdges = useCallback(() => {
    const el = panRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, [panRef]);

  useEffect(() => {
    updateScrollEdges();
    const el = panRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateScrollEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [panRef, updateScrollEdges, matches.length]);

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
  const BASE_GAP = 18;
  const HEADER_H = 32;
  const COLUMN_W = 260;
  const CONNECTOR_W = 48;

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
          "border rounded-md shadow-md bg-card/60 backdrop-blur-sm flex flex-col flex-1 overflow-hidden",
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
            <span className="truncate flex items-center gap-1.5 min-w-0">
              {isLast && decided ? (
                <>
                  <Crown className="w-3 h-3 shrink-0" />
                  <span className="truncate">{winner1 ? m.team1 : m.team2}</span>
                </>
              ) : (
                `BO${m.bo || 3}`
              )}
            </span>
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
        {showPrediction && (
          <div className="absolute top-full left-0 right-0 z-20 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity rounded-b-md border border-t-0 border-primary/40 bg-card shadow-lg overflow-hidden">
            <MatchPredictionBadge team1={m.team1} team2={m.team2} tier={tier || "B"} />
          </div>
        )}
      </div>
    );
  };

  const renderRoundHeader = (round: string, isLast: boolean, lower: boolean) => (
    <div className="flex items-center justify-center px-1 h-7 mb-2">
      <div className={cn(
        "flex items-center gap-1.5 max-w-full rounded-md border px-3 py-1 backdrop-blur-sm",
        "text-xs font-mono uppercase font-bold tracking-[0.18em]",
        isLast
          ? "bg-[hsl(var(--gold))]/10 border-[hsl(var(--gold))]/40 text-[hsl(var(--gold))] shadow-[0_0_12px_hsl(var(--gold)/0.15)]"
          : lower
            ? "bg-destructive/10 border-destructive/30 text-destructive/90"
            : "bg-primary/10 border-primary/30 text-primary"
      )}>
        <span className="truncate">{isLast && "★ "}{round}</span>
        {onAdd && (
          <button onClick={() => onAdd(round)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-foreground/10"
            title="Dodaj mecz w tej rundzie">
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>
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
    const columns = list.map(round => {
      const { slotCount, bySlot } = positionMatches(grouped[round]);
      return {
        matches: Array.from({ length: slotCount }, (_, index) => bySlot.get(index) ?? null),
      };
    });
    const layout = computeBracketLayout(columns, MATCH_H, BASE_GAP);
    const bodyWidth = list.length * COLUMN_W + Math.max(0, list.length - 1) * CONNECTOR_W;

    return (
      <div className="relative mx-auto" style={{ width: bodyWidth, minWidth: bodyWidth }}>
        <div className="relative" style={{ height: HEADER_H }}>
          {list.map((round, ri) => {
            const isLast = goldLastRound && ri === list.length - 1;
            const lower = forceLowerStyle || isLowerRound(round);
            const left = ri * (COLUMN_W + CONNECTOR_W);
            return (
              <div key={`header-${round}`} className="absolute top-0" style={{ left, width: COLUMN_W }}>
                {renderRoundHeader(round, isLast, lower)}
              </div>
            );
          })}
        </div>

        <div className="relative" style={{ height: layout.height }}>
          <svg
            className="absolute inset-0 pointer-events-none overflow-visible"
            width={bodyWidth}
            height={layout.height}
            aria-hidden="true"
          >
            {layout.connectors.map((connector, index) => {
              const x1 = connector.fromColumn * (COLUMN_W + CONNECTOR_W) + COLUMN_W;
              const x2 = connector.toColumn * (COLUMN_W + CONNECTOR_W);
              const c1 = layout.centers[connector.fromColumn]?.[connector.fromIndex];
              const c2 = layout.centers[connector.toColumn]?.[connector.toIndex];
              if (c1 === undefined || c2 === undefined) return null;
              // Anchor on the divider between both teams (header pushes rows down).
              const y1 = c1 + 14.5;
              const y2 = c2 + 14.5;
              const midX = x1 + (x2 - x1) / 2;
              return (
                <path
                  key={`${connector.fromColumn}-${connector.fromIndex}-${connector.toColumn}-${connector.toIndex}-${index}`}
                  d={`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`}
                  fill="none"
                  stroke="hsl(var(--border))"
                  strokeOpacity="0.85"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>

          {list.map((round, ri) => {
          const isLast = goldLastRound && ri === list.length - 1;
            const left = ri * (COLUMN_W + CONNECTOR_W);
            return columns[ri].matches.map((match, matchIndex) => {
              if (!match) return null;
              const center = layout.centers[ri]?.[matchIndex];
              if (center === undefined) return null;
              return (
                <div
                  key={match.id}
                  className="absolute z-10"
                  style={{ left, top: center - MATCH_H / 2, width: COLUMN_W, height: MATCH_H }}
                >
                  {renderMatchCard(match, isLast)}
                </div>
              );
            });
          })}
        </div>
      </div>
    );
  };


  const exportPng = async () => {
    const el = panRef.current?.firstElementChild as HTMLElement | null;
    if (!el) return;
    const bg = getComputedStyle(document.body).backgroundColor;
    try {
      const url = await toPng(el, {
        pixelRatio: 2, backgroundColor: bg, cacheBust: true,
        width: el.scrollWidth + 32, height: el.scrollHeight + 32,
        style: { padding: "16px", margin: "0" },
        filter: (n) => !(n instanceof HTMLElement && n.dataset.exportHide === "true"),
      });
      const a = document.createElement("a");
      a.href = url; a.download = "drabinka.png";
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { console.error("Eksport drabinki nie powiódł się", e); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end -mb-4">
        <Button size="sm" variant="outline" onClick={exportPng} className="gap-1.5 h-7 text-xs font-mono uppercase">
          <Camera className="w-3.5 h-3.5" /> Eksportuj PNG
        </Button>
      </div>
      <div className="relative">
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-10 z-20 transition-opacity duration-300",
            "bg-gradient-to-r from-background to-transparent",
            canScrollLeft ? "opacity-100" : "opacity-0"
          )}
          aria-hidden="true"
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-10 z-20 transition-opacity duration-300",
            "bg-gradient-to-l from-background to-transparent",
            canScrollRight ? "opacity-100" : "opacity-0"
          )}
          aria-hidden="true"
        />
        <div ref={panRef} className="overflow-x-auto pb-3 px-1" onScroll={updateScrollEdges}>
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
