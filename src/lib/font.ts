export type FontId = "default" | "modern" | "gaming" | "scifi";

export interface FontMeta {
  id: FontId;
  name: string;
  description: string;
  heading: string;
  body: string;
  mono: string;
}

export const FONTS: FontMeta[] = [
  {
    id: "default",
    name: "Neon Cyan",
    description: "Rajdhani + Inter + Share Tech Mono — domyślny styl.",
    heading: "Rajdhani",
    body: "Inter",
    mono: "Share Tech Mono",
  },
  {
    id: "modern",
    name: "Modern Clean",
    description: "Poppins + Open Sans + JetBrains Mono — nowoczesny i czytelny.",
    heading: "Poppins",
    body: "Open Sans",
    mono: "JetBrains Mono",
  },
  {
    id: "gaming",
    name: "Gaming Bold",
    description: "Bebas Neue + Roboto + Fira Code — gamingowy charakter.",
    heading: "Bebas Neue",
    body: "Roboto",
    mono: "Fira Code",
  },
  {
    id: "scifi",
    name: "Sci-Fi Tech",
    description: "Orbitron + Nunito + Source Code Pro — futurystyczny wygląd.",
    heading: "Orbitron",
    body: "Nunito",
    mono: "Source Code Pro",
  },
];

const STORAGE_KEY = "app_font";
const DEFAULT_FONT: FontId = "default";

export const getStoredFont = (): FontId => {
  if (typeof localStorage === "undefined") return DEFAULT_FONT;
  const stored = localStorage.getItem(STORAGE_KEY) as FontId | null;
  return stored && FONTS.some(f => f.id === stored) ? stored : DEFAULT_FONT;
};

export const applyFont = (font: FontId) => {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-font", font);
};

export const setFont = (font: FontId) => {
  applyFont(font);
  try { localStorage.setItem(STORAGE_KEY, font); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("font:change", { detail: font }));
};

export const initFont = () => {
  applyFont(getStoredFont());
};
