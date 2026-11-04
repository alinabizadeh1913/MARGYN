"use client";

import React, { useEffect, useState } from "react";

export default function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.isMaximized().then((val) => setIsMaximized(val));
    }
  }, []);

  const handleMaximizeRestore = async () => {
    if (window.electronAPI) {
      await window.electronAPI.maximize();
      const val = await window.electronAPI.isMaximized();
      setIsMaximized(val);
    }
  };

  return (
    <div
      className="flex items-center h-full pointer-events-auto"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      {/* Minimize */}
      <button
        onClick={() => window.electronAPI?.minimize()}
        className="h-full px-4 flex items-center justify-center text-[#a1a1aa] hover:bg-white/10 hover:text-white transition-colors duration-200 cursor-pointer group"
        title="Minimize"
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
        className="h-full px-4 flex items-center justify-center text-[#a1a1aa] hover:bg-white/10 hover:text-white transition-colors duration-200 cursor-pointer group"
        title={isMaximized ? "Restore" : "Maximize"}
      >
        {isMaximized ? (
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
        className="h-full px-4 flex items-center justify-center text-[#a1a1aa] hover:bg-rose-600 hover:text-white transition-colors duration-200 cursor-pointer group"
        title="Close"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className="group-hover:text-white"
        >
          <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
    </div>
  );
}
