// ===== National teams (Mistrzostwa Świata) =====
// Reprezentacje narodowe są przechowywane w tej samej puli rankingowej co kluby,
// ale oznaczone flagą `isNational: true`. Dzięki temu wszystkie widoki (logo, profil,
// statystyki gracza) działają out-of-the-box, a klubowy ranking je odfiltrowuje.

import { teamDatabase } from "@/data/tournaments";
import { playerNationalities } from "@/data/playerNationalities";
import { countryFlag, normalizeCountry } from "@/lib/flags";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import type { TeamData } from "@/lib/types";

const RANKING_KEY = "ranking_data";

/** Konwencja nazwy reprezentacji: "🇵🇱 Poland" — czytelne i unikalne. */
export const buildNationalTeamName = (countryCode: string, customLabel?: string): string => {
  const iso = normalizeCountry(countryCode) || countryCode.toUpperCase();
  const flag = countryFlag(iso);
  const label = customLabel?.trim() || `Team ${iso}`;
  return `${flag} ${label}`.trim();
};

/** Wszyscy zarejestrowani gracze (z mapy narodowości) pogrupowani po ISO kraju. */
export const playersByCountry = (): Record<string, string[]> => {
  const map: Record<string, string[]> = {};
  Object.entries(playerNationalities).forEach(([nick, iso]) => {
    const key = (iso || "").toUpperCase();
    if (!key) return;
    if (!map[key]) map[key] = [];
    map[key].push(nick);
  });
  Object.values(map).forEach(arr => arr.sort((a, b) => a.localeCompare(b)));
  return map;
};

/** Lista wszystkich ISO krajów które mają min. 1 gracza w bazie. */
export const availableCountries = (): { code: string; flag: string; playerCount: number }[] => {
  const grouped = playersByCountry();
  return Object.entries(grouped)
    .map(([code, players]) => ({ code, flag: countryFlag(code), playerCount: players.length }))
    .sort((a, b) => b.playerCount - a.playerCount);
};

/** Zapisuje (upsertuje) zestaw reprezentacji narodowych w ranking_data. */
export const upsertNationalTeams = (teams: TeamData[]): void => {
  const current = loadFromStorage<TeamData[] | null>(RANKING_KEY, null)
    ?? teamDatabase.map(t => ({ ...t }));
  const byName = new Map(current.map(t => [t.name, t]));
  teams.forEach(nt => {
    byName.set(nt.name, { ...byName.get(nt.name), ...nt });
  });
  saveToStorage(RANKING_KEY, Array.from(byName.values()));
  window.dispatchEvent(new CustomEvent("teams:update"));
};

/** Region przybliżony na podstawie ISO kraju (na potrzeby grupowania). */
export const regionForCountry = (iso: string): string => {
  const eu = new Set(["PL","DE","FR","ES","IT","NL","BE","DK","SE","NO","FI","UK","GB","UA","RU","PT","CZ","SK","RO","BG","HU","AT","CH","IE","GR","HR","RS","SI","BA","MK","AL","XK","EE","LV","LT","BY","MD","IS","LU","MT","CY","ME"]);
  const us = new Set(["US","CA"]);
  const latam = new Set(["BR","AR","CL","UY","PE","CO","VE","MX","BO","PY","EC"]);
  const asia = new Set(["CN","KR","JP","TW","HK","SG","MY","TH","ID","PH","VN","IN","PK","BD","KZ","UZ","MN","KG","TM","TJ","AZ","AM","GE","TR","IL","SA","AE","QA","IR","IQ","LB"]);
  const oce = new Set(["AU","NZ","FJ"]);
  const afr = new Set(["ZA","EG","MA","NG","DZ","TN","LY","KE","GH"]);
  const up = iso.toUpperCase();
  if (eu.has(up)) return "EU";
  if (us.has(up)) return "US";
  if (latam.has(up)) return "LATAM";
  if (asia.has(up)) return "ASIA";
  if (oce.has(up)) return "OCE";
  if (afr.has(up)) return "AFR";
  return "EU";
};
