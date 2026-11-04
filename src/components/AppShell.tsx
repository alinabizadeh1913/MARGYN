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
          className="h-[var(--titlebar-height)] w-full flex items-center justify-between bg-[#09090b] border-b border-[#27272a] select-none shrink-0 z-[200]"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          <div className="flex items-center gap-2 pl-4 h-full">
            <img
              src="/logo.png"
              alt="MARGYN"
              className="w-5 h-5 object-contain pointer-events-none"
            />
            <span className="text-[11px] font-bold text-[#71717a] tracking-[0.3em] uppercase pl-1 pointer-events-none">
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
