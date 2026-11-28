"use client";

import React, { useEffect, useState } from "react";
import WindowControls from "./WindowControls";

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
          className="h-[var(--titlebar-height)] w-full flex items-center justify-between bg-nm-deep border-b border-nm-edge select-none shrink-0 z-[200]"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          <div className="flex items-center gap-2 pl-4 h-full">
            <span className="text-[10px] font-semibold text-nm-faint tracking-[0.35em] uppercase pointer-events-none">
              MARGYN
            </span>
          </div>

          <WindowControls />
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">{children}</div>
    </div>
  );
}
