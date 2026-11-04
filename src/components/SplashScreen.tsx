"use client";

import React, { useEffect, useState } from "react";

interface SplashScreenProps {
  isAppReady: boolean;
}

const LOADING_PHRASES = [
  "Initializing engine...",
  "Loading workspace...",
  "Preparing database...",
  "Syncing preferences...",
  "Almost ready...",
];

export default function SplashScreen({ isAppReady }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  // Simulate loading progress
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        // Randomly increment to look realistic
        const increment = Math.floor(Math.random() * 12) + 3;
        return Math.min(prev + increment, 100);
      });
    }, 150);

    return () => clearInterval(interval);
  }, []);

  // Change loading phrases periodically
  useEffect(() => {
    if (progress >= 100) return;
    const phraseInterval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % LOADING_PHRASES.length);
    }, 1200);
    return () => clearInterval(phraseInterval);
  }, [progress]);

  // Handle fade out sequence
  useEffect(() => {
    if (isAppReady && progress >= 100) {
      const fadeTimer = setTimeout(() => {
        setIsFadingOut(true);
      }, 500); // Wait a moment at 100% before fading

      const hideTimer = setTimeout(() => {
        setIsHidden(true);
      }, 1500); // Wait for fade animation to finish

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [isAppReady, progress]);

  if (isHidden) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] bg-[#09090b] flex flex-col items-center justify-center overflow-hidden transition-all duration-1000 ease-in-out ${
        isFadingOut
          ? "opacity-0 scale-105 pointer-events-none blur-sm"
          : "opacity-100 scale-100 blur-0"
      }`}
    >
      {/* پس‌زمینه گرید ملایم */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:48px_48px] opacity-[0.07] pointer-events-none" />

      {/* هاله نورانی در مرکز */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#38bdf8]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in-95 duration-1000 ease-out fill-mode-both">
        {/* لوگو با هاله ملایم */}
        <div className="relative mb-8 group">
          <div className="absolute inset-0 bg-[#38bdf8]/20 rounded-full blur-2xl animate-pulse duration-[3000ms]" />
          <img
            src="/logo.png"
            alt="MARGYN"
            className="w-32 h-32 object-contain relative z-10 drop-shadow-2xl"
          />
        </div>

        {/* متن‌ها */}
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-[#38bdf8] to-white/70 tracking-[0.35em] mb-3 pl-[0.35em]">
          MARGYN
        </h1>

        <p className="text-[#52525b] text-[11px] font-bold tracking-[0.5em] uppercase mb-14 pl-[0.5em]">
          Study Command Center
        </p>

        {/* نوار پیشرفت و درصد */}
        <div className="w-72 flex flex-col gap-3">
          <div className="relative w-full h-1.5 bg-[#18181b] rounded-full overflow-hidden border border-white/5">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#38bdf8] to-[#a855f7] rounded-full transition-all duration-300 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              {/* درخشش نوک نوار */}
              <div className="absolute top-0 right-0 h-full w-4 bg-white blur-[3px] opacity-70" />
            </div>
          </div>

          <div className="flex justify-between items-center w-full text-[11px] font-mono tracking-wider">
            <span className="text-[#52525b] flex items-center gap-1.5">
              {progress < 100 ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] animate-ping" />
                  {LOADING_PHRASES[phraseIndex]}
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Ready
                </>
              )}
            </span>
            <span className="text-[#38bdf8] font-bold">{progress}%</span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 text-[#3f3f46] text-[10px] tracking-[0.2em] font-mono text-center">
        © 2026 ALI NABIZADEH · ALL RIGHTS RESERVED
      </div>
    </div>
  );
}
