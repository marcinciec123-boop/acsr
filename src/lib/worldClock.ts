// ===== Fictional in-app "world clock" =====
//
// The app has its own alternate timeline independent from the real world.
// It advances automatically when tournaments get finalized (to their end date),
// and can be manually adjusted from Settings. All in-app timestamps
// (transfers, ranking changes, news, "today" highlight in calendars)
// should use this instead of `new Date()` so the world stays consistent.

const KEY = "world_clock_date";
export const WORLD_CLOCK_EVENT = "worldclock:update";

/** Default fictional start: 1 Jan 2026 (matches the season data). */
const DEFAULT_ISO = "2026-01-01";

const pad = (n: number) => String(n).padStart(2, "0");

const realTodayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const isValidIso = (s: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** Current fictional date as ISO YYYY-MM-DD. */
export function getWorldDate(): string {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored && isValidIso(stored)) return stored;
  } catch { /* SSR/private mode */ }
  return DEFAULT_ISO;
}

/** Set the fictional date; broadcasts a `worldclock:update` event. */
export function setWorldDate(iso: string): void {
  if (!isValidIso(iso)) return;
  try {
    localStorage.setItem(KEY, iso);
    window.dispatchEvent(new Event(WORLD_CLOCK_EVENT));
  } catch { /* ignore */ }
}

/** Advance the clock forward to `iso` if it is later than the current world date. */
export function advanceWorldTo(iso: string | undefined | null): void {
  if (!iso) return;
  const only = iso.slice(0, 10);
  if (!isValidIso(only)) return;
  const cur = getWorldDate();
  if (only > cur) setWorldDate(only);
}

/** Reset the world clock back to the default start date. */
export function resetWorldClock(): void {
  setWorldDate(DEFAULT_ISO);
}

/** Fictional "now" as a Date object anchored at 12:00 local time. */
export function getWorldNow(): Date {
  const [y, m, d] = getWorldDate().split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

/** Fictional "now" as an ISO timestamp string. */
export function getWorldNowIso(): string {
  return getWorldNow().toISOString();
}

/** For UI display: pretty formatted world date. */
export function formatWorldDate(locale = "pl-PL"): string {
  return getWorldNow().toLocaleDateString(locale, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

export const WORLD_CLOCK_DEFAULT = DEFAULT_ISO;
export const WORLD_CLOCK_REAL_TODAY = realTodayIso;
