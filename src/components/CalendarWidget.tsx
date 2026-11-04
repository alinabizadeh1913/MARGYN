"use client";

import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from "lucide-react";
import Typography from "@/typography";

interface CalendarWidgetProps {
  sessionsByDate: Record<string, any[]>;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  viewedDays: Set<string>;
}

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function CalendarWidget({
  sessionsByDate,
  selectedDate,
  onSelectDate,
  viewedDays,
}: CalendarWidgetProps) {
  const [currentMonth, setCurrentMonth] = useState(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const prevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
    );
  };

  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    );
  };

  // ✅ تابع رفتن به امروز
  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onSelectDate(today);
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const renderCells = () => {
    const cells = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="h-10 w-10" />);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

      const hasSessions =
        !!sessionsByDate[dateKey] && sessionsByDate[dateKey].length > 0;
      const isSelected =
        selectedDate.getDate() === d &&
        selectedDate.getMonth() === month &&
        selectedDate.getFullYear() === year;
      const isToday = todayKey === dateKey;

      const isUnlocked =
        hasSessions &&
        today.getTime() - dateObj.getTime() > 7 * 24 * 60 * 60 * 1000;
      const isUnseen = isUnlocked && !viewedDays.has(dateKey);

      cells.push(
        <button
          key={dateKey}
          onClick={() => onSelectDate(dateObj)}
          className={`relative h-10 w-10 rounded-xl flex flex-col items-center justify-center transition-all duration-200
            ${isSelected ? "bg-[#38bdf8] text-black shadow-[0_0_15px_rgba(56,189,248,0.4)]" : "hover:bg-[#27272a] text-[#fafafa]"}
            ${isToday && !isSelected ? "border border-[#38bdf8]/50 text-[#38bdf8]" : ""}
          `}
        >
          <span
            className={`text-sm ${isSelected ? "font-bold" : "font-medium"}`}
          >
            {d}
          </span>

          {hasSessions && (
            <div className="absolute bottom-1.5 flex gap-0.5">
              {isUnseen ? (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              ) : isUnlocked ? (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-black/50" : "bg-emerald-500"}`}
                />
              ) : (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-black/30" : "bg-[#52525b]"}`}
                />
              )}
            </div>
          )}
        </button>,
      );
    }

    return cells;
  };

  return (
    <div className="bg-[#121214] border border-[#27272a] rounded-3xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <Typography variant="cardTitle" className="text-[#fafafa]">
          {currentMonth.toLocaleString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </Typography>
        <div className="flex gap-2">
          {/* ✅ دکمه Today */}
          <button
            onClick={goToToday}
            className="px-3 py-2 rounded-xl bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] transition-all flex items-center justify-center"
            title="Go to Today"
          >
            <CalendarIcon size={16} />
          </button>

          <button
            onClick={prevMonth}
            className="p-2 rounded-xl bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] transition-all"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={nextMonth}
            className="p-2 rounded-xl bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] transition-all"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAYS_OF_WEEK.map((day) => (
          <div key={day} className="h-8 flex items-center justify-center">
            <span className="text-[11px] font-bold text-[#52525b] uppercase tracking-wider">
              {day}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 place-items-center">
        {renderCells()}
      </div>
    </div>
  );
}
