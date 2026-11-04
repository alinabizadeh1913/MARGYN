"use client";

import React, { useEffect, useState, useMemo } from "react";
import { getDb } from "@/db";
import { sessions, recentFiles } from "@/db/schema";
import {
  Lock,
  CheckCircle2,
  Shield,
  Clock,
  FileText,
  BookOpen,
} from "lucide-react";
import { desc, isNotNull } from "drizzle-orm";
import Typography from "@/typography";
import CalendarWidget from "./CalendarWidget";

type SessionData = typeof sessions.$inferSelect & {
  startTime: number;
  endTime: number;
  startPage: number;
  endPage: number;
  pagesRead: number;
};
type RecentFileData = typeof recentFiles.$inferSelect;

export default function HistoryView() {
  const [allSessions, setAllSessions] = useState<SessionData[]>([]);
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewedDays, setViewedDays] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const db = await getDb();
        const data = await db
          .select()
          .from(sessions)
          .where(isNotNull(sessions.endTime))
          .orderBy(desc(sessions.startTime));

        setAllSessions(data as SessionData[]);

        const recents = await db.select().from(recentFiles);
        const nameMap: Record<string, string> = {};
        recents.forEach((f: RecentFileData) => {
          nameMap[f.filePath] = f.name;
        });
        setFileNames(nameMap);
      } catch (err) {
        console.error("Failed to fetch history:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, []);

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

  const isSelectedDayLocked =
    selectedSessions.length > 0 &&
    now - selectedSessions[0].startTime <= SEVEN_DAYS_MS;

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

  // تایپ ورودی به string | null تغییر کرد تا خطا برطرف شود
  const getFileName = (filePath: string | null) => {
    if (!filePath) return "Unknown Document";
    if (fileNames[filePath]) return fileNames[filePath];
    const parts = filePath.split("-");
    if (parts.length > 1) return parts.slice(1).join("-");
    return filePath.split(/[/\\]/).pop() || "Document.pdf";
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] p-8 overflow-y-auto">
      <div className="max-w-6xl w-full mx-auto">
        <header className="mb-8 flex items-end justify-between">
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
                ) : isSelectedDayLocked ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <div className="w-16 h-16 bg-[#18181b] rounded-full flex items-center justify-center mb-4 border border-[#27272a]">
                      <Lock size={28} className="text-[#52525b]" />
                    </div>
                    <Typography
                      variant="cardTitle"
                      className="text-[#fafafa] mb-2"
                    >
                      Locked
                    </Typography>
                    <Typography
                      variant="body"
                      className="text-[#a1a1aa] max-w-xs"
                    >
                      The stats for this day are hidden. Focus on the present.
                      The truth will be revealed in a few days.
                    </Typography>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedSessions.map((session, idx) => (
                      <div
                        key={session.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-[#18181b] border border-[#27272a] hover:border-emerald-500/30 transition-colors gap-4"
                      >
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <CheckCircle2
                              size={18}
                              className="text-emerald-500"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText
                                size={14}
                                className="text-[#38bdf8] shrink-0"
                              />
                              <Typography
                                variant="label"
                                className="text-[#fafafa] block truncate"
                                title={getFileName(session.filePath)}
                              >
                                {getFileName(session.filePath)}
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
                              className="text-[#38bdf8]"
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
    </div>
  );
}
