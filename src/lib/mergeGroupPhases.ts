import type { PhaseFormat, PhaseGroup, TournamentData, TournamentPhase } from "./types";

const GROUP_NAME = /^(.*?\S\s*[—–:-]\s*)?(group|grupa)\s+([a-z0-9]{1,2})$/i;
const GROUP_FORMATS: PhaseFormat[] = ["round-robin", "gsl-groups", "gsl-de-groups"];

/** Format a lone "Group X" phase would have as one group, or null when it is not a group. */
const groupFormatOf = (p: TournamentPhase): PhaseFormat | null => {
  if (!GROUP_NAME.test(p.name.trim())) return null;
  if (p.groups?.length) return GROUP_FORMATS.includes(p.format) ? p.format : null;
  const slots = (p.bracket || []).map(m => m.bracketSlot || "");
  if (slots.some(s => s.startsWith("IEM-"))) return "gsl-de-groups";
  if (slots.some(s => s.startsWith("GSL-"))) return "gsl-groups";
  if (p.format === "round-robin") return "round-robin";
  if (p.format === "double-elim" && slots.some(s => /^(UB|LB)-/.test(s))) return "double-elim";
  return null;
};

/** "Stage 1 — Group A" → "Group A" inside the merged phase. */
const shortName = (name: string): string => {
  const m = name.trim().match(GROUP_NAME);
  return m ? `${m[2]} ${m[3]}` : name.trim();
};

const groupStageName = (name: string): string => {
  const m = name.match(GROUP_NAME);
  const prefix = m?.[1] || "";
  return /^grupa$/i.test(m?.[2] || "") ? `${prefix}Faza grupowa` : `${prefix}Group Stage`;
};

const toGroups = (p: TournamentPhase): PhaseGroup[] =>
  p.groups?.length
    ? p.groups.map(g => ({ ...g, name: p.groups!.length === 1 ? shortName(p.name) : g.name }))
    : [{ id: p.id, name: shortName(p.name), teams: p.teams, matches: p.bracket || [] }];

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
      name: groupStageName(first.name.trim()),
      format: fmt,
      bo: first.bo,
      teams: Array.from(new Set(run.flatMap(p => p.teams || []))),
      groups: run.flatMap(toGroups),
      groupCount: run.length,
      mergedGroups: true,
      ...(advance ? { advanceCount: advance } : {}),
      ...(first.region ? { region: first.region } : {}),
    });
    changed = true;
    i = j - 1;
  }
  return changed ? { ...t, phases: out } : t;
};
