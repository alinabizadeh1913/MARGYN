"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { getDb, deleteSessionById } from "@/db";
import { sessions } from "@/db/schema";
import {
  CheckCircle2,
  Shield,
  Clock,
  FileText,
  BookOpen,
  FolderArchive,
  Trash2,
  AlertTriangle,
  Lock,
  Timer,
  // Terminal, // ✅ کامنت شد (مربوط به بخش Time Travel)
  // FastForward, // ✅ کامنت شد (مربوط به بخش Time Travel)
  // RotateCcw, // ✅ کامنت شد (مربوط به بخش Time Travel)
} from "lucide-react";
import { desc, isNotNull, eq, and } from "drizzle-orm";
import Typography from "@/typography";
import CalendarWidget from "./CalendarWidget";
import { useTime, useNowMinute, useNowSecond } from "@/providers/TimeProvider";

type SessionData = typeof sessions.$inferSelect & {
  startTime: number;
  endTime: number;
  startPage: number;
  endPage: number;
  pagesRead: number;
};

interface HistoryViewProps {
  filePath?: string;
  fileName?: string;
  onSessionDeleted?: () => void;
}

const REQUIRED_DELETE_PHRASE = "DELETE SESSION";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/* ---------------------------------------------------------
   Isolated second-level countdown.
   Only this small component re-renders once per second.
--------------------------------------------------------- */
function Countdown({ unlockTime }: { unlockTime: number }) {
  const now = useNowSecond();
  const remaining = Math.max(0, unlockTime - now);
  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );
  const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((remaining % (1000 * 60)) / 1000);

  const items = [
    { label: "Days", val: days },
    { label: "Hours", val: hours },
    { label: "Mins", val: mins },
    { label: "Secs", val: secs },
  ];

  return (
    <div className="flex items-center gap-3 sm:gap-5">
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#09090b] border border-[#27272a] rounded-2xl flex items-center justify-center shadow-inner relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-3xl font-mono font-bold text-amber-400 relative z-10">
                {item.val.toString().padStart(2, "0")}
              </span>
            </div>
            <span className="text-[10px] uppercase font-bold text-[#52525b] mt-3 tracking-widest">
              {item.label}
            </span>
          </div>
          {i < 3 && (
            <span className="text-3xl font-bold text-[#3f3f46] -mt-6">:</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function HistoryView({
  filePath,
  fileName,
  onSessionDeleted,
}: HistoryViewProps) {
  const [allSessions, setAllSessions] = useState<SessionData[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewedDays, setViewedDays] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Only the offset channel — this re-renders only on time-travel shifts.
  const { offset, setOffset } = useTime();
  // Minute-level `now` for lock checks and grouping (60× fewer re-renders).
  const now = useNowMinute();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [deleteError, setDeleteError] = useState(false);
  const [showOrderErrorModal, setShowOrderErrorModal] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showDeleteModal) setShowDeleteModal(false);
        else if (showOrderErrorModal) setShowOrderErrorModal(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showDeleteModal, showOrderErrorModal]);

  useEffect(() => {
    const saved = localStorage.getItem("margyn_viewed_days");
    if (saved) {
      try {
        setViewedDays(new Set(JSON.parse(saved)));
      } catch {
        console.error("Corrupted viewed days data, clearing it.");
        localStorage.removeItem("margyn_viewed_days");
      }
    }
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    if (!filePath) {
      setAllSessions([]);
      setIsLoading(false);
      return;
    }

    try {
      const db = await getDb();
      const data = await db
        .select()
        .from(sessions)
        .where(
          and(isNotNull(sessions.endTime), eq(sessions.filePath, filePath)),
        )
        .orderBy(desc(sessions.startTime));

      setAllSessions(data as SessionData[]);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [filePath]);

  const formatDateKey = useCallback((date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }, []);

  const sessionsByDate = useMemo(() => {
    const grouped: Record<string, SessionData[]> = {};
    allSessions.forEach((session) => {
      const date = new Date(session.endTime || session.startTime);
      const key = formatDateKey(date);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(session);
    });
    return grouped;
  }, [allSessions, formatDateKey]);

  const selectedDateKey = formatDateKey(selectedDate);
  const selectedSessions = sessionsByDate[selectedDateKey] || [];

  const startOfDay = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate(),
    0,
    0,
    0,
    0,
  ).getTime();
  const unlockTime = startOfDay + SEVEN_DAYS_MS;
  const isLocked = now < unlockTime;

  const totalPagesForDay = useMemo(() => {
    return selectedSessions.reduce(
      (sum, session) => sum + (session.pagesRead || 0),
      0,
    );
  }, [selectedSessions]);

  const unseenDaysCount = useMemo(() => {
    let count = 0;
    Object.keys(sessionsByDate).forEach((dateKey) => {
      const daySessions = sessionsByDate[dateKey];
      if (daySessions.length > 0) {
        const d = new Date(daySessions[0].endTime || daySessions[0].startTime);
        const startOfDayForDay = new Date(
          d.getFullYear(),
          d.getMonth(),
          d.getDate(),
          0,
          0,
          0,
          0,
        ).getTime();
        const unlockTimeForDay = startOfDayForDay + SEVEN_DAYS_MS;

        const isUnlocked = now >= unlockTimeForDay;
        const isUnseen = !viewedDays.has(dateKey);

        if (isUnlocked && isUnseen) count++;
      }
    });
    return count;
  }, [sessionsByDate, viewedDays, now]);

  const handleSelectDate = useCallback(
    (date: Date) => {
      setSelectedDate(date);
      const dateKey = formatDateKey(date);
      const daySessions = sessionsByDate[dateKey] || [];

      if (daySessions.length > 0) {
        const d = new Date(daySessions[0].endTime || daySessions[0].startTime);
        const startOfDayForDay = new Date(
          d.getFullYear(),
          d.getMonth(),
          d.getDate(),
          0,
          0,
          0,
          0,
        ).getTime();
        const unlockTimeForDay = startOfDayForDay + SEVEN_DAYS_MS;

        if (now >= unlockTimeForDay && !viewedDays.has(dateKey)) {
          const newViewed = new Set(viewedDays);
          newViewed.add(dateKey);
          setViewedDays(newViewed);
          localStorage.setItem(
            "margyn_viewed_days",
            JSON.stringify(Array.from(newViewed)),
          );
        }
      }
    },
    [sessionsByDate, viewedDays, now, formatDateKey],
  );

  const handleOpenDeleteModal = (sessionId: string, index: number) => {
    const session = selectedSessions[index];
    if (!session) return;

    const sessionEnd = session.endTime || session.startTime;
    const age = now - sessionEnd;

    if (age > ONE_DAY_MS) {
      setShowOrderErrorModal(true);
      return;
    }

    setSessionToDelete(sessionId);
    setDeleteText("");
    setDeleteError(false);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteText === REQUIRED_DELETE_PHRASE && sessionToDelete) {
      await deleteSessionById(sessionToDelete);
      setShowDeleteModal(false);
      setSessionToDelete(null);
      await fetchHistory();
      if (onSessionDeleted) onSessionDeleted();
    } else {
      setDeleteError(true);
      setDeleteText("");
    }
  };

  // ✅ این توابع فعلا دست‌نخورده باقی ماندند تا در صورت نیاز مجدد به Time Travel از آن‌ها استفاده شود
  const handleTimeTravel = (ms: number) => {
    setOffset(offset + ms);
  };
  const handleResetTime = () => {
    setOffset(0);
  };
  const formatOffsetText = () => {
    if (offset === 0) return "Real Time";
    const days = Math.floor(offset / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (offset % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
    );
    const mins = Math.floor((offset % (1000 * 60 * 60)) / (1000 * 60));

    let text = "+";
    if (days > 0) text += `${days}d `;
    if (hours > 0) text += `${hours}h `;
    if (mins > 0) text += `${mins}m`;
    if (text === "+") text += `${Math.floor(offset / 1000)}s`;
    return text.trim();
  };

  if (!filePath) {
    return (
      <div className="flex flex-col h-full w-full bg-[#09090b] p-8 overflow-y-auto items-center justify-center">
        <div className="max-w-md text-center flex flex-col items-center">
          <div className="w-24 h-24 bg-[#121214] border border-[#27272a] rounded-full flex items-center justify-center mb-6 shadow-2xl">
            <FolderArchive size={40} className="text-[#52525b]" />
          </div>
          <Typography
            variant="pageTitle"
            as="h2"
            className="text-[#fafafa] mb-3"
          >
            No Active Document
          </Typography>
          <Typography variant="body" as="p" className="text-[#a1a1aa]">
            Open or import a project to view its reading history and session
            statistics.
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] overflow-y-auto relative">
      <div className="max-w-[1200px] w-full mx-auto p-8 pb-20">
        <header className="mb-8 flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Shield className="text-emerald-500" size={32} />
              <Typography
                variant="pageTitle"
                as="h1"
                className="text-[#fafafa] text-3xl font-bold"
              >
                The 7-Day Lock
              </Typography>
              {unseenDaysCount > 0 && (
                <span className="ml-2 px-3 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold rounded-full animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.2)]">
                  {unseenDaysCount} New {unseenDaysCount === 1 ? "Day" : "Days"}
                </span>
              )}
            </div>
            <Typography
              variant="body"
              as="p"
              className="text-[#a1a1aa] max-w-2xl leading-relaxed"
            >
              To protect your mind from obsessive counting, your reading stats
              are kept hidden for 7 days. After a week has passed, the truth is
              revealed here.
            </Typography>
            <div className="mt-5 flex items-center gap-2 bg-[#121214] border border-[#27272a] px-4 py-2 rounded-xl w-fit shadow-sm">
              <FileText size={16} className="text-[#38bdf8]" />
              <Typography
                variant="bodyMedium"
                className="text-[#fafafa] font-medium"
              >
                {fileName || "Current Document"}
              </Typography>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-32">
            <div className="w-10 h-10 border-4 border-white/10 border-t-[#38bdf8] rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <CalendarWidget
              sessionsByDate={sessionsByDate}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              viewedDays={viewedDays}
              now={now}
            />

            <div className="bg-[#121214] border border-[#27272a] rounded-3xl p-6 shadow-sm min-h-[400px] flex flex-col">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#27272a]">
                <div className="flex items-center gap-3">
                  <BookOpen className="text-[#a1a1aa]" size={22} />
                  <Typography
                    variant="cardTitle"
                    className="text-[#fafafa] text-xl"
                  >
                    {selectedDate.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Typography>
                </div>

                <div className="flex items-center gap-3">
                  {!isLocked && selectedSessions.length > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#38bdf8]/10 border border-[#38bdf8]/20 rounded-lg">
                      <FileText size={14} className="text-[#38bdf8]" />
                      <Typography
                        variant="caption"
                        className="text-[#38bdf8] font-bold text-sm"
                      >
                        {totalPagesForDay}{" "}
                        {totalPagesForDay === 1 ? "Page" : "Pages"} Read
                      </Typography>
                    </div>
                  )}
                  <div className="px-3 py-1.5 bg-[#18181b] border border-[#27272a] rounded-lg">
                    <Typography variant="caption" className="text-[#a1a1aa]">
                      {selectedSessions.length}{" "}
                      {selectedSessions.length === 1 ? "Session" : "Sessions"}
                    </Typography>
                  </div>
                </div>
              </div>

              {selectedSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 py-20 text-center">
                  <div className="w-20 h-20 bg-[#18181b] rounded-full flex items-center justify-center mb-4 border border-[#27272a]">
                    <FileText size={32} className="text-[#3f3f46]" />
                  </div>
                  <Typography
                    variant="cardTitle"
                    className="text-[#fafafa] mb-2"
                  >
                    No Sessions
                  </Typography>
                  <Typography variant="body" className="text-[#52525b]">
                    No sessions were recorded on this day.
                  </Typography>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {isLocked && (
                    <div className="bg-[#18181b] border border-amber-500/30 rounded-2xl p-8 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-[0_0_40px_rgba(245,158,11,0.05)]">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-amber-500/5 rounded-full blur-[80px] pointer-events-none" />

                      <div className="relative mb-6">
                        <div className="absolute inset-0 bg-amber-500/20 rounded-full animate-[pulse-ring_2s_ease-out_infinite]" />
                        <div className="absolute inset-0 bg-amber-500/20 rounded-full animate-[pulse-ring_2s_ease-out_infinite_0.5s]" />
                        <div className="relative w-20 h-20 bg-[#121214] rounded-full flex items-center justify-center border border-amber-500/30 z-10">
                          <Timer size={36} className="text-amber-500" />
                        </div>
                      </div>

                      <Typography
                        variant="pageTitle"
                        as="h3"
                        className="text-[#fafafa] mb-3 text-2xl"
                      >
                        Stats Locked
                      </Typography>
                      <Typography
                        variant="body"
                        className="text-[#a1a1aa] max-w-md mb-8"
                      >
                        To keep you focused on the present, the stats for this
                        day are encrypted and hidden. The truth will be revealed
                        once the 7-day lock expires.
                      </Typography>

                      <Countdown unlockTime={unlockTime} />
                    </div>
                  )}

                  <div className="space-y-3">
                    {selectedSessions.map((session, index) => (
                      <div
                        key={session.id}
                        className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-2xl bg-[#18181b] border transition-all duration-300 gap-4 ${
                          index === 0
                            ? "border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.05)]"
                            : "border-[#27272a] opacity-80 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center gap-5 w-full sm:w-auto">
                          <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${index === 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-[#121214] border-[#27272a]"}`}
                          >
                            {isLocked ? (
                              <Lock size={20} className="text-[#52525b]" />
                            ) : (
                              <CheckCircle2
                                size={22}
                                className={
                                  index === 0
                                    ? "text-emerald-500"
                                    : "text-[#a1a1aa]"
                                }
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Typography
                                variant="cardTitle"
                                className="text-[#fafafa] block truncate text-base"
                              >
                                Focus Session
                              </Typography>
                              {index === 0 && (
                                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-full border border-emerald-500/20">
                                  Latest
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock size={14} className="text-[#52525b]" />
                              <Typography
                                variant="caption"
                                className="text-[#a1a1aa] text-sm"
                              >
                                {new Date(session.startTime).toLocaleTimeString(
                                  "en-US",
                                  { hour: "2-digit", minute: "2-digit" },
                                )}{" "}
                                -{" "}
                                {new Date(session.endTime).toLocaleTimeString(
                                  "en-US",
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </Typography>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-8 self-end sm:self-auto shrink-0 bg-[#09090b] px-6 py-3 rounded-xl border border-[#27272a]">
                          <div className="text-center min-w-[50px]">
                            <Typography
                              variant="microLabel"
                              className="text-[#52525b] block mb-1"
                            >
                              Pages
                            </Typography>
                            {isLocked ? (
                              <div className="flex justify-center">
                                <Lock size={18} className="text-[#3f3f46]" />
                              </div>
                            ) : (
                              <Typography
                                variant="statSmall"
                                className={
                                  index === 0
                                    ? "text-[#38bdf8] font-bold text-lg"
                                    : "text-[#a1a1aa] font-bold text-lg"
                                }
                              >
                                {session.pagesRead}
                              </Typography>
                            )}
                          </div>

                          <div className="w-px h-8 bg-[#27272a]" />

                          <div className="text-center min-w-[70px]">
                            <Typography
                              variant="microLabel"
                              className="text-[#52525b] block mb-1"
                            >
                              Range
                            </Typography>
                            {isLocked ? (
                              <div className="flex justify-center">
                                <Lock size={18} className="text-[#3f3f46]" />
                              </div>
                            ) : (
                              <Typography
                                variant="body"
                                className="text-[#fafafa] font-mono text-sm"
                              >
                                {session.startPage}{" "}
                                <span className="text-[#52525b]">→</span>{" "}
                                {session.endPage}
                              </Typography>
                            )}
                          </div>

                          <div className="w-px h-8 bg-[#27272a]" />

                          <div className="pl-2">
                            <button
                              onClick={() =>
                                handleOpenDeleteModal(session.id, index)
                              }
                              className="p-2 rounded-xl transition-all text-[#52525b] hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                              title="Delete Session"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ✅ بخش Developer Tools: Time Travel کامنت شد */}
        {/* 
        <div className="mt-8 bg-[#121214] border border-amber-500/30 rounded-3xl p-6 shadow-[0_0_30px_rgba(245,158,11,0.05)] animate-in fade-in slide-in-from-bottom-8 duration-500 delay-150">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#27272a]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                <Terminal className="text-amber-500" size={20} />
              </div>
              <div>
                <Typography variant="cardTitle" className="text-amber-500">
                  Developer Tools: Time Travel
                </Typography>
                <Typography variant="caption" className="text-[#a1a1aa]">
                  Simulate the passage of time to test the 7-day lock.
                </Typography>
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 bg-[#09090b] border border-[#27272a] rounded-xl shadow-inner">
              <span className="text-xs font-mono font-bold text-[#52525b]">
                Offset:
              </span>
              <span
                className={`text-sm font-mono font-bold ${offset > 0 ? "text-amber-400" : "text-emerald-400"}`}
              >
                {formatOffsetText()}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleTimeTravel(24 * 60 * 60 * 1000)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#18181b] hover:bg-[#27272a] text-[#fafafa] border border-[#3f3f46] rounded-xl transition-all font-medium text-sm active:scale-95 shadow-sm"
            >
              <FastForward size={16} className="text-amber-500" /> +1 Day
            </button>
            <button
              onClick={() => handleTimeTravel(60 * 60 * 1000)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#18181b] hover:bg-[#27272a] text-[#fafafa] border border-[#3f3f46] rounded-xl transition-all font-medium text-sm active:scale-95 shadow-sm"
            >
              <FastForward size={16} className="text-amber-500" /> +1 Hour
            </button>
            <button
              onClick={() => handleTimeTravel(60 * 1000)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#18181b] hover:bg-[#27272a] text-[#fafafa] border border-[#3f3f46] rounded-xl transition-all font-medium text-sm active:scale-95 shadow-sm"
            >
              <FastForward size={16} className="text-amber-500" /> +1 Min
            </button>
            <div className="w-px h-8 bg-[#27272a] mx-2 hidden sm:block" />
            <button
              onClick={handleResetTime}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl transition-all font-medium text-sm active:scale-95 shadow-sm"
            >
              <RotateCcw size={16} /> Reset to Real Time
            </button>
          </div>
        </div>
        */}
      </div>

      {showOrderErrorModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md transition-all duration-300">
          <div className="bg-[#121214] border border-amber-500/30 p-8 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] w-full max-w-md flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <AlertTriangle size={32} className="text-amber-500" />
            </div>
            <Typography
              variant="pageTitle"
              as="h2"
              className="text-[#fafafa] mb-2 font-semibold tracking-tight"
            >
              Cannot Delete
            </Typography>
            <Typography
              variant="body"
              as="p"
              className="text-[#a1a1aa] mb-8 leading-relaxed"
            >
              To maintain data integrity, only sessions recorded in the last 24
              hours can be deleted. Older sessions are locked to keep your stats
              intact.
            </Typography>
            <button
              onClick={() => setShowOrderErrorModal(false)}
              className="w-full px-4 py-3.5 rounded-xl bg-amber-500 text-black hover:bg-amber-400 transition-all font-medium shadow-[0_0_15px_rgba(245,158,11,0.3)] active:scale-[0.98]"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md transition-all duration-300">
          <div className="bg-[#121214] border border-rose-500/30 p-8 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] w-full max-w-md flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <AlertTriangle size={32} className="text-rose-500" />
            </div>
            <Typography
              variant="pageTitle"
              as="h2"
              className="text-[#fafafa] mb-2 font-semibold tracking-tight"
            >
              Delete Session?
            </Typography>
            <Typography
              variant="body"
              as="p"
              className="text-[#a1a1aa] mb-8 leading-relaxed"
            >
              This will permanently remove this session from your history.
              <br />
              <br />
              To confirm, type the following phrase in{" "}
              <strong>ALL CAPITAL LETTERS</strong>:
            </Typography>
            <div className="w-full bg-[#09090b] border border-[#27272a] rounded-2xl p-4 mb-6 flex items-center justify-center gap-3 select-none">
              <Lock size={16} className="text-[#52525b]" />
              <span className="text-[#fafafa] font-mono text-base font-bold tracking-widest">
                {REQUIRED_DELETE_PHRASE}
              </span>
            </div>
            <input
              type="text"
              value={deleteText}
              onChange={(e) => {
                setDeleteText(e.target.value);
                setDeleteError(false);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") handleConfirmDelete();
              }}
              onPaste={(e) => e.preventDefault()}
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
              autoComplete="off"
              spellCheck="false"
              placeholder="TYPE HERE (UPPERCASE ONLY)"
              autoFocus
              className={`w-full px-5 py-4 rounded-xl bg-[#18181b] border-2 outline-none transition-all text-center text-lg font-mono tracking-widest shadow-sm ${
                deleteError
                  ? "border-rose-400 focus:border-rose-500 text-rose-600 placeholder-rose-300 animate-shake"
                  : "border-[#27272a] focus:border-rose-500/50 text-[#fafafa]"
              }`}
            />
            {deleteError && (
              <Typography
                variant="caption"
                className="text-rose-500 mt-3 font-medium animate-pulse"
              >
                Incorrect. You must type it exactly as shown.
              </Typography>
            )}
            <div className="flex gap-3 w-full mt-8">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-3.5 rounded-xl bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] border border-[#27272a] transition-all font-medium active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-3.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-all font-medium shadow-[0_0_15px_rgba(244,63,94,0.3)] active:scale-[0.98]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes pulse-ring {
          0% {
            transform: scale(0.8);
            opacity: 0.5;
          }
          100% {
            transform: scale(1.8);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
