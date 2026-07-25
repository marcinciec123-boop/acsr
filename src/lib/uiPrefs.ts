// ===== Lightweight persisted UI preferences =====
// Filters, scroll offsets, calendar month, bracket pan positions...
// Stored under the `csgo_hub_ui_` prefix so they are part of device backups.

import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "csgo_hub_ui_";

export function readUiPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeUiPref<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch { /* quota / private mode */ }
}

/** useState that persists to localStorage under the UI prefs namespace. */
export function usePersistedState<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readUiPref(key, initial));
  const set = useCallback((v: T | ((prev: T) => T)) => {
    setValue(prev => {
      const next = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
      writeUiPref(key, next);
      return next;
    });
  }, [key]);
  return [value, set];
}

/**
 * Persist and restore the scroll position of a scrollable element (or the
 * window when no ref element is attached).
 */
export function useScrollRestore<T extends HTMLElement>(key: string, enabled = true) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    const saved = readUiPref<{ x: number; y: number } | null>(`scroll_${key}`, null);
    if (saved) {
      const apply = () => {
        if (el) { el.scrollLeft = saved.x; el.scrollTop = saved.y; }
        else window.scrollTo({ top: saved.y, left: saved.x });
      };
      apply();
      const t = window.setTimeout(apply, 60);
      const t2 = window.setTimeout(apply, 240);
      return () => { window.clearTimeout(t); window.clearTimeout(t2); };
    }
  }, [key, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    const target: HTMLElement | Window = el || window;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const x = el ? el.scrollLeft : window.scrollX;
        const y = el ? el.scrollTop : window.scrollY;
        writeUiPref(`scroll_${key}`, { x, y });
      });
    };
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      target.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [key, enabled]);

  return ref;
}
