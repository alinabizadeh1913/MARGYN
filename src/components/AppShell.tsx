"use client";

import React, { useEffect, useState } from "react";
import Typography from "@/typography";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isElectron, setIsElectron] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.electronAPI) {
      setIsElectron(true);
      // بررسی اولیه وضعیت ماکسیمایز
      window.electronAPI.isMaximized().then((val) => setIsMaximized(val));
    }
  }, []);

  // هندل کردن دکمه ماکسیمایز/ری استور
  const handleMaximizeRestore = async () => {
    if (window.electronAPI) {
      await window.electronAPI.maximize(); // در main.js هم maximize هم restore رو هندل میکنه
      const val = await window.electronAPI.isMaximized();
      setIsMaximized(val);
    }
  };

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
            {/* Minimize */}
            <button
              onClick={() => window.electronAPI?.minimize()}
              className="h-full px-5 flex items-center justify-center text-[#a1a1aa] hover:bg-[#27272a] active:bg-[#3f3f46] hover:text-white transition-all duration-150 cursor-pointer group"
            >
              <svg
                width="10"
                height="1"
                viewBox="0 0 10 1"
                fill="none"
                className="group-hover:text-white"
              >
                <rect width="10" height="1" fill="currentColor" />
              </svg>
            </button>

            {/* Maximize / Restore */}
            <button
              onClick={handleMaximizeRestore}
              className="h-full px-5 flex items-center justify-center text-[#a1a1aa] hover:bg-[#27272a] active:bg-[#3f3f46] hover:text-white transition-all duration-150 cursor-pointer group"
            >
              {isMaximized ? (
                // آیکون Restore (دو مربع روی هم)
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  className="group-hover:text-white"
                >
                  <path
                    d="M2.5 2.5V0.5H9.5V7.5H7.5M0.5 2.5H7.5V9.5H0.5V2.5Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                </svg>
              ) : (
                // آیکون Maximize (یک مربع)
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  className="group-hover:text-white"
                >
                  <rect
                    x="0.5"
                    y="0.5"
                    width="9"
                    height="9"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                </svg>
              )}
            </button>

            {/* Close */}
            <button
              onClick={() => window.electronAPI?.close()}
              className="h-full px-5 flex items-center justify-center text-[#a1a1aa] hover:bg-rose-600 active:bg-rose-700 hover:text-white transition-all duration-150 cursor-pointer group"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                className="group-hover:text-white"
              >
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
