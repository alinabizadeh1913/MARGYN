"use client";

import React, { useState, memo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Lock,
} from "lucide-react";
import Typography from "@/typography";

interface CalendarWidgetProps {
  sessionsByDate: Record<string, any[]>;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  viewedDays: Set<string>;
  now: number;
}

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function CalendarWidgetImpl({
  sessionsByDate,
  selectedDate,
  onSelectDate,
  viewedDays,
  now,
}: CalendarWidgetProps) {
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date(selectedDate);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  });

  const prevWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(weekStart.getDate() - 7);
    setWeekStart(newStart);
  };

  const nextWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(weekStart.getDate() + 7);
    setWeekStart(newStart);
  };

  const goToToday = () => {
    const today = new Date(now);
    const day = today.getDay();
    const diff = today.getDate() - day;
    setWeekStart(new Date(today.setDate(diff)));
    onSelectDate(new Date(now));
  };

  const formatDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const today = new Date(now);
  const todayKey = formatDateKey(today);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  return (
    <div className="bg-nm-panel border border-nm-edge rounded-3xl p-6 shadow-sm w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col">
          <Typography variant="cardTitle" className="text-nm-text text-xl">
            {weekStart.toLocaleString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </Typography>
          <Typography variant="caption" className="text-nm-dim mt-1">
            Week of{" "}
            {weekStart.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}{" "}
            -{" "}
            {weekDays[6].toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </Typography>
        </div>

        <div className="flex gap-2">
          <button
            onClick={goToToday}
            className="px-4 py-2 rounded-xl bg-nm-raise border border-nm-edge text-nm-muted hover:text-nm-text hover:bg-nm-line transition-all flex items-center justify-center gap-2 text-sm font-medium"
          >
            <CalendarIcon size={16} />
            Today
          </button>
          <button
            onClick={prevWeek}
            className="p-2 rounded-xl bg-nm-raise border border-nm-edge text-nm-muted hover:text-nm-text hover:bg-nm-line transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={nextWeek}
            className="p-2 rounded-xl bg-nm-raise border border-nm-edge text-nm-muted hover:text-nm-text hover:bg-nm-line transition-all"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 w-full">
        {weekDays.map((dateObj, index) => {
          const dateKey = formatDateKey(dateObj);
          const hasSessions =
            !!sessionsByDate[dateKey] && sessionsByDate[dateKey].length > 0;
          const isSelected =
            selectedDate.getDate() === dateObj.getDate() &&
            selectedDate.getMonth() === dateObj.getMonth() &&
            selectedDate.getFullYear() === dateObj.getFullYear();
          const isToday = todayKey === dateKey;

          const startOfDay = new Date(
            dateObj.getFullYear(),
            dateObj.getMonth(),
            dateObj.getDate(),
            0,
            0,
            0,
            0,
          ).getTime();
          const unlockTime = startOfDay + 7 * 24 * 60 * 60 * 1000;
          const isUnlocked = hasSessions && now >= unlockTime;
          const isUnseen = isUnlocked && !viewedDays.has(dateKey);
          const isLocked = hasSessions && !isUnlocked;

          return (
            <button
              key={dateKey}
              onClick={() => onSelectDate(dateObj)}
              className={`relative flex flex-col items-center justify-center p-4 rounded-2xl transition-all duration-300 border ${
                isSelected
                  ? "bg-nm-accent text-white border-nm-accent shadow-nm-glow scale-[1.02] z-10"
                  : "bg-nm-deep border-nm-edge text-nm-text hover:bg-nm-raise hover:border-nm-faint"
              } ${isToday && !isSelected ? "border-nm-accent/50" : ""}`}
            >
              <span
                className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${isSelected ? "text-black/60" : "text-nm-dim"}`}
              >
                {DAYS_OF_WEEK[index].substring(0, 3)}
              </span>
              <span
                className={`text-2xl font-bold ${isSelected ? "text-black" : isToday ? "text-nm-accent" : "text-nm-text"}`}
              >
                {dateObj.getDate()}
              </span>

              <div className="absolute bottom-2 flex items-center justify-center h-2">
                {hasSessions && (
                  <>
                    {isUnseen ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    ) : isUnlocked ? (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-black/50" : "bg-emerald-500"}`}
                      />
                    ) : (
                      <Lock
                        size={10}
                        className={
                          isSelected ? "text-black/40" : "text-nm-dim"
                        }
                      />
                    )}
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default memo(CalendarWidgetImpl);
