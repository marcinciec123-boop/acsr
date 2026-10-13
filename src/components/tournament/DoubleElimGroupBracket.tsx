import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Maximize2, Pencil, Trash2, Plus, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { MatchResult, PhaseFormat } from "@/lib/types";
import { isPlaceholder } from "@/lib/teamHelpers";
import TeamLogo from "@/components/TeamLogo";
import { getDisplayScore, buildBo1RoundScorePatch } from "@/lib/matchDisplay";
import { computeBracketLayout } from "@/lib/bracketLayout";

interface Props {
  matches: MatchResult[];
  format: PhaseFormat; // "gsl-groups" | "gsl-de-groups"
  onMatchUpdate: (matchId: string, patch: Partial<MatchResult>) => void;
  onOpenMatch?: (matchId: string) => void;
  /** Team pool for manual team assignment. */
  allTeams?: string[];
  /** Add a new match inside this group under the given round/phase name. */
  onAddMatch?: (round: string) => void;
  /** Delete a match from this group. */
  onDeleteMatch?: (matchId: string) => void;
}

// Match-card sizing (must match math)
const MATCH_H = 64;
const BASE_GAP = 16;
const HEADER_H = 26;
const COLUMN_W = 180;
const CONNECTOR_W = 40;

const teamLabel = (name: string, isWinner: boolean) => {
  if (isPlaceholder(name) || !name)
    return <span className="text-muted-foreground italic text-xs">{name || "TBD"}</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 min-w-0", isWinner && "font-bold text-foreground")}>
      <TeamLogo teamName={name} size={16} rounded="md" />
      <span className="truncate text-xs">{name}</span>
    </span>
  );
};

