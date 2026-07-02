// ===== National teams (Mistrzostwa Świata) =====
// Reprezentacje narodowe są przechowywane w tej samej puli rankingowej co kluby,
// ale oznaczone flagą `isNational: true`. Dzięki temu wszystkie widoki (logo, profil,
// statystyki gracza) działają out-of-the-box, a klubowy ranking je odfiltrowuje.

import { teamDatabase } from "@/data/tournaments";
import { playerNationalities } from "@/data/playerNationalities";
import { countryFlag, normalizeCountry } from "@/lib/flags";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import { getFreeAgents } from "@/lib/freeAgents";
import type { TeamData } from "@/lib/types";

const RANKING_KEY = "ranking_data";

/** Pełne nazwy krajów po ISO (rozszerzaj wedle potrzeb). */
const COUNTRY_NAMES: Record<string, string> = {
  PL: "Poland", DE: "Germany", FR: "France", ES: "Spain", IT: "Italy", NL: "Netherlands",
  BE: "Belgium", DK: "Denmark", SE: "Sweden", NO: "Norway", FI: "Finland", GB: "United Kingdom",
  UA: "Ukraine", RU: "Russia", PT: "Portugal", CZ: "Czechia", SK: "Slovakia", RO: "Romania",
  BG: "Bulgaria", HU: "Hungary", AT: "Austria", CH: "Switzerland", IE: "Ireland", GR: "Greece",
  HR: "Croatia", RS: "Serbia", SI: "Slovenia", BA: "Bosnia & Herzegovina", MK: "North Macedonia",
  AL: "Albania", XK: "Kosovo", EE: "Estonia", LV: "Latvia", LT: "Lithuania", BY: "Belarus",
  MD: "Moldova", IS: "Iceland", LU: "Luxembourg", MT: "Malta", CY: "Cyprus", ME: "Montenegro",
  US: "United States", CA: "Canada",
  BR: "Brazil", AR: "Argentina", CL: "Chile", UY: "Uruguay", PE: "Peru", CO: "Colombia",
  VE: "Venezuela", MX: "Mexico", BO: "Bolivia", PY: "Paraguay", EC: "Ecuador",
  CN: "China", KR: "South Korea", JP: "Japan", TW: "Taiwan", HK: "Hong Kong", SG: "Singapore",
  MY: "Malaysia", TH: "Thailand", ID: "Indonesia", PH: "Philippines", VN: "Vietnam",
  IN: "India", PK: "Pakistan", BD: "Bangladesh", KZ: "Kazakhstan", UZ: "Uzbekistan",
  MN: "Mongolia", KG: "Kyrgyzstan", TM: "Turkmenistan", TJ: "Tajikistan",
  AZ: "Azerbaijan", AM: "Armenia", GE: "Georgia", TR: "Turkey", IL: "Israel",
  SA: "Saudi Arabia", AE: "United Arab Emirates", QA: "Qatar", IR: "Iran", IQ: "Iraq", LB: "Lebanon",
  AU: "Australia", NZ: "New Zealand", FJ: "Fiji",
  ZA: "South Africa", EG: "Egypt", MA: "Morocco", NG: "Nigeria", DZ: "Algeria",
  TN: "Tunisia", LY: "Libya", KE: "Kenya", GH: "Ghana",
};

export const countryName = (iso: string): string => {
  const up = (normalizeCountry(iso) || iso || "").toUpperCase();
  return COUNTRY_NAMES[up] || up;
};

/** Konwencja nazwy reprezentacji: "🇵🇱 Poland" — czytelne i unikalne. */
export const buildNationalTeamName = (countryCode: string, customLabel?: string): string => {
  const iso = normalizeCountry(countryCode) || countryCode.toUpperCase();
  const flag = countryFlag(iso);
  const label = customLabel?.trim() || COUNTRY_NAMES[iso] || iso;
  return `${flag} ${label}`.trim();
};

/** Wszyscy zarejestrowani gracze (z mapy narodowości + wolni agenci) pogrupowani po ISO kraju. */
export const playersByCountry = (): Record<string, string[]> => {
  const map: Record<string, string[]> = {};
  const push = (iso: string, nick: string) => {
    const key = (iso || "").toUpperCase();
    if (!key || !nick) return;
    if (!map[key]) map[key] = [];
    if (!map[key].includes(nick)) map[key].push(nick);
  };
  Object.entries(playerNationalities).forEach(([nick, iso]) => push(iso, nick));

  // Include free agents (manual + transfer-derived) so they can be picked for
  // national teams.
  try {
    for (const fa of getFreeAgents()) push(fa.country, fa.player);
  } catch { /* ignore */ }

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
