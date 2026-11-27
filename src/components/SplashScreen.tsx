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
      className={`fixed inset-0 z-[99999] bg-[#09080b] flex flex-col items-center justify-center overflow-hidden transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1) ${
        isFadingOut
          ? "opacity-0 scale-[1.02] pointer-events-none blur-md"
          : "opacity-100 scale-100 blur-0"
      }`}
    >
      {/* ================= BACKGROUND EFFECTS ================= */}

      <div className="absolute inset-0 bg-[linear-gradient(to_right,#2b2630_1px,transparent_1px),linear-gradient(to_bottom,#2b2630_1px,transparent_1px)] bg-[size:64px_64px] opacity-[0.02] pointer-events-none" />

      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-[#ef2b3a]/10 rounded-full blur-[150px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-[#ff7a45]/10 rounded-full blur-[150px] translate-x-1/2 translate-y-1/2 pointer-events-none" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#f43f5e]/5 rounded-full blur-[120px] translate-x-1/3 -translate-y-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#10b981]/5 rounded-full blur-[120px] -translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#ef2b3a]/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

      {/* ================= MAIN CONTENT ================= */}
      <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in-[0.98] duration-1000 ease-out fill-mode-both">
        {/* Logo Section */}
        <div className="relative mb-10 group">
          <div className="absolute inset-0 bg-[#ef2b3a]/30 rounded-full blur-2xl animate-[glow-breathe_4s_ease-in-out_infinite]" />

          <div className="relative animate-[float_6s_ease-in-out_infinite]">
            <img
              src="/logo.png"
              alt="MARGYN Logo"
              className="w-32 h-32 object-contain relative z-10 drop-shadow-[0_0_20px_rgba(239,43,58,0.3)]"
            />
          </div>
        </div>

        {/* Text Section */}
        <div className="flex flex-col items-center mb-12">
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/70 tracking-[0.4em] mb-3 pl-[0.4em] drop-shadow-sm">
            MARGYN
          </h1>

          <div className="flex items-center gap-4">
            <div className="w-8 h-px bg-gradient-to-r from-transparent to-[#ef2b3a]/50" />
            <p className="text-[#847d8e] text-[10px] font-bold tracking-[0.5em] uppercase pl-[0.5em]">
              Mindful Reading Workspace
            </p>
            <div className="w-8 h-px bg-gradient-to-l from-transparent to-[#ef2b3a]/50" />
          </div>
        </div>

        {/* ================= PROGRESS BAR SECTION ================= */}
        <div className="w-full max-w-md flex flex-col gap-3">
          <div className="relative w-full h-2 bg-[#121015] rounded-full overflow-hidden border border-white/5 shadow-inner">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.03)_50%,transparent_100%)] bg-[length:200%_100%] animate-[shimmer_2s_infinite]" />

            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#ef2b3a] via-[#dc2626] to-[#9f1239] rounded-full transition-all duration-300 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-white blur-[6px] opacity-80" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_12px_3px_rgba(255,255,255,0.8)]" />
            </div>
          </div>

          <div className="flex items-center justify-between w-full px-1">
            <div className="flex items-center gap-2.5">
              {progress < 100 ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ef2b3a] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ef2b3a]"></span>
                  </span>
                  <span className="text-[#aaa3b4] text-[11px] font-medium tracking-wide">
                    {LOADING_PHRASES[phraseIndex]}
                  </span>
                </>
              ) : (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-emerald-500 text-[11px] font-bold tracking-wide">
                    SYSTEM READY
                  </span>
                </>
              )}
            </div>

            <span className="text-[#fbf8f9] text-xs font-mono font-bold tabular-nums tracking-wider">
              {progress}
              <span className="text-[#6f6878] text-[10px] ml-0.5">%</span>
            </span>
          </div>
        </div>
      </div>

      {/* ================= FOOTER ================= */}
      <div className="absolute bottom-8 flex flex-col items-center gap-2">
        <div className="w-12 h-px bg-white/10" />
        <div className="text-[#443d4b] text-[9px] tracking-[0.2em] font-mono text-center">
          © 2026 ALI NABIZADEH · ALL RIGHTS RESERVED
        </div>
      </div>

      {/* ================= CUSTOM KEYFRAMES ================= */}
      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
        @keyframes glow-breathe {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(0.95);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  );
}