const MatchCard = ({
  m,
  onMatchUpdate,
  onOpenMatch,
  onDeleteMatch,
  allTeams = [],
  isFinal,
}: {
  m: MatchResult;
  onMatchUpdate: Props["onMatchUpdate"];
  onOpenMatch?: Props["onOpenMatch"];
  onDeleteMatch?: Props["onDeleteMatch"];
  allTeams?: string[];
  isFinal?: boolean;
}) => {
  const [editing, setEditing] = useState(false);
  const decided = m.score1 + m.score2 > 0 && m.score1 !== m.score2;
  const w1 = decided && m.score1 > m.score2;
  const w2 = decided && m.score2 > m.score1;
  const disabled = isPlaceholder(m.team1) || isPlaceholder(m.team2) || !m.team1 || !m.team2;
  const isBo1 = (m.bo || 1) === 1;
  const [d1, d2] = getDisplayScore(m);
  const handleChange = (side: 1 | 2, val: number) => {
    if (isBo1) {
      const r1 = side === 1 ? val : d1;
      const r2 = side === 2 ? val : d2;
      onMatchUpdate(m.id, buildBo1RoundScorePatch(m, r1, r2));
    } else {
      onMatchUpdate(m.id, side === 1 ? { score1: val } : { score2: val });
    }
  };

  const canEdit = allTeams.length > 0 || !!onDeleteMatch;

  if (editing) {
    return (
      <div className="border border-primary/50 rounded-md bg-card p-1.5 space-y-1 text-xs shadow" style={{ minHeight: MATCH_H }}>
        <div className="flex gap-1 items-center">
          <select
            value={m.team1}
            onChange={(e) => onMatchUpdate(m.id, { team1: e.target.value })}
            className="flex-1 min-w-0 px-1 py-0.5 rounded bg-card border border-border text-xs font-mono"
          >
            <option value="">—</option>
            {allTeams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Input type="number" min="0" value={d1} onChange={(e) => handleChange(1, parseInt(e.target.value) || 0)} className="w-10 h-6 text-center text-xs px-0.5" />
        </div>
        <div className="flex gap-1 items-center">
          <select
            value={m.team2}
            onChange={(e) => onMatchUpdate(m.id, { team2: e.target.value })}
            className="flex-1 min-w-0 px-1 py-0.5 rounded bg-card border border-border text-xs font-mono"
          >
            <option value="">—</option>
            {allTeams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <Input type="number" min="0" value={d2} onChange={(e) => handleChange(2, parseInt(e.target.value) || 0)} className="w-10 h-6 text-center text-xs px-0.5" />
        </div>
        <div className="flex gap-1 items-center">
          <select
            value={m.bo || 3}
            onChange={(e) => onMatchUpdate(m.id, { bo: parseInt(e.target.value) as 1 | 3 | 5 })}
            className="px-1 py-0.5 rounded bg-card border border-border text-xs font-mono"
          >
            <option value={1}>BO1</option>
            <option value={3}>BO3</option>
            <option value={5}>BO5</option>
          </select>
          <Input
            defaultValue={m.round || ""}
            placeholder="Faza..."
            onBlur={(e) => onMatchUpdate(m.id, { round: e.target.value || "Mecze" })}
            className="h-6 text-xs font-mono flex-1 min-w-0"
          />
          {onDeleteMatch && (
            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" title="Usuń mecz" onClick={() => onDeleteMatch(m.id)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-6 w-6 text-[hsl(var(--win))]" title="Gotowe" onClick={() => setEditing(false)}>
            <Check className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ height: MATCH_H }}
      className={cn(
        "group border rounded-md overflow-hidden bg-card/60 backdrop-blur-sm flex flex-col text-xs shadow",
        isFinal
          ? "border-[hsl(var(--gold))]/50 shadow-[0_0_10px_hsl(var(--gold)/0.18)]"
          : decided
          ? "border-primary/40"
          : "border-border/70",
      )}
    >
      <div className="flex items-center justify-between px-1.5 h-5 bg-secondary/40 border-b border-border/50 shrink-0 text-xs font-mono uppercase tracking-wider text-muted-foreground">
        <span>BO{m.bo || 3}</span>
        <span className="flex items-center gap-1">
          {decided && <span className="text-[hsl(var(--win))]">✓</span>}
          {canEdit && (
            <button
              onClick={() => setEditing(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary"
              title="Edytuj mecz"
            >
              <Pencil className="w-2.5 h-2.5" />
            </button>
          )}
        </span>
      </div>
      <div className={cn("flex items-center gap-1 px-1.5 py-0.5 flex-1 min-h-0", w1 && "bg-[hsl(var(--win))]/10")}>
        <div className="flex-1 min-w-0">{teamLabel(m.team1, w1)}</div>
        <Input
          type="number"
          min="0"
          value={d1}
          onChange={(e) => handleChange(1, parseInt(e.target.value) || 0)}
          disabled={disabled}
          className={cn("w-10 h-5 text-center text-xs px-0.5 font-mono font-bold", w1 && "text-[hsl(var(--win))]")}
        />
      </div>
      <div className="h-px bg-border/40" />
      <div className={cn("flex items-center gap-1 px-1.5 py-0.5 flex-1 min-h-0", w2 && "bg-[hsl(var(--win))]/10")}>
        <div className="flex-1 min-w-0">{teamLabel(m.team2, w2)}</div>
        <Input
          type="number"
          min="0"
          value={d2}
          onChange={(e) => handleChange(2, parseInt(e.target.value) || 0)}
          disabled={disabled}
          className={cn("w-10 h-5 text-center text-xs px-0.5 font-mono font-bold", w2 && "text-[hsl(var(--win))]")}
        />
        {onOpenMatch && (
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5 text-primary hover:text-primary shrink-0"
            onClick={() => onOpenMatch(m.id)}
            title="Otwórz mecz"
          >
            <Maximize2 className="w-2.5 h-2.5" />
          </Button>
        )}
      </div>
    </div>
  );
};

interface ColumnSpec {
  title: string;
  slots: string[];
  isFinal?: boolean;
}

const GSL4_UB: ColumnSpec[] = [
  { title: "Opening", slots: ["GSL-OM1", "GSL-OM2"] },
  { title: "Winners (1. miejsce)", slots: ["GSL-WM"], isFinal: true },
];
const GSL4_LB: ColumnSpec[] = [
  { title: "Elimination", slots: ["GSL-LM"] },
  { title: "Decider (2. miejsce)", slots: ["GSL-DM"], isFinal: true },
];

const IEM8_UB: ColumnSpec[] = [
  { title: "UB Opening", slots: ["IEM-UB-R1-M1", "IEM-UB-R1-M2", "IEM-UB-R1-M3", "IEM-UB-R1-M4"] },
  { title: "Winners Match (awans)", slots: ["IEM-UB-SF-M1", "IEM-UB-SF-M2"], isFinal: true },
];
const IEM8_LB: ColumnSpec[] = [
  { title: "LB R1", slots: ["IEM-LB-R1-M1", "IEM-LB-R1-M2"] },
  { title: "LB R2", slots: ["IEM-LB-R2-M1", "IEM-LB-R2-M2"] },
  { title: "LB Decider (3. miejsce)", slots: ["IEM-LB-FINAL"], isFinal: true },
];

export const DoubleElimGroupBracket = ({
  matches,
  format,
  onMatchUpdate,
  onOpenMatch,
  allTeams = [],
  onAddMatch,
  onDeleteMatch,
}: Props) => {
  const ubSpec = format === "gsl-de-groups" ? IEM8_UB : GSL4_UB;
  const lbSpec = format === "gsl-de-groups" ? IEM8_LB : GSL4_LB;

  const bySlot = new Map(matches.map((m) => [m.bracketSlot || "", m]));
  const knownSlots = new Set([...ubSpec, ...lbSpec].flatMap((c) => c.slots));

  const resolve = (specs: ColumnSpec[]) =>
    specs
      .map((c) => ({
        ...c,
        // keep positional nulls so a deleted match doesn't pull the others up
        slots: c.slots.map((s) => bySlot.get(s) ?? null),
      }))
      .map((c) => {
        // trim trailing empty slots only
        const s = [...c.slots];
        while (s.length && !s[s.length - 1]) s.pop();
        return { ...c, slots: s };
      })
      .filter((c) => c.slots.some(Boolean));

  const ub = resolve(ubSpec);
  const lb = resolve(lbSpec);

  // Manually added matches / custom phases (no known bracket slot)
  const extras = matches.filter((m) => !m.bracketSlot || !knownSlots.has(m.bracketSlot));
  const extraColumns: { title: string; slots: (MatchResult | null)[] }[] = [];
  extras.forEach((m) => {
    const title = m.round || "Dodatkowe";
    const col = extraColumns.find((c) => c.title === title);
    if (col) col.slots.push(m);
    else extraColumns.push({ title, slots: [m] });
  });

  const renderSection = (
    cols: { title: string; slots: (MatchResult | null)[]; isFinal?: boolean }[],
    side: "ub" | "lb",
    label: string,
    color: string,
  ) => {
    const targetSlot = (slot: string): string | undefined => {
      const links: Record<string, string> = side === "lb"
        ? {
            "GSL-LM": "GSL-DM",
            "IEM-LB-R1-M1": "IEM-LB-R2-M1",
            "IEM-LB-R1-M2": "IEM-LB-R2-M2",
            "IEM-LB-R2-M1": "IEM-LB-FINAL",
            "IEM-LB-R2-M2": "IEM-LB-FINAL",
          }
        : {
            "GSL-OM1": "GSL-WM",
            "GSL-OM2": "GSL-WM",
            "IEM-UB-R1-M1": "IEM-UB-SF-M1",
            "IEM-UB-R1-M2": "IEM-UB-SF-M1",
            "IEM-UB-R1-M3": "IEM-UB-SF-M2",
            "IEM-UB-R1-M4": "IEM-UB-SF-M2",
          };
      return links[slot];
    };
    const idBySlot = new Map(matches.flatMap(match => match.bracketSlot ? [[match.bracketSlot, match.id] as const] : []));
    const layoutColumns = cols.map(col => ({
      matches: col.slots.map(match => {
        if (!match) return null;
        const target = match.bracketSlot ? targetSlot(match.bracketSlot) : undefined;
        const winnerTo = target ? idBySlot.get(target) : match.winnerTo;
        return winnerTo ? { ...match, winnerTo } : match;
      }),
    }));
    const layout = computeBracketLayout(layoutColumns, MATCH_H, BASE_GAP);
    const width = cols.length * COLUMN_W + Math.max(0, cols.length - 1) * CONNECTOR_W;

    return (
    <div>
      <div className={cn("text-xs font-mono uppercase font-bold tracking-wider mb-2 pb-1 border-b", color)}>
        {label}
      </div>
      <div className="overflow-x-auto pb-2">
        <div className="relative" style={{ width, minWidth: width }}>
          <div className="relative" style={{ height: HEADER_H }}>
            {cols.map((col, columnIndex) => (
              <div
                key={`header-${col.title}-${columnIndex}`}
                className="absolute top-0 flex items-center justify-between gap-1 px-1"
                style={{ left: columnIndex * (COLUMN_W + CONNECTOR_W), width: COLUMN_W, height: HEADER_H }}
              >
                <h6
                  className={cn(
                    "text-xs font-mono uppercase font-bold tracking-wider truncate",
                    col.isFinal ? "text-[hsl(var(--gold))]" : side === "ub" ? "text-[hsl(var(--win))]" : "text-destructive/80",
                  )}
                  title={col.title}
                >
                  {col.isFinal && "★ "}{col.title}
                </h6>
                {onAddMatch && (
                  <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => onAddMatch(col.title)} title="Dodaj mecz w tej fazie">
                    <Plus className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="relative" style={{ height: layout.height }}>
            <svg className="absolute inset-0 pointer-events-none overflow-visible" width={width} height={layout.height} aria-hidden="true">
              {layout.connectors.map((connector, index) => {
                const x1 = connector.fromColumn * (COLUMN_W + CONNECTOR_W) + COLUMN_W;
                const x2 = connector.toColumn * (COLUMN_W + CONNECTOR_W);
                const c1 = layout.centers[connector.fromColumn]?.[connector.fromIndex];
                const c2 = layout.centers[connector.toColumn]?.[connector.toIndex];
                if (c1 === undefined || c2 === undefined) return null;
                // Anchor on the divider between both teams (header pushes rows down).
                const y1 = c1 + 10.5;
                const y2 = c2 + 10.5;
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

            {cols.flatMap((col, columnIndex) => col.slots.map((match, matchIndex) => {
              if (!match) return null;
              const center = layout.centers[columnIndex]?.[matchIndex];
              if (center === undefined) return null;
              return (
                <div
                  key={match.id}
                  className="absolute z-10"
                  style={{ left: columnIndex * (COLUMN_W + CONNECTOR_W), top: center - MATCH_H / 2, width: COLUMN_W, height: MATCH_H }}
                >
                  <MatchCard
                    m={match}
                    isFinal={col.isFinal}
                    onMatchUpdate={onMatchUpdate}
                    onOpenMatch={onOpenMatch}
                    onDeleteMatch={onDeleteMatch}
                    allTeams={allTeams}
                  />
                </div>
              );
            }))}
          </div>
        </div>
      </div>
    </div>
    );
  };

  return (
    <div className="space-y-4">
      {ub.length > 0 &&
        renderSection(ub, "ub", "↑ Upper Bracket", "text-[hsl(var(--win))] border-[hsl(var(--win))]/30")}
      {lb.length > 0 &&
        renderSection(lb, "lb", "↓ Lower Bracket", "text-destructive border-destructive/30")}
      {extraColumns.length > 0 &&
        renderSection(extraColumns, "ub", "+ Dodatkowe fazy", "text-primary border-primary/30")}

      {onAddMatch && (
        <div className="flex gap-2 pt-1 border-t border-border/40">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={() => {
              const name = prompt("Nazwa nowej fazy:", `Faza ${extraColumns.length + 1}`);
              if (name) onAddMatch(name);
            }}
          >
            <Plus className="w-3 h-3 mr-1" /> Nowa faza
          </Button>
          <p className="text-xs font-mono text-muted-foreground self-center">
            ✏️ na meczu = edycja drużyn, BO i usuwanie
          </p>
        </div>
      )}
    </div>
  );
};
