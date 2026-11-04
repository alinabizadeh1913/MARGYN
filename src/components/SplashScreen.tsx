"use client";

import React, { useEffect, useState } from "react";

interface SplashScreenProps {
  isAppReady: boolean;
}

export default function SplashScreen({ isAppReady }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    // Simulate loading progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        // Randomly increment to look realistic
        const increment = Math.floor(Math.random() * 15) + 5;
        return Math.min(prev + increment, 100);
      });
    }, 150);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // When both the app is ready AND the fake progress is complete, start fading out
    if (isAppReady && progress >= 100) {
      const fadeTimer = setTimeout(() => {
        setIsFadingOut(true);
      }, 400); // Wait a moment at 100% before fading

      const hideTimer = setTimeout(() => {
        setIsHidden(true);
      }, 1400); // Wait for fade animation to finish

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
          ? "opacity-0 scale-105 pointer-events-none"
          : "opacity-100 scale-100"
      }`}
    >
      {/* پس‌زمینه گرید ملایم */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:40px_40px] opacity-10 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center">
        {/* لوگو بدون هاله (Glow) */}
        <div className="relative mb-10">
          <img
            src="/logo.png"
            alt="MARGYN"
            className="w-48 h-48 object-contain relative z-10 animate-in zoom-in-75 spin-in-12 duration-1000 ease-out fill-mode-both drop-shadow-2xl"
          />
        </div>

        {/* متن */}
        <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-[#38bdf8] to-white/60 tracking-[0.3em] mb-4 animate-in slide-in-from-bottom-6 duration-1000 delay-200 fill-mode-both">
          MARGYN
        </h1>

        <p className="text-[#a1a1aa] text-sm tracking-[0.4em] uppercase mb-16 animate-in slide-in-from-bottom-4 duration-1000 delay-400 fill-mode-both">
          Study Command Center
        </p>

        {/* Progress Bar & Percentage */}
        <div className="w-80 flex flex-col items-center gap-4 animate-in fade-in duration-1000 delay-600 fill-mode-both">
          <div className="w-full h-[3px] bg-[#27272a]/50 rounded-full overflow-hidden relative">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#38bdf8] to-[#a855f7] transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
            {/* Glowing tip */}
            <div
              className="absolute top-0 h-full w-4 bg-white blur-sm transition-all duration-300 ease-out"
              style={{ left: `calc(${progress}% - 8px)` }}
            />
          </div>

          <div className="flex justify-between w-full text-xs font-mono text-[#52525b]">
            <span className="animate-pulse">
              {progress < 100 ? "Initializing..." : "Ready"}
            </span>
            <span className="text-[#38bdf8]">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Footer text */}
      <div className="absolute bottom-8 text-[#3f3f46] text-xs tracking-widest font-mono">
        © 2026 ALI NABIZADEH · ALL RIGHTS RESERVED
      </div>
    </div>
  );
}
