"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/* =========================================================
   MARGYN — Time Engine
   ---------------------------------------------------------
   High-performance, granular time source.

   Design:
   - One rAF-driven ticker, auto-stops when nobody subscribes.
   - Three independent subscription channels:
       * useNowSecond()  → once per second  (live countdowns)
       * useNowMinute()  → once per minute  (calendar, 7-day locks)
       * useTimeOffset() → only on manual shift (dev tools)
   - The Provider itself never re-renders on time ticks.
   - Legacy `useTime()` still works but only exposes `offset`
     (which changes only when the user hits a time-travel button).
========================================================= */

let offsetMs = 0;
let rafId = 0;
let lastSecond = 0;
let lastMinute = 0;

const secondListeners = new Set<() => void>();
const minuteListeners = new Set<() => void>();
const offsetListeners = new Set<() => void>();

const emitSecond = () => secondListeners.forEach((l) => l());
const emitMinute = () => minuteListeners.forEach((l) => l());
const emitOffset = () => offsetListeners.forEach((l) => l());

const tick = () => {
  const now = Date.now() + offsetMs;
  const sec = Math.floor(now / 1000);
  if (sec !== lastSecond) {
    lastSecond = sec;
    emitSecond();
    const min = Math.floor(now / 60000);
    if (min !== lastMinute) {
      lastMinute = min;
      emitMinute();
    }
  }
  rafId = requestAnimationFrame(tick);
};

const start = () => {
  if (rafId) return;
  const now = Date.now() + offsetMs;
  lastSecond = Math.floor(now / 1000);
  lastMinute = Math.floor(now / 60000);
  rafId = requestAnimationFrame(tick);
};

const stop = () => {
  if (!rafId) return;
  cancelAnimationFrame(rafId);
  rafId = 0;
};

const subscribeSecond = (cb: () => void) => {
  secondListeners.add(cb);
  if (secondListeners.size === 1) start();
  return () => {
    secondListeners.delete(cb);
    if (secondListeners.size === 0 && minuteListeners.size === 0) stop();
  };
};

const subscribeMinute = (cb: () => void) => {
  minuteListeners.add(cb);
  if (minuteListeners.size === 1) start();
  return () => {
    minuteListeners.delete(cb);
    if (secondListeners.size === 0 && minuteListeners.size === 0) stop();
  };
};

const subscribeOffset = (cb: () => void) => {
  offsetListeners.add(cb);
  return () => {
    offsetListeners.delete(cb);
  };
};

const getNowSecond = () => Math.floor((Date.now() + offsetMs) / 1000) * 1000;
const getNowMinute = () => Math.floor((Date.now() + offsetMs) / 60000) * 60000;
const getOffset = () => offsetMs;
const getServerSnapshot = () => 0;

export function setTimeOffset(offset: number) {
  offsetMs = offset;
  lastSecond = 0;
  lastMinute = 0;
  emitOffset();
  emitSecond();
  emitMinute();
}

/* =========================================================
   Granular hooks
========================================================= */

export const useNowSecond = () =>
  useSyncExternalStore(subscribeSecond, getNowSecond, getServerSnapshot);

export const useNowMinute = () =>
  useSyncExternalStore(subscribeMinute, getNowMinute, getServerSnapshot);

export const useTimeOffset = () =>
  useSyncExternalStore(subscribeOffset, getOffset, getServerSnapshot);

/* =========================================================
   Legacy context — exposes only offset + setter.
   Consumers of `useTime()` will NOT re-render on time ticks.
========================================================= */

interface TimeContextType {
  offset: number;
  setOffset: (offset: number) => void;
}

const TimeContext = createContext<TimeContextType | undefined>(undefined);

export function TimeProvider({ children }: { children: ReactNode }) {
  const offset = useTimeOffset();

  const value = useMemo<TimeContextType>(
    () => ({ offset, setOffset: setTimeOffset }),
    [offset],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as any;
    const prevDays = w.setMockTimeDays;
    const prevHours = w.setMockTimeHours;
    const prevReset = w.resetMockTime;

    w.setMockTimeDays = (days: number) => {
      console.log(`Time shifted by ${days} day(s).`);
      setTimeOffset(days * 24 * 60 * 60 * 1000);
    };
    w.setMockTimeHours = (hours: number) => {
      console.log(`Time shifted by ${hours} hour(s).`);
      setTimeOffset(hours * 60 * 60 * 1000);
    };
    w.resetMockTime = () => {
      console.log("Time reset to real time.");
      setTimeOffset(0);
    };

    return () => {
      w.setMockTimeDays = prevDays;
      w.setMockTimeHours = prevHours;
      w.resetMockTime = prevReset;
    };
  }, []);

  return <TimeContext.Provider value={value}>{children}</TimeContext.Provider>;
}

export function useTime() {
  const ctx = useContext(TimeContext);
  if (!ctx) throw new Error("useTime must be used within TimeProvider");
  return ctx;
}
