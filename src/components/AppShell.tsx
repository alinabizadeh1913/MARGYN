"use client";

import React, { useEffect, useState } from "react";
import Typography from "@/typography";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.electronAPI) {
      setIsElectron(true);
    }
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {isElectron && (
        <div
          className="h-[var(--titlebar-height)] w-full flex items-center justify-between bg-[#09090b] border-b border-[#27272a] select-none shrink-0 z-50"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          <div className="px-4">
            <Typography variant="microLabel" className="text-[#3f3f46]">
              MARGYN
            </Typography>
          </div>

          <div
            className="flex items-center h-full"
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <button
              onClick={() => window.electronAPI?.minimize()}
              className="h-full px-4 text-[#a1a1aa] hover:bg-white/10 active:bg-white/20 hover:text-white transition-all duration-150"
            >
              <svg width="10" height="1" viewBox="0 0 10 1" fill="none">
                <rect width="10" height="1" fill="currentColor" />
              </svg>
            </button>

            <button
              onClick={() => window.electronAPI?.maximize()}
              className="h-full px-4 text-[#a1a1aa] hover:bg-white/10 active:bg-white/20 hover:text-white transition-all duration-150"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <rect
                  x="0.5"
                  y="0.5"
                  width="9"
                  height="9"
                  stroke="currentColor"
                />
              </svg>
            </button>

            <button
              onClick={() => window.electronAPI?.close()}
              className="h-full px-4 text-[#a1a1aa] hover:bg-red-600 active:bg-red-700 hover:text-white transition-all duration-150"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M1 1L9 9M9 1L1 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">{children}</div>
    </div>
  );
}
