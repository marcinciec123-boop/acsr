import type { MatchResult } from "@/lib/types";

export interface BracketLayoutColumn {
  matches: Array<MatchResult | null>;
}

export interface BracketConnector {
  fromColumn: number;
  fromIndex: number;
  toColumn: number;
  toIndex: number;
}

export interface BracketLayout {
  centers: number[][];
  connectors: BracketConnector[];
  height: number;
}

const occupiedIndexes = (column: BracketLayoutColumn) =>
  column.matches.flatMap((match, index) => (match ? [index] : []));

const inferredTargetIndex = (
  sourceOrder: number,
  sourceCount: number,
  targetCount: number,
) => {
  if (targetCount <= 1) return 0;
  if (sourceCount === targetCount) return Math.min(sourceOrder, targetCount - 1);
  return Math.min(targetCount - 1, Math.floor((sourceOrder * targetCount) / sourceCount));
};

/**
 * Computes a stable bracket geometry from actual match transitions. When old or
 * manually edited data has no transition metadata, it falls back to an even,
 * order-preserving distribution between adjacent rounds.
 */
export const computeBracketLayout = (
  columns: BracketLayoutColumn[],
  matchHeight: number,
  rowGap: number,
): BracketLayout => {
  if (columns.length === 0) return { centers: [], connectors: [], height: 0 };

  const pitch = matchHeight + rowGap;
  const centers: number[][] = columns.map((column) => column.matches.map(() => matchHeight / 2));
  const connectors: BracketConnector[] = [];
  const matchLocation = new Map<string, { column: number; index: number }>();

  columns.forEach((column, columnIndex) => {
    column.matches.forEach((match, index) => {
      if (match) matchLocation.set(match.id, { column: columnIndex, index });
    });
  });

  const firstOccupied = occupiedIndexes(columns[0]);
  firstOccupied.forEach((index) => {
    centers[0][index] = matchHeight / 2 + index * pitch;
  });

  for (let columnIndex = 1; columnIndex < columns.length; columnIndex++) {
    const previous = columns[columnIndex - 1];
    const current = columns[columnIndex];
    const previousIndexes = occupiedIndexes(previous);
    const currentIndexes = occupiedIndexes(current);
    const incoming = new Map<number, number[]>();
    const linkedSources = new Set<number>();

    previousIndexes.forEach((sourceIndex) => {
      const source = previous.matches[sourceIndex];
      if (!source) return;
      const destination = source.winnerTo ? matchLocation.get(source.winnerTo) : undefined;
      if (!destination || destination.column !== columnIndex) return;
      const targets = incoming.get(destination.index) ?? [];
      targets.push(sourceIndex);
      incoming.set(destination.index, targets);
      linkedSources.add(sourceIndex);
      connectors.push({ fromColumn: columnIndex - 1, fromIndex: sourceIndex, toColumn: columnIndex, toIndex: destination.index });
    });

    // Older imports and hand-built brackets may not contain winnerTo. Keep their
    // visual flow deterministic by connecting unlinked matches by display order.
    previousIndexes.forEach((sourceIndex, sourceOrder) => {
      if (linkedSources.has(sourceIndex) || currentIndexes.length === 0) return;
      const targetOrder = inferredTargetIndex(sourceOrder, previousIndexes.length, currentIndexes.length);
      const targetIndex = currentIndexes[targetOrder];
      const targets = incoming.get(targetIndex) ?? [];
      targets.push(sourceIndex);
      incoming.set(targetIndex, targets);
      connectors.push({ fromColumn: columnIndex - 1, fromIndex: sourceIndex, toColumn: columnIndex, toIndex: targetIndex });
    });

    const desired = currentIndexes.map((targetIndex, order) => {
      const sources = incoming.get(targetIndex) ?? [];
      if (sources.length > 0) {
        return sources.reduce((sum, sourceIndex) => sum + centers[columnIndex - 1][sourceIndex], 0) / sources.length;
      }
      const previousHeight = Math.max(matchHeight, previous.matches.length * pitch - rowGap);
      return ((order + 1) * previousHeight) / (currentIndexes.length + 1);
    });

    // Keep cards ordered and non-overlapping without losing their graph-derived centers.
    for (let order = 1; order < desired.length; order++) {
      desired[order] = Math.max(desired[order], desired[order - 1] + pitch);
    }
    for (let order = desired.length - 2; order >= 0; order--) {
      desired[order] = Math.min(desired[order], desired[order + 1] - pitch);
    }
    if (desired.length > 0 && desired[0] < matchHeight / 2) {
      const shift = matchHeight / 2 - desired[0];
      desired.forEach((_, order) => { desired[order] += shift; });
    }
    currentIndexes.forEach((index, order) => { centers[columnIndex][index] = desired[order]; });
  }

  const maxCenter = columns.reduce((max, column, columnIndex) => {
    const indexes = occupiedIndexes(column);
    return indexes.reduce((columnMax, index) => Math.max(columnMax, centers[columnIndex][index]), max);
  }, matchHeight / 2);

  return { centers, connectors, height: Math.ceil(maxCenter + matchHeight / 2) };
};
