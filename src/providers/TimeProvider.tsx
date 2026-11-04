"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface TimeContextType {
  now: number;
  offset: number;
  setOffset: (offset: number) => void;
}

const TimeContext = createContext<TimeContextType | undefined>(undefined);

export function TimeProvider({ children }: { children: React.ReactNode }) {
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now() + offset);

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now() + offset);
    }, 1000);
    return () => clearInterval(interval);
  }, [offset]);

  useEffect(() => {
    // ✅ توابع سراسری برای تست دستی زمان از طریق کنسول (F12)
    (window as any).setMockTimeDays = (days: number) => {
      console.log(`Time shifted by ${days} days.`);
      setOffset(days * 24 * 60 * 60 * 1000);
    };
    (window as any).setMockTimeHours = (hours: number) => {
      console.log(`Time shifted by ${hours} hours.`);
      setOffset(hours * 60 * 60 * 1000);
    };
    (window as any).resetMockTime = () => {
      console.log("Time reset to real time.");
      setOffset(0);
    };
  }, []);

  return (
    <TimeContext.Provider value={{ now, offset, setOffset }}>
      {children}
    </TimeContext.Provider>
  );
}

export function useTime() {
  const context = useContext(TimeContext);
  if (!context) throw new Error("useTime must be used within TimeProvider");
  return context;
}
