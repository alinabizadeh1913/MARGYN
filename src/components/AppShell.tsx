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
          className="h-[var(--titlebar-height)] w-full flex items-center justify-end bg-[#09090b] border-b border-[#27272a] select-none shrink-0 z-50"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          {/* کلمه MARGYN از اینجا حذف شد */}
          <WindowControls />
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">{children}</div>
    </div>
  );
}
