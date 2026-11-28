"use client";

import React from "react";
import { Crown, Castle, ScrollText, Settings } from "lucide-react";

type View = "reader" | "library" | "history" | "settings";

interface AppRailProps {
  view: View;
  setView: (v: View) => void;
}

const MAIN_ITEMS: { id: View; label: string; icon: React.ElementType }[] = [
  { id: "reader", label: "Reader", icon: Crown },
  { id: "library", label: "Library", icon: Castle },
  { id: "history", label: "History", icon: ScrollText },
];

/**
 * Vertical navigation rail (replaces the old top-left segmented switch).
 * Pure CSS tooltips + a single active indicator: no JS animation, no blur.
 */
export const AppRail: React.FC<AppRailProps> = ({ view, setView }) => {
  return (
    <nav
      aria-label="Primary"
      className="shrink-0 h-full flex flex-col items-center justify-between py-3 bg-nm-deep border-r border-nm-edge z-[110]"
      style={{ width: "var(--rail-width)" }}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="w-11 h-11 mb-2 rounded-2xl bg-nm-panel border border-nm-edge flex items-center justify-center">
          <img
            src="/logo.png"
            alt="MARGYN"
            className="w-6 h-6 object-contain pointer-events-none"
            draggable={false}
          />
        </div>

        {MAIN_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            data-active={view === id}
            data-label={label}
            aria-label={label}
            aria-current={view === id ? "page" : undefined}
            className="mg-rail-btn"
          >
            <Icon size={19} strokeWidth={view === id ? 2.2 : 1.8} />
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setView("settings")}
        data-active={view === "settings"}
        data-label="Settings"
        aria-label="Settings"
        aria-current={view === "settings" ? "page" : undefined}
        className="mg-rail-btn"
      >
        <Settings size={19} strokeWidth={view === "settings" ? 2.2 : 1.8} />
      </button>
    </nav>
  );
};
