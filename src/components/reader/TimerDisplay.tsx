"use client";

import React, { useEffect, useState, useRef } from "react";
import { Clock, X } from "lucide-react";
import { useSession } from "@/providers/SessionProvider";
import Typography from "@/typography";
import { playEndSound } from "@/lib/audio";

export default function TimerDisplay() {
  const { timerEndsAt, stopTimer, isActive, sessionId, endSession } =
    useSession();
  const [now, setNow] = useState(Date.now());
  const hasEndedRef = useRef(false);

  useEffect(() => {
    if (!timerEndsAt) {
      hasEndedRef.current = false;
      return;
    }
    hasEndedRef.current = false;
    // ✅ فوراً زمان فعلی را ست میکنیم تا از پرش اولیه جلوگیری شود
    setNow(Date.now());
    // ✅ هر ۲۵۰ میلی‌ثانیه چک میکنیم تا دقیقاً در ثانیه صفر به پایان برسد
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [timerEndsAt]);

  useEffect(() => {
    if (!timerEndsAt || hasEndedRef.current) return;
    if (now >= timerEndsAt) {
      hasEndedRef.current = true;
      playEndSound();
      if (isActive && sessionId) {
        endSession();
      }
      stopTimer();
    }
  }, [now, timerEndsAt, isActive, sessionId, endSession, stopTimer]);

  if (!timerEndsAt) return null;

  const remaining = Math.max(0, timerEndsAt - now);
  // ✅ استفاده از Math.ceil به جای Math.floor برای رفع باگ 28:01
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#38bdf8]/10 border border-[#38bdf8]/30 rounded-full">
      <Clock size={14} className="text-[#38bdf8] animate-pulse" />
      <Typography
        variant="button"
        className="text-[#38bdf8] font-mono tabular-nums"
      >
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </Typography>
      <button
        onClick={stopTimer}
        className="text-[#38bdf8]/60 hover:text-rose-500 transition-colors ml-0.5"
        title="Stop timer"
      >
        <X size={12} />
      </button>
    </div>
  );
}
