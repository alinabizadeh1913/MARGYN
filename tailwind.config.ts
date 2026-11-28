import type { Config } from "tailwindcss";

// "Obsidian Studio" tokens: layered flat surfaces + hairlines. Colours are RGB channels in CSS variables
// (see globals.css) so Tailwind opacity modifiers like `bg-nm-accent/20` work.
const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-space-grotesk)"],
        mono: ["var(--font-jetbrains-mono)"],
      },
      screens: {
        sm: "600px",
        md: "900px",
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "nm-deep": c("nm-deep"),
        "nm-panel": c("nm-panel"),
        "nm-raise": c("nm-raise"),
        "nm-line": c("nm-line"),
        "nm-text": c("nm-text"),
        "nm-muted": c("nm-muted"),
        "nm-dim": c("nm-dim"),
        "nm-faint": c("nm-faint"),
        "nm-accent": c("nm-accent"),
        "nm-hot": c("nm-hot"),
        "nm-ember": c("nm-ember"),
        "nm-deep-red": c("nm-deep-red"),
        "nm-edge": "var(--nm-edge)",
        "nm-edge-strong": "var(--nm-edge-strong)",
      },
      // Elevation = plain static box-shadows (tiny + hairline): zero JS, no blur
      // filters, no per-frame cost. Painted once and cached by the GPU.
      boxShadow: {
        "nm-raised": "var(--nm-raised)",
        "nm-raised-sm": "var(--nm-raised-sm)",
        "nm-inset": "var(--nm-inset)",
        "nm-inset-sm": "var(--nm-inset-sm)",
        "nm-float": "var(--nm-float)",
        "nm-pop": "var(--nm-pop)",
        "nm-glow": "var(--nm-glow)",
        "nm-glow-sm": "var(--nm-glow-sm)",
        "nm-glow-ok": "var(--nm-glow-ok)",
        "nm-glow-warn": "var(--nm-glow-warn)",
        // Tailwind's stock elevations are re-mapped to the Obsidian language.
        DEFAULT: "var(--nm-raised-sm)",
        sm: "var(--nm-raised-sm)",
        md: "var(--nm-raised-sm)",
        lg: "var(--nm-raised)",
        xl: "var(--nm-raised)",
        "2xl": "var(--nm-float)",
      },
    },
  },
  plugins: [],
} satisfies Config;
