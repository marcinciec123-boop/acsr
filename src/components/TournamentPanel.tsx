import { useState, useEffect, useMemo } from "react";
import {
  Trophy, Plus, Trash2,
  Layers, GitBranch, Grid3x3, Shuffle, ArrowUp, ArrowDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { TournamentData, TournamentPhase, PhaseFormat, MatchResult, QualifierConfig } from "@/lib/types";
import { saveToStorage, saveToStorageAsync, loadFromStorage } from "@/lib/storage";
import { getPointsForPlacement, teamDatabase } from "@/data/tournaments";
import { resolvePoints, getDefaultPoints } from "@/lib/customPoints";
import { buildPhase, formatLabel, shuffle, propagateGSLDEGroup, propagateGSL4Group, distributeIntoGroups, rebuildGroupMatches } from "@/lib/tournamentBuilder";
import { seedMajorBerlin2025 } from "@/lib/majorBerlin2025Seeder";
import { seedEslProLeagueI } from "@/lib/eslProLeagueISeeder";
import { TournamentDetailPage } from "./tournament/TournamentDetailPage";
import { MatchDetailPage } from "./tournament/MatchDetailPage";
import { TournamentPortal } from "./tournament/TournamentPortal";
import { toast } from "@/hooks/use-toast";
import { suggestInvites } from "@/lib/inviteSuggestion";
import { countryFlag } from "@/lib/flags";

interface SelectedMatchRef {
  phaseId: string;
  matchId: string;
  groupId?: string;
}

const STORAGE_KEY = "tournaments_data";

const PHASE_FORMATS: { value: PhaseFormat; label: string; icon: typeof GitBranch }[] = [
  { value: "single-elim", label: "Single Elimination", icon: GitBranch },
  { value: "double-elim", label: "Double Elimination", icon: GitBranch },
  { value: "swiss", label: "Swiss System", icon: Layers },
  { value: "round-robin", label: "Round Robin (Groups)", icon: Grid3x3 },
  { value: "gsl-groups", label: "GSL Groups (4 teams)", icon: Grid3x3 },
  { value: "gsl-de-groups", label: "IEM-style Groups (8 teams, DE)", icon: Grid3x3 },
  { value: "showmatch", label: "Showmatch", icon: Trophy },
];

const REGIONS: { code: string; label: string }[] = [
  { code: "EU", label: "Europa" },
  { code: "US", label: "Ameryka Płn" },
  { code: "LATAM", label: "Ameryka Płd" },
  { code: "ASIA", label: "Azja" },
  { code: "OCE", label: "Oceania" },
  { code: "AFR", label: "Afryka" },
];

const isRealTeam = (team?: string) => !!team && team !== "BYE" && team !== "TBD" && !team.startsWith("TBD");
const matchWinner = (m: MatchResult) => {
  if (m.team2 === "BYE" && isRealTeam(m.team1)) return m.team1;
  if (m.team1 === "BYE" && isRealTeam(m.team2)) return m.team2;
  if (!isRealTeam(m.team1) || !isRealTeam(m.team2) || m.score1 + m.score2 === 0 || m.score1 === m.score2) return "";
  return m.score1 > m.score2 ? m.team1 : m.team2;
};
const matchLoser = (m: MatchResult) => {
  if (!isRealTeam(m.team1) || !isRealTeam(m.team2) || m.score1 + m.score2 === 0 || m.score1 === m.score2) return "";
  return m.score1 > m.score2 ? m.team2 : m.team1;
};

interface PhaseDraft {
  name: string;
  format: PhaseFormat;
  bo: 1 | 3 | 5;
  groupCount: number;
  advanceCount: number;
  /** How many teams are pre-seeded into this phase (rest are TBD).
   *  0 means: use the previous phase's advanceCount (or all participants for phase 1). */
  seededCount: number;
  /** Total number of teams in this phase. 0 = use incoming team count (default).
   *  Useful for Swiss where e.g. 8 seeded + 8 TBD = 16-team Swiss stage. */
  teamCount: number;
  /** How to assign teams to groups: random snake-seed (default) or manual after creation. */
  groupAssignment?: "random" | "manual";
}

const TournamentPanel = () => {
  const [tournaments, setTournaments] = useState<TournamentData[]>(() => {
    const stored = loadFromStorage<TournamentData[]>(STORAGE_KEY, []);
    // Seed StarLadder Berlin Major 2025 + ESL Pro League I (idempotent)
    return seedEslProLeagueI(seedMajorBerlin2025(stored));
  });
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMatchRef, setSelectedMatchRef] = useState<SelectedMatchRef | null>(null);
  const [activePhaseByTournament, setActivePhaseByTournament] = useState<Record<string, string>>({});

  // Tournament meta
  const [newName, setNewName] = useState("");
  const [newOrg, setNewOrg] = useState("");
  const [newPrize, setNewPrize] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newTier, setNewTier] = useState<"S" | "A" | "B" | "C">("A");
  const [customPointsEnabled, setCustomPointsEnabled] = useState(false);
  const [customPoints, setCustomPoints] = useState<Record<string, number>>({});

  // Participants
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [teamSearch, setTeamSearch] = useState("");
  const [teamSort, setTeamSort] = useState<"name" | "rank" | "points-desc" | "points-asc" | "region" | "country">("rank");

  // Phases (custom builder)
  const [phaseDrafts, setPhaseDrafts] = useState<PhaseDraft[]>([
    { name: "Playoffs", format: "single-elim", bo: 3, groupCount: 1, advanceCount: 0, seededCount: 0, teamCount: 0 },
  ]);

  // Qualifier config
  const [isQualifier, setIsQualifier] = useState(false);
  const [qualScope, setQualScope] = useState<"global" | "regional">("regional");
  const [qualRegions, setQualRegions] = useState<string[]>(["EU"]);
  const [qualSlots, setQualSlots] = useState<Record<string, number>>({ EU: 2, GLOBAL: 2 });
  const [qualLinkedTo, setQualLinkedTo] = useState<string>("");

  // Invite-by-ranking config (independent from qualifier — used to pre-fill participants)
  const [inviteScope, setInviteScope] = useState<"global" | "regional">("global");
  const [inviteSlots, setInviteSlots] = useState<Record<string, number>>({ GLOBAL: 8, EU: 4, US: 2, LATAM: 1, ASIA: 1 });

  useEffect(() => { saveToStorage(STORAGE_KEY, tournaments); }, [tournaments]);

  // Live ranking data (used for sorting & rank labels in team picker)
  const liveRanking = useMemo(() => {
    const stored = loadFromStorage<typeof teamDatabase | null>("ranking_data", null);
    return stored && stored.length > 0 ? stored : teamDatabase;
  }, [tournaments]);

  const rankMap = useMemo(() => {
    const sorted = [...liveRanking].sort((a, b) => (b.points || 0) - (a.points || 0));
    return new Map(sorted.map((t, i) => [t.name, i + 1]));
  }, [liveRanking]);

  const teamMeta = useMemo(() => new Map(liveRanking.map(t => [t.name, t])), [liveRanking]);

  const allTeams = useMemo(() => liveRanking.map(t => t.name), [liveRanking]);

  const filteredTeams = useMemo(() => {
    const q = teamSearch.toLowerCase();
    const filtered = allTeams.filter(n => n.toLowerCase().includes(q));
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      const ma = teamMeta.get(a); const mb = teamMeta.get(b);
      switch (teamSort) {
        case "name": return a.localeCompare(b);
        case "rank": return (rankMap.get(a) ?? 999) - (rankMap.get(b) ?? 999);
        case "points-desc": return (mb?.points || 0) - (ma?.points || 0);
        case "points-asc": return (ma?.points || 0) - (mb?.points || 0);
        case "region": return (ma?.region || "").localeCompare(mb?.region || "") || a.localeCompare(b);
        case "country": return (ma?.country || "").localeCompare(mb?.country || "") || a.localeCompare(b);
        default: return 0;
      }
    });
    return sorted;
  }, [allTeams, teamSearch, teamSort, rankMap, teamMeta]);

  const resetForm = () => {
    setNewName(""); setNewOrg(""); setNewPrize(""); setNewStart(""); setNewEnd("");
    setNewLocation(""); setNewTier("A");
    setCustomPointsEnabled(false); setCustomPoints({});
    setSelectedTeams([]); setTeamSearch("");
    setPhaseDrafts([{ name: "Playoffs", format: "single-elim", bo: 3, groupCount: 1, advanceCount: 0, seededCount: 0, teamCount: 0 }]);
    setIsQualifier(false);
    setQualScope("regional");
    setQualRegions(["EU"]);
    setQualSlots({ EU: 2, GLOBAL: 2 });
    setQualLinkedTo("");
  };

  const toggleQualRegion = (code: string) => {
    setQualRegions(prev => {
      const next = prev.includes(code) ? prev.filter(r => r !== code) : [...prev, code];
      setQualSlots(s => ({ ...s, [code]: s[code] ?? 2 }));
      return next;
    });
  };

  const toggleTeam = (name: string) => {
    setSelectedTeams(prev =>
      prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
    );
  };

  const seedRandom = () => setSelectedTeams(prev => shuffle(prev));

  const applyInvites = (mode: "replace" | "append") => {
    const config = {
      scope: inviteScope,
      slots: inviteScope === "global"
        ? { GLOBAL: inviteSlots.GLOBAL || 0 }
        : Object.fromEntries(Object.entries(inviteSlots).filter(([k]) => k !== "GLOBAL")),
      exclude: mode === "append" ? selectedTeams : [],
    };
    const suggestions = suggestInvites(config);
    const names = suggestions.map(s => s.team);
    if (names.length === 0) {
      toast({ title: "Brak sugestii", description: "Sprawdź konfigurację slotów.", variant: "destructive" });
      return;
    }
    setSelectedTeams(prev => mode === "replace" ? names : [...prev, ...names.filter(n => !prev.includes(n))]);
    toast({
      title: mode === "replace" ? "Zaproszenia ustawione" : "Dodano zaproszenia",
      description: `${names.length} drużyn z rankingu`,
    });
  };

  const toggleInviteRegion = (code: string) => {
    setInviteSlots(prev => {
      const next = { ...prev };
      if (next[code] !== undefined && code !== "GLOBAL") delete next[code];
      else if (code !== "GLOBAL") next[code] = 2;
      return next;
    });
  };

  const moveSeed = (idx: number, dir: -1 | 1) => {
    setSelectedTeams(prev => {
      const next = [...prev];
      const tgt = idx + dir;
      if (tgt < 0 || tgt >= next.length) return prev;
      [next[idx], next[tgt]] = [next[tgt], next[idx]];
      return next;
    });
  };

  const addPhaseDraft = () => {
    setPhaseDrafts(prev => [
      ...prev,
      { name: `Phase ${prev.length + 1}`, format: "single-elim", bo: 3, groupCount: 2, advanceCount: 4, seededCount: 0, teamCount: 0 },
    ]);
  };

  const updatePhaseDraft = (idx: number, patch: Partial<PhaseDraft>) => {
    setPhaseDrafts(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
  };

  const removePhaseDraft = (idx: number) => {
    setPhaseDrafts(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreate = () => {
    if (!newName.trim() || selectedTeams.length < 2 || phaseDrafts.length === 0) return;

    // Build phases sequentially. For each phase we may pre-seed a configurable
    // number of real teams; remaining slots are filled with TBD placeholders
    // (which can be assigned later via the seeding panel on the phase).
    const phases: TournamentPhase[] = [];
    let teamsForPhase = [...selectedTeams];
    phaseDrafts.forEach((draft, idx) => {
      // Determine the size of this phase.
      // Default = number of incoming teams (selectedTeams for phase 0, or previous advanceCount).
      const incomingSize = teamsForPhase.length;
      const phaseSize = draft.teamCount > 0 ? draft.teamCount : incomingSize;

      // Number of "real" (known) teams that go into this phase. The rest are TBD.
      // - If seededCount is set, use it (capped to phaseSize).
      // - Otherwise, use as many incoming teams as fit.
      const realCount = draft.seededCount > 0
        ? Math.min(draft.seededCount, phaseSize, incomingSize)
        : Math.min(incomingSize, phaseSize);

      const realPart = teamsForPhase.slice(0, realCount);
      const tbdPart = Array.from(
        { length: Math.max(0, phaseSize - realCount) },
        (_, i) => `TBD-P${idx}-${i + 1}`,
      );
      const phaseTeams = [...realPart, ...tbdPart];

      const phase = buildPhase(draft.name, draft.format, phaseTeams, {
        bo: draft.bo,
        groupCount: draft.groupCount,
        advanceCount: draft.advanceCount,
        groupAssignment: draft.groupAssignment ?? "random",
      });
      phases.push(phase);
      if (idx < phaseDrafts.length - 1) {
        const nextCount = draft.advanceCount || phaseTeams.length;
        teamsForPhase = Array.from({ length: nextCount }, (_, i) => `TBD-${idx}-${i + 1}`);
      }
    });

    let qualifierConfig: QualifierConfig | undefined;
    if (isQualifier) {
      const regs = qualScope === "global" ? ["GLOBAL"] : qualRegions;
      const slots: Record<string, number> = {};
      regs.forEach(r => { slots[r] = Math.max(1, qualSlots[r] ?? 1); });
      qualifierConfig = {
        scope: qualScope,
        regions: regs,
        slotsPerRegion: slots,
        linkedTournamentId: qualLinkedTo || undefined,
        promotedTeams: [],
      };
    }

    const t: TournamentData = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: newName.trim(),
      organizer: newOrg.trim(),
      prizePool: newPrize.trim() || "$0",
      startDate: newStart,
      endDate: newEnd,
      location: newLocation.trim(),
      tier: newTier,
      teams: selectedTeams.length,
      format: phaseDrafts.map(p => formatLabel(p.format)).join(" → "),
      status: "upcoming",
      participants: selectedTeams,
      phases,
      placements: [],
      kind: isQualifier ? "qualifier" : "main",
      qualifierConfig,
      customPoints: customPointsEnabled ? customPoints : undefined,
    };
    setTournaments(prev => [t, ...prev]);
    resetForm();
    setShowCreate(false);
  };

  /**
   * Resync downstream bracket matches based on every source's current winner/loser.
   * Each downstream slot is "owned" by the upstream that feeds it (winnerTo / loserTo).
   * If upstream is decided → write its winner/loser into the slot it owns.
   * If upstream is undecided (no score / draw) → clear the owned slot + reset its scores.
   * This prevents the "stale team in semifinal after fixing the quarterfinal" bug.
   */
  const propagateBracket = (bracket: MatchResult[]): MatchResult[] => {
    // Build map: targetMatchId → array of { ownerSlot: "team1"|"team2", source }
    // We don't know which slot in the target each source feeds, so we assign them
    // deterministically: among all sources targeting one match, the first goes to
    // team1, the second to team2 (insertion-order stable).
    const winnerInputs: Record<string, MatchResult[]> = {};
    const loserInputs: Record<string, MatchResult[]> = {};
    bracket.forEach(src => {
      if (src.winnerTo) {
        if (!winnerInputs[src.winnerTo]) winnerInputs[src.winnerTo] = [];
        winnerInputs[src.winnerTo].push(src);
      }
      if (src.loserTo) {
        if (!loserInputs[src.loserTo]) loserInputs[src.loserTo] = [];
        loserInputs[src.loserTo].push(src);
      }
    });

    const decidedWinner = (m: MatchResult): string | null => {
      if (!m.team1 || !m.team2) return null;
      if (m.team1 === "BYE") return m.team2 && m.team2 !== "BYE" ? m.team2 : null;
      if (m.team2 === "BYE") return m.team1 !== "BYE" ? m.team1 : null;
      const tot = (m.score1 || 0) + (m.score2 || 0);
      if (tot === 0 || m.score1 === m.score2) return null;
      return m.score1 > m.score2 ? m.team1 : m.team2;
    };
    const decidedLoser = (m: MatchResult): string | null => {
      if (!m.team1 || !m.team2) return null;
      if (m.team1 === "BYE" || m.team2 === "BYE") return null;
      const tot = (m.score1 || 0) + (m.score2 || 0);
      if (tot === 0 || m.score1 === m.score2) return null;
      return m.score1 > m.score2 ? m.team2 : m.team1;
    };

    return bracket.map(target => {
      const wIn = winnerInputs[target.id] || [];
      const lIn = loserInputs[target.id] || [];
      // No upstream feed → leave as-is (manual seeding / first round)
      if (wIn.length === 0 && lIn.length === 0) return target;

      const slots: (string | "")[] = [];
      wIn.forEach(s => slots.push(decidedWinner(s) || ""));
      lIn.forEach(s => slots.push(decidedLoser(s) || ""));

      // Pad to 2 slots
      while (slots.length < 2) slots.push("");

      const next = { ...target };
      const newT1 = slots[0];
      const newT2 = slots[1];
      // Only mutate if changed; if changed, reset scores
      if (next.team1 !== newT1 || next.team2 !== newT2) {
        next.team1 = newT1;
        next.team2 = newT2;
        next.score1 = 0;
        next.score2 = 0;
      }
      return next;
    });
  };

  const updatePhaseMatch = (
    tournamentId: string,
    phaseId: string,
    matchId: string,
    patch: Partial<MatchResult>,
    groupId?: string,
  ) => {
    setTournaments(prev => prev.map(t => {
      if (t.id !== tournamentId) return t;
      return {
        ...t,
        phases: t.phases.map(p => {
          if (p.id !== phaseId) return p;
          if (groupId && p.groups) {
            return {
              ...p,
              groups: p.groups.map(g => {
                if (g.id !== groupId) return g;
                let nextMatches = g.matches.map(m => m.id !== matchId ? m : { ...m, ...patch });
                // Auto-propagate winners/losers within IEM-DE groups
                if (p.format === "gsl-de-groups") {
                  nextMatches = propagateGSLDEGroup([...nextMatches]);
                }
                return { ...g, matches: nextMatches };
              }),
            };
          }
          if (p.bracket) {
            const updated = p.bracket.map(m => m.id !== matchId ? m : { ...m, ...patch });
            // Run propagation to convergence (a fix in R1 may cascade through R2, R3...)
            let curr = updated;
            for (let i = 0; i < 10; i++) {
              const next = propagateBracket(curr);
              if (JSON.stringify(next) === JSON.stringify(curr)) break;
              curr = next;
            }
            return { ...p, bracket: curr };
          }
          return p;
        }),
      };
    }));
  };

  /** Manually assign a team to a TBD slot in any phase's first round (or any match) */
  const assignSeed = (
    tournamentId: string,
    phaseId: string,
    matchId: string,
    slot: "team1" | "team2",
    team: string,
    groupId?: string,
  ) => {
    updatePhaseMatch(tournamentId, phaseId, matchId, { [slot]: team } as Partial<MatchResult>, groupId);
  };

  /** Reseed an entire phase from a list of teams (rebuilds first-round pairings only for bracket; replaces team list for groups). */
  const reseedPhase = (tournamentId: string, phaseId: string, teams: string[]) => {
    setTournaments(prev => prev.map(t => {
      if (t.id !== tournamentId) return t;
      return {
        ...t,
        phases: t.phases.map(p => {
          if (p.id !== phaseId) return p;
          // Bracket: assign teams to first-round matches in pairs
          if (p.bracket && p.bracket.length > 0) {
            // Identify first round (preserve insertion order)
            const firstRound = p.bracket[0].round;
            const firstRoundIds = p.bracket.filter(m => m.round === firstRound).map(m => m.id);
            const newBracket = p.bracket.map(m => {
              const idx = firstRoundIds.indexOf(m.id);
              if (idx === -1) return m;
              const t1 = teams[idx * 2] ?? "";
              const t2 = teams[idx * 2 + 1] ?? "";
              return { ...m, team1: t1, team2: t2, score1: 0, score2: 0 };
            });
            return { ...p, teams: [...teams], bracket: newBracket };
          }
          return { ...p, teams: [...teams] };
        }),
      };
    }));
  };

  /** Manually assign teams to specific groups in a phase. Rebuilds each group's matches. */
  const assignGroups = (
    tournamentId: string,
    phaseId: string,
    assignment: Record<string, string[]>,
  ) => {
    setTournaments(prev => prev.map(t => {
      if (t.id !== tournamentId) return t;
      return {
        ...t,
        phases: t.phases.map(p => {
          if (p.id !== phaseId || !p.groups) return p;
          return {
            ...p,
            groups: p.groups.map(g => {
              const newTeams = assignment[g.id] ?? g.teams;
              return {
                ...g,
                teams: [...newTeams],
                matches: rebuildGroupMatches(p.format, newTeams, p.bo, p.advanceCount && p.groups ? Math.max(1, Math.ceil(p.advanceCount / p.groups.length)) : 2),
              };
            }),
          };
        }),
      };
    }));
  };

  /** Random snake-seed shuffle of all participants across this phase's groups. */
  const shuffleGroups = (tournamentId: string, phaseId: string) => {
    setTournaments(prev => prev.map(t => {
      if (t.id !== tournamentId) return t;
      return {
        ...t,
        phases: t.phases.map(p => {
          if (p.id !== phaseId || !p.groups) return p;
          const pool = shuffle(p.teams.length > 0 ? [...p.teams] : [...t.participants]);
          const distributed = distributeIntoGroups(pool, p.groups.length);
          return {
            ...p,
            groups: p.groups.map((g, i) => ({
              ...g,
              teams: distributed[i],
              matches: rebuildGroupMatches(p.format, distributed[i], p.bo, p.advanceCount && p.groups ? Math.max(1, Math.ceil(p.advanceCount / p.groups.length)) : 2),
            })),
          };
        }),
      };
    }));
  };

  const deleteBracketMatch = (tournamentId: string, phaseId: string, matchId: string) => {
    setTournaments(prev => prev.map(t => {
      if (t.id !== tournamentId) return t;
      return {
        ...t,
        phases: t.phases.map(p => p.id !== phaseId ? p : {
          ...p,
          bracket: p.bracket?.filter(m => m.id !== matchId),
        }),
      };
    }));
  };

  const addBracketMatch = (tournamentId: string, phaseId: string, round: string) => {
    const newMatch: MatchResult = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      team1: "",
      team2: "",
      score1: 0,
      score2: 0,
      round,
      bo: 3,
    };
    setTournaments(prev => prev.map(t => {
      if (t.id !== tournamentId) return t;
      return {
        ...t,
        phases: t.phases.map(p => {
          if (p.id !== phaseId) return p;
          newMatch.bo = p.bo;
          return { ...p, bracket: [...(p.bracket || []), newMatch] };
        }),
      };
    }));
  };

  /** Bulk-add bracket matches with given teams (used for Swiss next-round generation). */
  const addBracketMatches = (
    tournamentId: string,
    phaseId: string,
    matches: { team1: string; team2: string; bo: 1 | 3 | 5; round: string }[],
  ) => {
    setTournaments(prev => prev.map(t => {
      if (t.id !== tournamentId) return t;
      return {
        ...t,
        phases: t.phases.map(p => {
          if (p.id !== phaseId) return p;
          const created: MatchResult[] = matches.map((m, i) => ({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + i,
            team1: m.team1,
            team2: m.team2,
            score1: 0,
            score2: 0,
            round: m.round,
            bo: m.bo,
          }));
          return { ...p, bracket: [...(p.bracket || []), ...created] };
        }),
      };
    }));
  };


  const moveBracketMatch = (tournamentId: string, phaseId: string, matchId: string, dir: -1 | 1) => {
    setTournaments(prev => prev.map(t => {
      if (t.id !== tournamentId) return t;
      return {
        ...t,
        phases: t.phases.map(p => {
          if (p.id !== phaseId || !p.bracket) return p;
          const idx = p.bracket.findIndex(m => m.id === matchId);
          const tgt = idx + dir;
          if (idx === -1 || tgt < 0 || tgt >= p.bracket.length) return p;
          const next = [...p.bracket];
          [next[idx], next[tgt]] = [next[tgt], next[idx]];
          return { ...p, bracket: next };
        }),
      };
    }));
  };

  const deriveFinalPlacements = (t: TournamentData) => {
    const placements: TournamentData["placements"] = [];
    const placed = new Set<string>();
    const add = (team: string, placement: number) => {
      if (!isRealTeam(team) || placed.has(team)) return;
      placements.push({
        team,
        placement,
        points: resolvePoints(t, placement),
      });
      placed.add(team);
    };
    const bracket = [...(t.phases[t.phases.length - 1]?.bracket || [])];
    const rounds = Array.from(new Set(bracket.map(m => m.round || "Match")));
    const finalRound = rounds.find(r => /grand\s*final/i.test(r)) || rounds.find(r => /^final$/i.test(r)) || rounds.find(r => /final/i.test(r)) || rounds[rounds.length - 1];
    bracket.filter(m => (m.round || "Match") === finalRound).forEach(m => { add(matchWinner(m), 1); add(matchLoser(m), 2); });
    const semiRound = rounds.find(r => /semi/i.test(r));
    if (semiRound) bracket.filter(m => m.round === semiRound).forEach(m => add(matchLoser(m), 3));
    for (let i = rounds.length - 1; i >= 0; i--) {
      bracket.filter(m => (m.round || "Match") === rounds[i]).forEach(m => add(matchLoser(m), placements.length + 1));
    }
    t.participants.forEach(team => add(team, placements.length + 1));
    return placements.sort((a, b) => a.placement - b.placement);
  };

  const confirmTournamentResults = async (id: string) => {
    const source = tournaments.find(t => t.id === id);
    if (!source || source.resultsConfirmed) return;
    const placements = source.placements?.length ? source.placements : deriveFinalPlacements(source);
    const finalized: TournamentData = { ...source, status: "completed", placements, resultsConfirmed: true, finalizedAt: new Date().toISOString() };
    const next = tournaments.map(t => t.id === id ? finalized : t);
    const saved = await saveToStorageAsync(STORAGE_KEY, next);
    if (saved) {
      setTournaments(next);
      const ranking = loadFromStorage<typeof teamDatabase | null>("ranking_data", null) || teamDatabase.map(t => ({ ...t }));
      const placements = finalized.placements || [];
      await saveToStorageAsync("ranking_data", ranking.map(team => {
        const earned = placements.find(p => p.team === team.name)?.points || 0;
        return earned ? { ...team, points: Math.max(0, team.points + earned) } : team;
      }));
      toast({ title: "Wyniki zatwierdzone", description: "Turniej zapisany, a statystyki trafiły do profili drużyn i graczy." });
    } else {
      toast({ title: "Nie udało się zapisać", description: "Pamięć przeglądarki jest pełna — zrób backup i usuń stare dane.", variant: "destructive" });
    }
  };

  const handleSetStatus = (id: string, status: "upcoming" | "live" | "completed") => {
    setTournaments(prev => prev.map(t => {
      if (t.id !== id) return t;
      // Auto-news on status transition
      if (t.status !== status) {
        import("@/lib/autoNews").then(async (m) => {
          if (status === "live") m.announceTournamentStarted(t.name, t.tier, t.teams);
          if (status === "completed") {
            // Try to find winner from final bracket match
            let winner: string | null = null;
            let runnerUp: string | null = null;
            for (const phase of t.phases) {
              if (phase.bracket && phase.bracket.length > 0) {
                const finals = phase.bracket.filter(x => (x.round || "").toLowerCase().includes("final") && !(x.round || "").toLowerCase().includes("lower"));
                const last = finals[finals.length - 1] || phase.bracket[phase.bracket.length - 1];
                if (last && last.score1 + last.score2 > 0) {
                  winner = last.score1 > last.score2 ? last.team1 : last.team2;
                  runnerUp = last.score1 > last.score2 ? last.team2 : last.team1;
                }
              }
            }
            m.announceTournamentFinished(t.name, t.tier, winner, runnerUp);
            // Auto AI recap pack (recap + MVP + power-ranking + hot-take)
            try {
              const { teamDatabase } = await import("@/data/tournaments");
              const { getAllTransfers } = await import("@/data/history");
              const { playerRoles } = await import("@/data/playerRoles");
              const { computeCareerStats } = await import("@/lib/playerCareerStats");
              const topTeams = [...teamDatabase].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 10);
              const topPlayers: { player: string; team: string; rating: number; role?: string }[] = [];
              for (const team of topTeams.slice(0, 8)) {
                let best: { player: string; rating: number } | null = null;
                for (const p of team.roster || []) {
                  try {
                    const cs = computeCareerStats(p);
                    if (cs.matchesPlayed > 0 && (!best || cs.careerRating > best.rating)) {
                      best = { player: p, rating: cs.careerRating };
                    }
                  } catch { /* ignore */ }
                }
                if (best) topPlayers.push({ player: best.player, team: team.name, rating: best.rating, role: playerRoles[best.player] });
              }
              const transfers = getAllTransfers().slice(-15).reverse();
              await m.generateTournamentRecap(t.name, t.tier, winner, runnerUp, {
                topTeams: topTeams.map(tt => ({ name: tt.name, points: tt.points || 0, country: tt.country })),
                recentTransfers: transfers.map(tr => ({ player: tr.player, oldTeam: tr.oldTeam, newTeam: tr.newTeam })),
                tournaments: [{ name: t.name, status: "completed", tier: t.tier, teams: t.teams, winner, runnerUp }],
                topPlayers,
              });
            } catch (e) {
              console.warn("Auto recap failed:", e);
            }
          }
        });

      }
      return { ...t, status };
    }));
  };

  const handleDelete = (id: string) => {
    setTournaments(prev => prev.filter(t => t.id !== id));
  };

  const handlePromoteWinners = (qualifierId: string, winners: string[], targetId: string) => {
    setTournaments(prev => prev.map(t => {
      if (t.id === qualifierId && t.qualifierConfig) {
        return {
          ...t,
          qualifierConfig: {
            ...t.qualifierConfig,
            linkedTournamentId: targetId,
            promotedTeams: Array.from(new Set([...(t.qualifierConfig.promotedTeams || []), ...winners])),
          },
        };
      }
      if (t.id === targetId) {
        const newParticipants = [...t.participants];
        winners.forEach(w => { if (!newParticipants.includes(w)) newParticipants.push(w); });
        return { ...t, participants: newParticipants, teams: newParticipants.length };
      }
      return t;
    }));
  };

  const tierColor = (tier: string) => {
    switch (tier) {
      case "S": return "text-[hsl(var(--gold))] border-[hsl(var(--gold))]/40 bg-[hsl(var(--gold))]/10";
      case "A": return "text-primary border-primary/40 bg-primary/10";
      case "B": return "text-[hsl(var(--silver))] border-[hsl(var(--silver))]/40 bg-[hsl(var(--silver))]/10";
      default: return "text-muted-foreground border-border bg-secondary/50";
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "live": return "bg-[hsl(var(--win))]/20 text-[hsl(var(--win))] border-[hsl(var(--win))]/40";
      case "completed": return "bg-muted text-muted-foreground border-border";
      default: return "bg-primary/10 text-primary border-primary/30";
    }
  };

  const statusLabel = (s: string) => s === "live" ? "W trakcie" : s === "completed" ? "Zakończony" : "Nadchodzący";

  const selectedTournament = selectedId ? tournaments.find(t => t.id === selectedId) ?? null : null;

  const saveTournamentScroll = (tournamentId: string) => {
    try {
      sessionStorage.setItem(`tour-scroll-${tournamentId}`, String(window.scrollY));
    } catch { /* session storage unavailable */ }
  };

  // Find the currently-selected match (for MatchDetailPage)
  const selectedMatchInfo = useMemo(() => {
    if (!selectedTournament || !selectedMatchRef) return null;
    const phase = selectedTournament.phases.find(p => p.id === selectedMatchRef.phaseId);
    if (!phase) return null;
    let match: MatchResult | undefined;
    if (selectedMatchRef.groupId && phase.groups) {
      const g = phase.groups.find(g => g.id === selectedMatchRef.groupId);
      match = g?.matches.find(m => m.id === selectedMatchRef.matchId);
    } else if (phase.bracket) {
      match = phase.bracket.find(m => m.id === selectedMatchRef.matchId);
    }
    if (!match) return null;
    return { match, phaseName: phase.name, bo: (match.bo || phase.bo) as 1 | 3 | 5 };
  }, [selectedTournament, selectedMatchRef]);

  return (
    <>
    {selectedTournament && selectedMatchInfo ? (
      <MatchDetailPage
        match={selectedMatchInfo.match}
        phaseName={selectedMatchInfo.phaseName}
        bo={selectedMatchInfo.bo}
        tournamentId={selectedTournament.id}
        onBack={() => setSelectedMatchRef(null)}
        onUpdate={(patch) => updatePhaseMatch(
          selectedTournament.id,
          selectedMatchRef!.phaseId,
          selectedMatchRef!.matchId,
          patch,
          selectedMatchRef!.groupId,
        )}
        onConfirm={async (winner, loser, pw, pl) => {
          const ranking = loadFromStorage<typeof teamDatabase | null>("ranking_data", null) || teamDatabase.map(x => ({ ...x }));
          const updated = ranking.map(team => {
            if (team.name === winner) return { ...team, points: Math.max(0, (team.points || 0) + pw) };
            if (team.name === loser) return { ...team, points: Math.max(0, (team.points || 0) - pl) };
            return team;
          });
          await saveToStorageAsync("ranking_data", updated);
        }}
      />
    ) : selectedTournament ? (
      <TournamentDetailPage
        tournament={selectedTournament}
        allTeams={allTeams}
        onBack={() => { setSelectedId(null); setSelectedMatchRef(null); }}
        onUpdateMatch={(phaseId, matchId, patch, groupId) =>
          updatePhaseMatch(selectedTournament.id, phaseId, matchId, patch, groupId)
        }
        onDeleteBracketMatch={(phaseId, matchId) =>
          deleteBracketMatch(selectedTournament.id, phaseId, matchId)
        }
        onAddBracketMatch={(phaseId, round) =>
          addBracketMatch(selectedTournament.id, phaseId, round)
        }
        onAddBracketMatches={(phaseId, matches) =>
          addBracketMatches(selectedTournament.id, phaseId, matches)
        }
        onMoveBracketMatch={(phaseId, matchId, dir) =>
          moveBracketMatch(selectedTournament.id, phaseId, matchId, dir)
        }
        onReseedPhase={(phaseId, teams) =>
          reseedPhase(selectedTournament.id, phaseId, teams)
        }
        onAssignGroups={(phaseId, assignment) =>
          assignGroups(selectedTournament.id, phaseId, assignment)
        }
        onShuffleGroups={(phaseId) =>
          shuffleGroups(selectedTournament.id, phaseId)
        }
        onSetStatus={(s) => handleSetStatus(selectedTournament.id, s)}
        onConfirmResults={() => confirmTournamentResults(selectedTournament.id)}
        onDelete={() => handleDelete(selectedTournament.id)}
        onOpenMatch={(phaseId, matchId, groupId) => {
          saveTournamentScroll(selectedTournament.id);
          setActivePhaseByTournament(prev => ({ ...prev, [selectedTournament.id]: phaseId }));
          setSelectedMatchRef({ phaseId, matchId, groupId });
        }}
        activePhaseId={activePhaseByTournament[selectedTournament.id]}
        onActivePhaseChange={(phaseId) => setActivePhaseByTournament(prev => ({ ...prev, [selectedTournament.id]: phaseId }))}
        mainTournaments={tournaments.filter(x => x.kind !== "qualifier" && x.id !== selectedTournament.id)}
        onPromoteWinners={(winners, targetId) => handlePromoteWinners(selectedTournament.id, winners, targetId)}
      />
    ) : (
    <section>
      <div className="container mx-auto">
        <TournamentPortal
          tournaments={tournaments}
          onSelect={(id) => setSelectedId(id)}
          onCreate={() => setShowCreate(true)}
        />

        {/* CREATE DIALOG */}
        <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) resetForm(); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading">Kreator turnieju</DialogTitle>
            </DialogHeader>

            <div className="space-y-5 pt-2">
              {/* Meta */}
              <section className="space-y-3">
                <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider">1. Podstawowe info</h3>
                <Input placeholder="Nazwa turnieju..." value={newName} onChange={e => setNewName(e.target.value)} />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Organizator..." value={newOrg} onChange={e => setNewOrg(e.target.value)} />
                  <Input placeholder="Pula nagród (np. $500,000)..." value={newPrize} onChange={e => setNewPrize(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="date" value={newStart} onChange={e => setNewStart(e.target.value)} />
                  <Input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Lokalizacja..." value={newLocation} onChange={e => setNewLocation(e.target.value)} />
                  <select
                    value={newTier}
                    onChange={e => setNewTier(e.target.value as "S" | "A" | "B" | "C")}
                    className="px-3 py-2 rounded-md bg-card border border-border text-foreground text-sm font-mono"
                  >
                    <option value="S">Tier S</option>
                    <option value="A">Tier A</option>
                    <option value="B">Tier B</option>
                    <option value="C">Tier C</option>
                  </select>
                </div>
              </section>

              {/* Custom points */}
              <section className="space-y-2 border border-border rounded-md p-3 bg-secondary/20">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customPointsEnabled}
                    onChange={e => {
                      setCustomPointsEnabled(e.target.checked);
                      if (e.target.checked && Object.keys(customPoints).length === 0) {
                        const defaults: Record<string, number> = {};
                        const n = Math.max(2, selectedTeams.length || 2);
                        for (let p = 1; p <= n; p++) defaults[String(p)] = getDefaultPoints(newTier, p);
                        setCustomPoints(defaults);
                      }
                    }}
                    className="accent-primary"
                  />
                  <span className="text-xs font-heading font-bold uppercase text-primary tracking-wider">
                    Ręczny przydział punktów za miejsca (per miejsce)
                  </span>
                </label>
                {customPointsEnabled && (
                  <>
                    <p className="text-[10px] font-mono text-muted-foreground">
                      Po zatwierdzeniu wyników drużyny dostaną tu ustawione punkty. Puste pole = wartość domyślna dla tieru.
                      Liczba miejsc = liczba uczestników ({selectedTeams.length}).
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-60 overflow-y-auto pr-1">
                      {Array.from({ length: Math.max(0, selectedTeams.length) }, (_, i) => i + 1).map(p => (
                        <div key={p} className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-muted-foreground w-10 shrink-0">
                            #{p}
                          </span>
                          <Input
                            type="number"
                            value={customPoints[String(p)] ?? ""}
                            placeholder={String(getDefaultPoints(newTier, p))}
                            onChange={e => {
                              const v = e.target.value;
                              setCustomPoints(prev => {
                                const next = { ...prev };
                                if (v === "") delete next[String(p)];
                                else next[String(p)] = parseInt(v, 10) || 0;
                                return next;
                              });
                            }}
                            className="h-7 text-xs font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              {/* Participants */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider">
                    2. Uczestnicy ({selectedTeams.length})
                  </h3>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={seedRandom} disabled={selectedTeams.length < 2}>
                    <Shuffle className="w-3 h-3" /> Losuj rozstawienie
                  </Button>
                </div>
                {selectedTeams.length > 0 && (
                  <div className="bg-secondary/30 border border-border rounded-md p-2">
                    <p className="text-[10px] font-mono text-muted-foreground mb-1.5">
                      Rozstawienie (kolejność = seed). Użyj ↑↓ aby przesunąć, ✕ aby usunąć:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {selectedTeams.map((t, i) => (
                        <div
                          key={t}
                          className="flex items-center gap-1 bg-card border border-border rounded px-2 py-1"
                        >
                          <span className="text-[10px] font-mono text-primary w-6 shrink-0">#{i + 1}</span>
                          <span className="text-[11px] font-mono flex-1 truncate text-foreground">{t}</span>
                          <button
                            onClick={() => moveSeed(i, -1)}
                            disabled={i === 0}
                            className="text-muted-foreground hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed"
                            title="W górę"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => moveSeed(i, 1)}
                            disabled={i === selectedTeams.length - 1}
                            className="text-muted-foreground hover:text-primary disabled:opacity-20 disabled:cursor-not-allowed"
                            title="W dół"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => toggleTeam(t)}
                            className="text-muted-foreground hover:text-destructive"
                            title="Usuń"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    placeholder={`Szukaj drużyny... (${filteredTeams.length}/${allTeams.length})`}
                    value={teamSearch}
                    onChange={e => setTeamSearch(e.target.value)}
                    className="flex-1"
                  />
                  <select
                    value={teamSort}
                    onChange={e => setTeamSort(e.target.value as typeof teamSort)}
                    className="px-2 py-2 rounded-md bg-card border border-border text-foreground text-xs font-mono"
                    title="Sortuj drużyny"
                  >
                    <option value="rank">Sort: Ranking ↑</option>
                    <option value="points-desc">Sort: Punkty ↓</option>
                    <option value="points-asc">Sort: Punkty ↑</option>
                    <option value="name">Sort: Nazwa A→Z</option>
                    <option value="region">Sort: Region</option>
                    <option value="country">Sort: Kraj</option>
                  </select>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                  <span>Pokazano: {filteredTeams.length}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTeams(prev => Array.from(new Set([...prev, ...filteredTeams])))}
                      className="text-primary hover:underline"
                    >
                      + dodaj wszystkie widoczne
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTeams([])}
                      className="text-destructive hover:underline"
                    >
                      wyczyść wybór
                    </button>
                  </div>
                </div>
                <div className="max-h-[420px] overflow-y-auto border border-border rounded-md p-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 bg-card/50">
                  {filteredTeams.map(name => {
                    const checked = selectedTeams.includes(name);
                    const meta = teamMeta.get(name);
                    const rank = rankMap.get(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleTeam(name)}
                        className={cn(
                          "text-[11px] text-left px-2 py-1.5 rounded font-mono transition-colors flex items-center gap-1.5 min-w-0",
                          checked
                            ? "bg-primary/20 text-primary border border-primary/40"
                            : "bg-secondary/30 text-muted-foreground hover:bg-secondary/60 border border-transparent"
                        )}
                        title={meta ? `${name} • #${rank} • ${meta.points} pkt • ${meta.region}` : name}
                      >
                        {rank && (
                          <span className={cn(
                            "text-[9px] tabular-nums shrink-0 px-1 rounded",
                            rank <= 10 ? "bg-[hsl(var(--gold))]/20 text-[hsl(var(--gold))]" :
                            rank <= 30 ? "bg-primary/20 text-primary" :
                            "bg-muted/40 text-muted-foreground"
                          )}>#{rank}</span>
                        )}
                        <span className="truncate flex-1">{checked ? "✓ " : ""}{name}</span>
                      </button>
                    );
                  })}
                  {filteredTeams.length === 0 && (
                    <p className="col-span-full text-center text-xs font-mono text-muted-foreground py-6">
                      Brak drużyn pasujących do filtra.
                    </p>
                  )}
                </div>

              </section>

              {/* Qualifier toggle & config */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider">
                    3. Typ wydarzenia
                  </h3>
                  <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isQualifier}
                      onChange={e => setIsQualifier(e.target.checked)}
                      className="accent-primary"
                    />
                    To jest kwalifikacja
                  </label>
                </div>
                {isQualifier && (
                  <div className="bg-secondary/30 border border-border rounded-md p-3 space-y-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setQualScope("global")}
                        className={cn(
                          "flex-1 px-3 py-2 rounded text-xs font-mono border transition-colors",
                          qualScope === "global"
                            ? "bg-primary/15 text-primary border-primary/40"
                            : "bg-card text-muted-foreground border-border hover:text-foreground"
                        )}
                      >
                        🌍 Globalna (wszyscy razem)
                      </button>
                      <button
                        onClick={() => setQualScope("regional")}
                        className={cn(
                          "flex-1 px-3 py-2 rounded text-xs font-mono border transition-colors",
                          qualScope === "regional"
                            ? "bg-primary/15 text-primary border-primary/40"
                            : "bg-card text-muted-foreground border-border hover:text-foreground"
                        )}
                      >
                        📍 Regionalna (osobne sloty)
                      </button>
                    </div>

                    {qualScope === "regional" ? (
                      <div className="space-y-2">
                        <p className="text-[10px] font-mono text-muted-foreground">
                          Wybierz regiony i liczbę slotów awansu z każdego:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {REGIONS.map(r => {
                            const active = qualRegions.includes(r.code);
                            return (
                              <div key={r.code} className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded border",
                                active ? "bg-primary/10 border-primary/30" : "bg-card border-border"
                              )}>
                                <label className="flex items-center gap-2 flex-1 cursor-pointer text-xs font-mono">
                                  <input
                                    type="checkbox"
                                    checked={active}
                                    onChange={() => toggleQualRegion(r.code)}
                                    className="accent-primary"
                                  />
                                  <span className={active ? "text-foreground" : "text-muted-foreground"}>
                                    {r.label} <span className="text-[10px] opacity-60">({r.code})</span>
                                  </span>
                                </label>
                                {active && (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      min="1"
                                      value={qualSlots[r.code] ?? 1}
                                      onChange={e => setQualSlots(s => ({ ...s, [r.code]: parseInt(e.target.value) || 1 }))}
                                      className="w-14 h-7 text-center text-xs"
                                    />
                                    <span className="text-[10px] font-mono text-muted-foreground">slot</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-mono text-muted-foreground">Liczba slotów awansu:</label>
                        <Input
                          type="number"
                          min="1"
                          value={qualSlots.GLOBAL ?? 2}
                          onChange={e => setQualSlots(s => ({ ...s, GLOBAL: parseInt(e.target.value) || 1 }))}
                          className="w-20 h-7 text-center text-xs"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block mb-1">
                        Powiązany turniej główny (opcjonalnie)
                      </label>
                      <select
                        value={qualLinkedTo}
                        onChange={e => setQualLinkedTo(e.target.value)}
                        className="w-full px-2 py-1.5 rounded bg-card border border-border text-xs font-mono"
                      >
                        <option value="">— brak (wybierzesz później) —</option>
                        {tournaments.filter(x => x.kind !== "qualifier").map(x => (
                          <option key={x.id} value={x.id}>{x.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </section>

              {/* Phases */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider">
                    4. Fazy turnieju ({phaseDrafts.length})
                  </h3>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addPhaseDraft}>
                    <Plus className="w-3 h-3" /> Dodaj fazę
                  </Button>
                </div>
                <div className="space-y-3">
                  {phaseDrafts.map((draft, idx) => {
                    const showGroups = draft.format === "round-robin" || draft.format === "gsl-groups" || draft.format === "gsl-de-groups";
                    const showAdvance = idx < phaseDrafts.length - 1;
                    const isGSL4 = draft.format === "gsl-groups";
                    const isGSL8 = draft.format === "gsl-de-groups";
                    const teamsPerGroup = isGSL4 ? 4 : isGSL8 ? 8 : null;
                    const recommendedGroups = teamsPerGroup ? Math.max(1, Math.ceil(selectedTeams.length / teamsPerGroup)) : null;
                    return (
                      <div key={idx} className="bg-secondary/30 border border-border rounded-md p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0">FAZA {idx + 1}</span>
                          <Input
                            placeholder="Nazwa fazy (np. Group Stage, Playoffs)..."
                            value={draft.name}
                            onChange={e => updatePhaseDraft(idx, { name: e.target.value })}
                            className="h-8 text-sm flex-1"
                          />
                          {phaseDrafts.length > 1 && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removePhaseDraft(idx)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                              Format rozgrywki
                            </label>
                            <select
                              value={draft.format}
                              onChange={e => updatePhaseDraft(idx, { format: e.target.value as PhaseFormat })}
                              className="w-full px-2 py-1.5 rounded bg-card border border-border text-xs font-mono h-8"
                            >
                              {PHASE_FORMATS.map(f => (
                                <option key={f.value} value={f.value}>{f.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                              Best-of (długość serii)
                            </label>
                            <select
                              value={draft.bo}
                              onChange={e => updatePhaseDraft(idx, { bo: parseInt(e.target.value) as 1 | 3 | 5 })}
                              className="w-full px-2 py-1.5 rounded bg-card border border-border text-xs font-mono h-8"
                            >
                              <option value={1}>BO1 — 1 mapa</option>
                              <option value={3}>BO3 — do 2 wygranych map</option>
                              <option value={5}>BO5 — do 3 wygranych map</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {showGroups && (
                            <div className="space-y-1">
                              <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                                Liczba grup {teamsPerGroup && <span className="opacity-60">({teamsPerGroup} dr./grupę)</span>}
                              </label>
                              <Input
                                type="number"
                                min="1"
                                value={draft.groupCount}
                                onChange={e => updatePhaseDraft(idx, { groupCount: parseInt(e.target.value) || 1 })}
                                className="h-8 text-xs"
                              />
                              {recommendedGroups && (
                                <p className="text-[9px] font-mono text-muted-foreground">
                                  Sugerowane przy {selectedTeams.length} drużynach: {recommendedGroups}
                                </p>
                              )}
                            </div>
                          )}
                          {showAdvance && (
                            <div className="space-y-1">
                              <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                                Awans do następnej fazy
                              </label>
                              <Input
                                type="number"
                                min="1"
                                value={draft.advanceCount}
                                onChange={e => updatePhaseDraft(idx, { advanceCount: parseInt(e.target.value) || 0 })}
                                className="h-8 text-xs"
                                title="Ile drużyn z tej fazy przechodzi dalej"
                              />
                              <p className="text-[9px] font-mono text-muted-foreground">Liczba drużyn awansujących</p>
                            </div>
                          )}
                          <div className="space-y-1">
                            <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                              Pre-seedy (0 = wszystkie)
                            </label>
                            <Input
                              type="number"
                              min="0"
                              value={draft.seededCount}
                              onChange={e => updatePhaseDraft(idx, { seededCount: parseInt(e.target.value) || 0 })}
                              className="h-8 text-xs"
                              title="Ile drużyn jest już znanych w tej fazie. Reszta = TBD (np. zwycięzcy kwalifikacji)"
                            />
                            <p className="text-[9px] font-mono text-muted-foreground">Znanych drużyn (reszta TBD)</p>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                            Rozmiar fazy (0 = auto)
                          </label>
                          <Input
                            type="number"
                            min="0"
                            value={draft.teamCount}
                            onChange={e => updatePhaseDraft(idx, { teamCount: parseInt(e.target.value) || 0 })}
                            className="h-8 text-xs"
                            title="Łączna liczba slotów w tej fazie. Np. Swiss 16 drużyn = 8 rozstawionych + 8 z kwalifikacji."
                          />
                          <p className="text-[9px] font-mono text-muted-foreground">
                            {draft.format === "swiss"
                              ? `Łącznie drużyn w Swiss (np. 16 = ${Math.max(0, draft.teamCount - draft.seededCount)} TBD + ${draft.seededCount} rozstawionych)`
                              : "Łączna liczba slotów (puste = liczba uczestników)"}
                          </p>
                        </div>

                        {showGroups && (
                          <div className="space-y-1 pt-1 border-t border-border/40">
                            <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                              Przypisanie drużyn do grup
                            </label>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => updatePhaseDraft(idx, { groupAssignment: "random" })}
                                className={cn(
                                  "flex-1 px-2 py-1.5 rounded text-[11px] font-mono border transition-colors",
                                  (draft.groupAssignment ?? "random") === "random"
                                    ? "bg-primary/15 text-primary border-primary/40"
                                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                                )}
                              >
                                🎲 Losowo (snake seed)
                              </button>
                              <button
                                type="button"
                                onClick={() => updatePhaseDraft(idx, { groupAssignment: "manual" })}
                                className={cn(
                                  "flex-1 px-2 py-1.5 rounded text-[11px] font-mono border transition-colors",
                                  draft.groupAssignment === "manual"
                                    ? "bg-primary/15 text-primary border-primary/40"
                                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                                )}
                              >
                                ✋ Manualnie (po utworzeniu)
                              </button>
                            </div>
                            <p className="text-[9px] font-mono text-muted-foreground">
                              {draft.groupAssignment === "manual"
                                ? "Po utworzeniu turnieju przypiszesz drużyny do konkretnych grup."
                                : "Drużyny zostaną podzielone po seedingu (1 do A, 2 do B, 3 do A...)."}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] font-mono text-muted-foreground">
                  💡 Możesz łączyć fazy: np. <span className="text-primary">Swiss → Single Elim</span> (Major), <span className="text-primary">Round Robin → Double Elim</span>, <span className="text-primary">GSL Groups → Single Elim</span>.
                </p>
              </section>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => { setShowCreate(false); resetForm(); }}>Anuluj</Button>
              <Button
                onClick={handleCreate}
                disabled={!newName.trim() || selectedTeams.length < 2 || phaseDrafts.length === 0}
              >
                Utwórz turniej
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
    )}
    </>
  );
};

export default TournamentPanel;
