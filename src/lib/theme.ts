// Application theme system. Themes are CSS variable overlays applied to
// <html data-theme="..."> — index.css contains the matching [data-theme=...]
// blocks. The default theme matches the original neon look.

export type ThemeId =
  | "neon" | "midnight" | "matrix" | "sunset" | "paper" | "noir"
  | "hltv" | "ocean" | "crimson" | "forest" | "arctic" | "mono"
  | "synthwave" | "coffee" | "steel" | "lavender" | "ember";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  description: string;
  /** Quick-preview swatches shown in the picker (hex). */
  swatches: [string, string, string, string];
}

export const THEMES: ThemeMeta[] = [
  {
    id: "neon",
    name: "Neon Cyan",
    description: "Domyślny — głęboka ciemność z neonowym cyanem.",
    swatches: ["#0e1320", "#15182a", "#00e5ff", "#ffae33"],
  },
  {
    id: "midnight",
    name: "Midnight Indigo",
    description: "Granatowy z fioletowym akcentem.",
    swatches: ["#0a0a1a", "#1e1e5a", "#7c3aed", "#a78bfa"],
  },
  {
    id: "matrix",
    name: "Matrix Green",
    description: "Czarny terminal z zielonym akcentem.",
    swatches: ["#06120a", "#0d2218", "#22c55e", "#bef264"],
  },
  {
    id: "sunset",
    name: "Sunset Ember",
    description: "Ciepłe brązy i pomarańczowe akcenty.",
    swatches: ["#1a1310", "#2d1f18", "#f97316", "#fbbf24"],
  },
  {
    id: "paper",
    name: "Paper Light",
    description: "Jasny edytorial — kremowe tło, czarny akcent.",
    swatches: ["#f7f5ee", "#e8e4d8", "#0d0d0d", "#dc2626"],
  },
  {
    id: "noir",
    name: "Noir Gold",
    description: "Czerń z luksusowym złotym akcentem.",
    swatches: ["#0d0d0d", "#1a1a1a", "#c9a84c", "#f0d78c"],
  },
];

const STORAGE_KEY = "app_theme";
const DEFAULT_THEME: ThemeId = "neon";

export const getStoredTheme = (): ThemeId => {
  if (typeof localStorage === "undefined") return DEFAULT_THEME;
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
  return stored && THEMES.some(t => t.id === stored) ? stored : DEFAULT_THEME;
};

export const applyTheme = (theme: ThemeId) => {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
};

export const setTheme = (theme: ThemeId) => {
  applyTheme(theme);
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("theme:change", { detail: theme }));
};

export const initTheme = () => {
  applyTheme(getStoredTheme());
};
