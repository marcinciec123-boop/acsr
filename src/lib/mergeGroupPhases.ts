import type { PhaseFormat, PhaseGroup, TournamentData, TournamentPhase } from "./types";

const GROUP_NAME = /^(group|grupa)\s+([a-z0-9]{1,2})$/i;
const GROUP_FORMATS: PhaseFormat[] = ["round-robin", "gsl-groups", "gsl-de-groups"];

/** Format a lone "Group X" phase would have as one group, or null when it is not a group. */
const groupFormatOf = (p: TournamentPhase): PhaseFormat | null => {
  if (!GROUP_NAME.test(p.name.trim())) return null;
  if (p.groups?.length) return GROUP_FORMATS.includes(p.format) ? p.format : null;
  const slots = (p.bracket || []).map(m => m.bracketSlot || "");
  if (slots.some(s => s.startsWith("IEM-"))) return "gsl-de-groups";
  if (slots.some(s => s.startsWith("GSL-"))) return "gsl-groups";
  if (p.format === "round-robin") return "round-robin";
  return null;
};

const toGroups = (p: TournamentPhase): PhaseGroup[] =>
  p.groups?.length
    ? p.groups.map(g => ({ ...g, name: p.groups!.length === 1 ? p.name.trim() : g.name }))
    : [{ id: p.id, name: p.name.trim(), teams: p.teams, matches: p.bracket || [] }];

/**
 * Historical imports sometimes store "Group A", "Group B"… as separate phases.
 * Neighbouring phases like that (same format and BO) become one group stage phase.
 */
export const mergeGroupPhases = (t: TournamentData): TournamentData => {
  if (!Array.isArray(t?.phases) || t.phases.length < 2) return t;
  const out: TournamentPhase[] = [];
  let changed = false;
  for (let i = 0; i < t.phases.length; i++) {
    const first = t.phases[i];
    const fmt = groupFormatOf(first);
    let j = i + 1;
    while (fmt && j < t.phases.length && groupFormatOf(t.phases[j]) === fmt && t.phases[j].bo === first.bo) j++;
    if (!fmt || j - i < 2) { out.push(first); continue; }
    const run = t.phases.slice(i, j);
    const advance = run.reduce((s, p) => s + (p.advanceCount || 0), 0);
    out.push({
      id: first.id,
      name: /^grupa/i.test(first.name.trim()) ? "Faza grupowa" : "Group Stage",
      format: fmt,
      bo: first.bo,
      teams: Array.from(new Set(run.flatMap(p => p.teams || []))),
      groups: run.flatMap(toGroups),
      groupCount: run.length,
      ...(advance ? { advanceCount: advance } : {}),
      ...(first.region ? { region: first.region } : {}),
    });
    changed = true;
    i = j - 1;
  }
  return changed ? { ...t, phases: out } : t;
};
