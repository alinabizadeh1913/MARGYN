"use client";

import React, { useEffect, useState, useMemo } from "react";
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
} from "lucide-react";
import { desc, isNotNull, eq, and } from "drizzle-orm";
import Typography from "@/typography";
import CalendarWidget from "./CalendarWidget";

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
  onSessionDeleted?: () => void; // ✅ اضافه شد برای آپدیت Resume
}

const REQUIRED_DELETE_PHRASE = "DELETE SESSION";

export default function HistoryView({
  filePath,
  fileName,
  onSessionDeleted,
}: HistoryViewProps) {
  const [allSessions, setAllSessions] = useState<SessionData[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewedDays, setViewedDays] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [deleteError, setDeleteError] = useState(false);

  // ✅ استیت برای هشدار حذف غیرمجاز
  const [showOrderErrorModal, setShowOrderErrorModal] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("margyn_viewed_days");
    if (saved) {
      try {
        setViewedDays(new Set(JSON.parse(saved)));
      } catch (e) {
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

  const formatDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  const sessionsByDate = useMemo(() => {
    const grouped: Record<string, SessionData[]> = {};
    allSessions.forEach((session) => {
      const date = new Date(session.startTime);
      const key = formatDateKey(date);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(session);
    });
    return grouped;
  }, [allSessions]);

  const selectedDateKey = formatDateKey(selectedDate);
  const selectedSessions = sessionsByDate[selectedDateKey] || [];

  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  const unseenDaysCount = useMemo(() => {
    let count = 0;
    Object.keys(sessionsByDate).forEach((dateKey) => {
      const daySessions = sessionsByDate[dateKey];
      if (daySessions.length > 0) {
        const isUnlocked = now - daySessions[0].startTime > SEVEN_DAYS_MS;
        const isUnseen = !viewedDays.has(dateKey);
        if (isUnlocked && isUnseen) count++;
      }
    });
    return count;
  }, [sessionsByDate, viewedDays, now]);

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    const dateKey = formatDateKey(date);
    const daySessions = sessionsByDate[dateKey] || [];

    if (daySessions.length > 0) {
      const isUnlocked = now - daySessions[0].startTime > SEVEN_DAYS_MS;
      if (isUnlocked && !viewedDays.has(dateKey)) {
        const newViewed = new Set(viewedDays);
        newViewed.add(dateKey);
        setViewedDays(newViewed);
        localStorage.setItem(
          "margyn_viewed_days",
          JSON.stringify(Array.from(newViewed)),
        );
      }
    }
  };

  // ✅ بررسی ترتیب حذف
  const handleOpenDeleteModal = (sessionId: string, index: number) => {
    if (index > 0) {
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

      // آپدیت لیست
      await fetchHistory();

      // ✅ به کامپوننت اصلی اطلاع میده که سشن آپدیت بشه تا Resume درست کار کنه
      if (onSessionDeleted) {
        onSessionDeleted();
      }
    } else {
      setDeleteError(true);
      setDeleteText("");
    }
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
    <div className="flex flex-col h-full w-full bg-[#09090b] p-8 overflow-y-auto relative">
      <div className="max-w-6xl w-full mx-auto">
        <header className="mb-8 flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Shield className="text-emerald-500" size={28} />
              <Typography
                variant="pageTitle"
                as="h1"
                className="text-[#fafafa]"
              >
                The 7-Day Lock
              </Typography>

              {unseenDaysCount > 0 && (
                <span className="ml-2 px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold rounded-full animate-pulse">
                  {unseenDaysCount} New {unseenDaysCount === 1 ? "Day" : "Days"}
                </span>
              )}
            </div>
            <Typography
              variant="body"
              as="p"
              className="text-[#a1a1aa] max-w-xl"
            >
              To protect your mind from obsessive counting, your reading stats
              are kept hidden for 7 days. After a week has passed, the truth is
              revealed here.
            </Typography>

            <div className="mt-4 flex items-center gap-2 bg-[#121214] border border-[#27272a] px-3 py-1.5 rounded-lg w-fit">
              <FileText size={14} className="text-[#38bdf8]" />
              <Typography
                variant="caption"
                className="text-[#fafafa] font-medium"
              >
                {fileName || "Current Document"}
              </Typography>
            </div>
          </div>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-white/10 border-t-[#38bdf8] rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-5 lg:col-span-4">
              <CalendarWidget
                sessionsByDate={sessionsByDate}
                selectedDate={selectedDate}
                onSelectDate={handleSelectDate}
                viewedDays={viewedDays}
              />
            </div>

            <div className="md:col-span-7 lg:col-span-8">
              <div className="bg-[#121214] border border-[#27272a] rounded-3xl p-6 h-full min-h-[400px]">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#27272a]">
                  <div className="flex items-center gap-3">
                    <BookOpen className="text-[#a1a1aa]" size={20} />
                    <Typography variant="cardTitle" className="text-[#fafafa]">
                      {selectedDate.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Typography>
                  </div>
                  <Typography variant="caption" className="text-[#52525b]">
                    {selectedSessions.length}{" "}
                    {selectedSessions.length === 1 ? "Session" : "Sessions"}
                  </Typography>
                </div>

                {selectedSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <FileText size={48} className="text-[#27272a] mb-4" />
                    <Typography variant="body" className="text-[#52525b]">
                      No sessions recorded on this day.
                    </Typography>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedSessions.map((session, index) => (
                      <div
                        key={session.id}
                        className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-[#18181b] border border-[#27272a] transition-all gap-4 ${
                          index === 0
                            ? "hover:border-emerald-500/30"
                            : "opacity-75 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${index === 0 ? "bg-emerald-500/10" : "bg-[#27272a]"}`}
                          >
                            <CheckCircle2
                              size={18}
                              className={
                                index === 0
                                  ? "text-emerald-500"
                                  : "text-[#a1a1aa]"
                              }
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Typography
                                variant="label"
                                className="text-[#fafafa] block truncate"
                              >
                                Focus Session{" "}
                                {index === 0 && (
                                  <span className="text-[10px] text-emerald-500 ml-1">
                                    (Latest)
                                  </span>
                                )}
                              </Typography>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock size={12} className="text-[#52525b]" />
                              <Typography
                                variant="caption"
                                className="text-[#52525b]"
                              >
                                {new Date(session.startTime).toLocaleTimeString(
                                  "en-US",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}{" "}
                                -{" "}
                                {new Date(session.endTime).toLocaleTimeString(
                                  "en-US",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </Typography>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 self-end sm:self-auto shrink-0">
                          <div className="text-right">
                            <Typography
                              variant="microLabel"
                              className="text-[#52525b] block mb-1"
                            >
                              Pages
                            </Typography>
                            <Typography
                              variant="statSmall"
                              className={
                                index === 0
                                  ? "text-[#38bdf8]"
                                  : "text-[#a1a1aa]"
                              }
                            >
                              {session.pagesRead}
                            </Typography>
                          </div>
                          <div className="text-right hidden sm:block">
                            <Typography
                              variant="microLabel"
                              className="text-[#52525b] block mb-1"
                            >
                              From/To
                            </Typography>
                            <Typography
                              variant="body"
                              className="text-[#a1a1aa]"
                            >
                              {session.startPage} → {session.endPage}
                            </Typography>
                          </div>

                          {/* ✅ دکمه حذف با منطق جدید */}
                          <div className="pl-4 border-l border-[#27272a]">
                            <button
                              onClick={() =>
                                handleOpenDeleteModal(session.id, index)
                              }
                              className={`p-2 rounded-xl transition-all ${
                                index === 0
                                  ? "text-[#52525b] hover:text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                                  : "text-[#3f3f46] cursor-not-allowed hover:bg-transparent"
                              }`}
                              title={
                                index === 0
                                  ? "Delete Session"
                                  : "You must delete newer sessions first"
                              }
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ✅ مودال هشدار ترتیب حذف */}
      {showOrderErrorModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-md transition-all duration-300">
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
              To maintain data integrity, you can only delete the most recent
              session first. Please delete the latest session before removing
              older ones.
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

      {/* مودال تایید حذف */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-md transition-all duration-300">
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
    </div>
  );
}
