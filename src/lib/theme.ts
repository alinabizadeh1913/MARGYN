// Theme accent: blue / red / yellow / orange / green.
// The palette itself lives in globals.css as `html[data-accent="…"]` blocks, so
// switching is a single attribute change: no re-render, no JS animation, no
// per-element work — the browser just re-resolves a handful of CSS variables.

export type ThemeId = "red" | "blue" | "yellow" | "orange" | "green";

export interface ThemeOption {
  id: ThemeId;
  label: string;
  /** Swatch colour (RGB) shown in Settings. */
  rgb: string;
}

export const THEMES: ThemeOption[] = [
  { id: "blue", label: "Blue", rgb: "59 130 246" },
  { id: "red", label: "Red", rgb: "240 62 77" },
  { id: "yellow", label: "Yellow", rgb: "234 179 8" },
  { id: "orange", label: "Orange", rgb: "249 115 22" },
  { id: "green", label: "Green", rgb: "34 197 94" },
];

export const DEFAULT_THEME: ThemeId = "red";
export const THEME_STORAGE_KEY = "margyn.accent";
export const THEME_DB_KEY = "themeAccent";
export const THEME_EVENT = "margyn-theme-change";

export function isThemeId(v: unknown): v is ThemeId {
  return THEMES.some((t) => t.id === v);
}

export function getStoredTheme(): ThemeId {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(id: ThemeId) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-accent", id);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {}
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Runs before first paint (see layout.tsx) so there is no colour flash. */
export const THEME_BOOT_SCRIPT = `try{var a=localStorage.getItem("${THEME_STORAGE_KEY}");if(a&&/^(red|blue|yellow|orange|green)$/.test(a))document.documentElement.setAttribute("data-accent",a)}catch(e){}`;
