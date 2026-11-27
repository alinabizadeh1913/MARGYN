"use client";

import React, { useEffect, useState, useRef } from "react";
import { Clock, X } from "lucide-react";
import { useSession } from "@/providers/SessionProvider";
import Typography from "@/typography";
import { playTimerEndSound } from "@/lib/audio";

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
    setNow(Date.now());
    // PERF: tick once per displayed second (aligned), not 4x per second.
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      const n = Date.now();
      setNow(n);
      const left = timerEndsAt - n;
      if (left <= 0) return;
      t = setTimeout(loop, Math.min(left, 1000 - ((timerEndsAt - n) % 1000) + 5 || 1000));
    };
    t = setTimeout(loop, 1000 - ((timerEndsAt - Date.now()) % 1000) + 5);
    return () => clearTimeout(t);
  }, [timerEndsAt]);

  useEffect(() => {
    if (!timerEndsAt || hasEndedRef.current) return;
    if (now >= timerEndsAt) {
      hasEndedRef.current = true;
      playTimerEndSound();

      if (isActive && sessionId) {
        endSession();
      }
      stopTimer();
    }
  }, [now, timerEndsAt, isActive, sessionId, endSession, stopTimer]);

  if (!timerEndsAt) return null;

  const remaining = Math.max(0, timerEndsAt - now);
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-nm-accent/10 border border-nm-accent/30 rounded-full">
      <Clock size={14} className="text-nm-accent" />
      <Typography
        variant="button"
        className="text-nm-accent font-mono tabular-nums"
      >
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </Typography>
      <button
        onClick={stopTimer}
        className="text-nm-accent/60 hover:text-rose-500 transition-colors ml-0.5"
        title="Stop timer"
      >
        <X size={12} />
      </button>
    </div>
  );
}
