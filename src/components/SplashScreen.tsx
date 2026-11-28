"use client";

import React, { useEffect, useState } from "react";

interface SplashScreenProps {
  isAppReady: boolean;
}

const LOADING_PHRASES = [
  "Initializing core systems...",
  "Loading workspace environment...",
  "Syncing local database...",
  "Preparing annotation engine...",
  "Restoring preferences...",
  "Almost ready...",
];

export default function SplashScreen({ isAppReady }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  // Simulated loading (fires only while app is NOT yet ready)
  useEffect(() => {
    if (isAppReady) return;
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const increment = Math.floor(Math.random() * 8) + 2;
        return Math.min(prev + increment, 100);
      });
    }, 120);

    return () => clearInterval(interval);
  }, [isAppReady]);

  // ✅ NEW: fast-forward to 100% the moment the app is ready
  useEffect(() => {
    if (isAppReady && progress < 100) {
      setProgress(100);
    }
  }, [isAppReady, progress]);

  // Rotate the phrase
  useEffect(() => {
    if (progress >= 100) return;
    const phraseInterval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % LOADING_PHRASES.length);
    }, 1500);
    return () => clearInterval(phraseInterval);
  }, [progress]);

  // ✅ FASTER fade-out: 200ms hold, 700ms fade, hide at 900ms
  useEffect(() => {
    if (isAppReady && progress >= 100) {
      const fadeTimer = setTimeout(() => {
        setIsFadingOut(true);
      }, 200);

      const hideTimer = setTimeout(() => {
        setIsHidden(true);
      }, 900);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [isAppReady, progress]);

  if (isHidden) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] bg-nm-deep mg-aurora flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500 ease-out ${
        isFadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Static dotted texture (no animation, no blur) */}
      <div className="absolute inset-0 mg-dots opacity-[0.35] pointer-events-none" />

      {/* ================= MAIN CONTENT ================= */}
      <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in-[0.98] duration-700 ease-out fill-mode-both">
        {/* Logo tile */}
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-[28px] bg-nm-panel border border-nm-edge-strong flex items-center justify-center shadow-nm-glow">
            <img
              src="/logo.png"
              alt="MARGYN Logo"
              className="w-14 h-14 object-contain"
              draggable={false}
            />
          </div>
        </div>

        {/* Wordmark */}
        <div className="flex flex-col items-center mb-12">
          <h1 className="text-3xl font-bold text-nm-text tracking-[0.45em] mb-3 pl-[0.45em]">
            MARGYN
          </h1>
          <p className="text-nm-dim text-[10px] font-semibold tracking-[0.5em] uppercase pl-[0.5em]">
            Mindful Reading Workspace
          </p>
        </div>

        {/* ================= PROGRESS ================= */}
        <div className="w-full max-w-xs flex flex-col gap-3">
          <div className="relative w-full h-[3px] bg-nm-line rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-nm-accent rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {progress < 100 ? (
                <>
                  <span className="inline-flex rounded-full h-1.5 w-1.5 bg-nm-accent" />
                  <span className="text-nm-muted text-[11px] font-medium tracking-wide">
                    {LOADING_PHRASES[phraseIndex]}
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  <span className="text-emerald-500 text-[11px] font-bold tracking-wide">
                    SYSTEM READY
                  </span>
                </>
              )}
            </div>

            <span className="text-nm-text text-xs font-mono font-bold tabular-nums">
              {progress}
              <span className="text-nm-dim text-[10px] ml-0.5">%</span>
            </span>
          </div>
        </div>
      </div>

      {/* ================= FOOTER ================= */}
      <div className="absolute bottom-8 text-nm-faint text-[9px] tracking-[0.2em] font-mono text-center">
        © 2026 ALI NABIZADEH · ALL RIGHTS RESERVED
      </div>
    </div>
  );
}
