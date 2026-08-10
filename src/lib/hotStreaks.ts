// ===== Hot / Losing streaks =====
// Serie zwycięstw i porażek drużyn, serie map na konkretnej mapie oraz
// serie map z ratingiem 1.20+ dla graczy. Liczone z lokalnej bazy turniejów.

import type { TournamentData, MatchResult } from "./types";
import { loadFromStorage } from "./storage";
import { calculateRating } from "./playerStats";

export interface TeamStreak {
  team: string;
  count: number;
  /** ostatni mecz serii */
  lastDate?: string;
}

export interface MapStreak extends TeamStreak {
  map: string;
}

export interface PlayerStreak {
  player: string;
  team: string;
  count: number;
  lastDate?: string;
}

export interface StreakData {
  winStreaks: TeamStreak[];
  lossStreaks: TeamStreak[];
  mapStreaks: MapStreak[];
  playerStreaks: PlayerStreak[];
}

const RATING_THRESHOLD = 1.2;

const alias = (n: string): string => n.trim();

interface FlatMatch extends MatchResult {
  ts: number;
}

function timestamp(m: MatchResult): number {
  const raw = m.playedAt || m.scheduledAt;
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
}

function collectMatches(list: TournamentData[], skip: Set<string>): FlatMatch[] {
  const out: FlatMatch[] = [];
  for (const t of list) {
    const ms: MatchResult[] = [
      ...(t.phases || []).flatMap(p => [
        ...(p.bracket || []),
        ...((p.groups || []).flatMap(g => g.matches || [])),
      ]),
      ...(t.matches || []),
    ];
    for (const m of ms) {
      if (!m.team1 || !m.team2 || m.team2 === "BYE" || m.team1 === "BYE") continue;
      // Reprezentacje narodowe nie wchodzą do serii.
      if (skip.has(m.team1.trim()) || skip.has(m.team2.trim())) continue;
      if ((m.score1 || 0) + (m.score2 || 0) <= 0) continue;
      if (m.score1 === m.score2) continue;
      out.push({ ...m, ts: timestamp(m) });
    }
  }
  return out.sort((a, b) => a.ts - b.ts);
}


export function computeStreaks(): StreakData {
  const all = loadFromStorage<TournamentData[]>("tournaments_data", []) || [];
  const national = nationalTeamNames();
  const matches = collectMatches(all, national);


  const teamRun = new Map<string, { win: number; loss: number; last?: number }>();
  const mapRun = new Map<string, { count: number; last?: number }>();
  const playerRun = new Map<string, { count: number; team: string; last?: number }>();

  for (const m of matches) {
    const t1 = alias(m.team1);
    const t2 = alias(m.team2);
    const w = (m.score1 > m.score2 ? t1 : t2);
    const l = (m.score1 > m.score2 ? t2 : t1);

    const wr = teamRun.get(w) || { win: 0, loss: 0 };
    wr.win += 1; wr.loss = 0; wr.last = m.ts;
    teamRun.set(w, wr);

    const lr = teamRun.get(l) || { win: 0, loss: 0 };
    lr.loss += 1; lr.win = 0; lr.last = m.ts;
    teamRun.set(l, lr);

    // per-map series + player rating series
    for (const mp of m.maps || []) {
      const played = (mp.score1 || 0) + (mp.score2 || 0) > 0;
      if (!played || !mp.map) continue;
      const mapWinner = mp.score1 > mp.score2 ? t1 : t2;
      const mapLoser = mp.score1 > mp.score2 ? t2 : t1;
      const kw = `${mapWinner}|${mp.map}`;
      const kl = `${mapLoser}|${mp.map}`;
      const cur = mapRun.get(kw) || { count: 0 };
      cur.count += 1; cur.last = m.ts;
      mapRun.set(kw, cur);
      mapRun.set(kl, { count: 0, last: m.ts });

      const rounds = (mp.score1 || 0) + (mp.score2 || 0);
      const sides = [
        { list: mp.team1Players || [], team: t1 },
        { list: mp.team2Players || [], team: t2 },
      ];
      for (const side of sides) {
        for (const p of side.list) {
          if (!p?.playerName) continue;
          const rating = p.rating ?? calculateRating({ ...p, rounds });
          const prev = playerRun.get(p.playerName) || { count: 0, team: side.team };
          if (rating >= RATING_THRESHOLD) {
            playerRun.set(p.playerName, { count: prev.count + 1, team: side.team, last: m.ts });
          } else {
            playerRun.set(p.playerName, { count: 0, team: side.team, last: m.ts });
          }
        }
      }
    }
  }

  const fmt = (ts?: number) => (ts ? new Date(ts).toISOString().slice(0, 10) : undefined);

  const winStreaks: TeamStreak[] = [...teamRun.entries()]
    .filter(([, v]) => v.win >= 3)
    .map(([team, v]) => ({ team, count: v.win, lastDate: fmt(v.last) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const lossStreaks: TeamStreak[] = [...teamRun.entries()]
    .filter(([, v]) => v.loss >= 3)
    .map(([team, v]) => ({ team, count: v.loss, lastDate: fmt(v.last) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const mapStreaks: MapStreak[] = [...mapRun.entries()]
    .filter(([, v]) => v.count >= 3)
    .map(([k, v]) => {
      const [team, map] = k.split("|");
      return { team, map, count: v.count, lastDate: fmt(v.last) };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const playerStreaks: PlayerStreak[] = [...playerRun.entries()]
    .filter(([, v]) => v.count >= 3)
    .map(([player, v]) => ({ player, team: v.team, count: v.count, lastDate: fmt(v.last) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return { winStreaks, lossStreaks, mapStreaks, playerStreaks };
}
