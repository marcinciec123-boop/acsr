// ===== Nadchodzące mecze w turnieju =====
// Lists every unplayed match (both teams known) across all phases/groups.
// Clicking a row opens the match; clicking a team name opens the team profile.
// Masowa edycja terminów żyje w osobnym panelu (ScheduleBulkPanel).

import { useMemo } from "react";
import { CalendarClock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchResult, TournamentData } from "@/lib/types";
import { isPlaceholder } from "@/lib/teamHelpers";
import TeamLogo from "@/components/TeamLogo";
import { TeamLink } from "@/lib/profileNav";
import { buildMatchNumbers } from "@/lib/matchNumbers";
import { usePersistedState } from "@/lib/uiPrefs";

interface Row {
  phaseId: string;
  phaseName: string;
  groupId?: string;
  groupName?: string;
  match: MatchResult;
}

interface Props {
  tournament: TournamentData;
  onUpdateMatch: (phaseId: string, matchId: string, patch: Partial<MatchResult>, groupId?: string) => void;
  onOpenMatch: (phaseId: string, matchId: string, groupId?: string) => void;
}

const isUnplayed = (m: MatchResult) => (m.score1 || 0) + (m.score2 || 0) === 0 && !m.resultConfirmed;

export const TournamentUpcomingPanel = ({ tournament: t, onOpenMatch }: Props) => {
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    t.phases.forEach(p => {
      (p.bracket || []).forEach(m => {
        if (isUnplayed(m) && !isPlaceholder(m.team1) && !isPlaceholder(m.team2)) {
          out.push({ phaseId: p.id, phaseName: p.name, match: m });
        }
      });
      (p.groups || []).forEach(g => {
        g.matches.forEach(m => {
          if (isUnplayed(m) && !isPlaceholder(m.team1) && !isPlaceholder(m.team2)) {
            out.push({ phaseId: p.id, phaseName: p.name, groupId: g.id, groupName: g.name, match: m });
          }
        });
      });
    });
    return out.sort((a, b) => {
      const sa = a.match.scheduledAt, sb = b.match.scheduledAt;
      if (sa && sb) return sa.localeCompare(sb);
      if (sa) return -1;
      if (sb) return 1;
      return 0;
    });
  }, [t]);

  const [collapsed, setCollapsed] = usePersistedState<boolean>(`tour_upcoming_collapsed_${t.id}`, false);

  if (rows.length === 0) return null;

  const key = (r: Row) => `${r.phaseId}:${r.groupId || "-"}:${r.match.id}`;

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-xs font-heading font-bold uppercase text-primary tracking-wider flex items-center gap-2"
        >
          <CalendarClock className="w-3.5 h-3.5" />
          Nadchodzące mecze ({rows.length})
          <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", !collapsed && "rotate-90")} />
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-1">
          {rows.map(r => {
            const k = key(r);
            const m = r.match;
            return (
              <div
                key={k}
                className="flex items-center gap-2 rounded border border-border/40 bg-secondary/20 px-2 py-1.5 transition-colors hover:border-primary/50"
              >
                <span className="text-xs font-mono text-muted-foreground w-[124px] shrink-0 truncate">
                  {m.scheduledAt
                    ? `${m.scheduledAt.slice(0, 10)} ${m.scheduledAt.slice(11, 16)}`
                    : "termin —"}
                </span>
                <span className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                  <TeamLogo teamName={m.team1} size={18} rounded="md" />
                  <TeamLink name={m.team1} className="text-xs font-medium truncate" />
                </span>
                <span className="text-xs font-mono text-muted-foreground shrink-0">vs</span>
                <span className="flex items-center gap-1.5 min-w-0 flex-1">
                  <TeamLink name={m.team2} className="text-xs font-medium truncate" />
                  <TeamLogo teamName={m.team2} size={18} rounded="md" />
                </span>
                <span className="text-xs font-mono text-muted-foreground shrink-0 hidden sm:inline truncate max-w-[160px]">
                  {r.groupName || r.phaseName}{m.round ? ` • ${m.round}` : ""} • Bo{m.bo || 1}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenMatch(r.phaseId, m.id, r.groupId)}
                  className="text-xs font-mono text-primary hover:underline shrink-0 inline-flex items-center"
                  title="Otwórz mecz"
                >
                  Otwórz <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TournamentUpcomingPanel;
