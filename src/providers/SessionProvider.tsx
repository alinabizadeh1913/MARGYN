"use client";

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  ReactNode,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { getDb, saveDb, getSetting, setSetting } from "@/db";
import { sessions, recentFiles } from "@/db/schema";
import { eq, isNull, desc, and } from "drizzle-orm";
import { playStartSound, playEndSound } from "@/lib/audio";

interface SessionContextType {
  isActive: boolean;
  lastFocusPage: number | null;
  sessionId: string | null;
  startPage: number | null;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  startSession: (filePath: string, totalPages?: number) => Promise<void>;
  endSession: () => Promise<void>;
  syncSessionWithFile: (filePath: string) => Promise<void>;
  clearSessionState: () => void;
  isSessionSyncing: boolean;
  timerEndsAt: number | null;
  timerDurationMs: number | null;
  startTimer: (durationMs: number) => Promise<void>;
  stopTimer: () => Promise<void>;
  activeSessionFilePath: string | null; // ✅ اضافه شد
  timerFile: string | null; // ✅ اضافه شد
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [lastFocusPage, setLastFocusPage] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startPage, setStartPage] = useState<number | null>(null);
  const [currentPage, setCurrentPageState] = useState(1);
  const [isSessionSyncing, setIsSessionSyncing] = useState(true);

  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [timerDurationMs, setTimerDurationMs] = useState<number | null>(null);

  // ✅ استیت‌های جدید برای مدیریت فایل‌ها
  const [activeSessionFilePath, setActiveSessionFilePath] = useState<
    string | null
  >(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [timerFile, setTimerFile] = useState<string | null>(null);

  const lastPageTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingPageRef = useRef<{ sessionId: string; page: number } | null>(
    null,
  );

  const setCurrentPage = useCallback(async (page: number) => {
    setCurrentPageState(page);
  }, []);

  // ✅ آپدیت سینک کردن با در نظر گرفتن سشن‌های فایل‌های دیگر
  const syncSessionWithFile = useCallback(async (filePath: string) => {
    setCurrentFilePath(filePath);
    if (!filePath) {
      setIsSessionSyncing(false);
      return;
    }
    setIsSessionSyncing(true);

    try {
      const db = await getDb();

      // چک کردن تمام سشن‌های باز در کل نرم‌افزار
      const openSessions = await db
        .select()
        .from(sessions)
        .where(isNull(sessions.endTime));

      if (openSessions.length > 0) {
        const active = openSessions[0];
        setActiveSessionFilePath(active.filePath);

        if (active.filePath === filePath) {
          // سشن متعلق به همین فایل است
          setIsActive(true);
          setSessionId(active.id);
          setStartPage(active.startPage);
          const targetPage = active.lastPage || active.startPage;
          setCurrentPageState(targetPage);
        } else {
          // سشن متعلق به فایل دیگری است
          setIsActive(false);
          setSessionId(null);
          setStartPage(null);

          const fileRecord = await db
            .select()
            .from(recentFiles)
            .where(eq(recentFiles.filePath, filePath));

          if (
            fileRecord.length > 0 &&
            fileRecord[0].lastPage &&
            fileRecord[0].lastPage > 1
          ) {
            setLastFocusPage(null);
            setCurrentPageState(fileRecord[0].lastPage);
          } else {
            setLastFocusPage(null);
            setCurrentPageState(1);
          }
        }
      } else {
        // هیچ سشن بازی در کل نرم‌افزار وجود ندارد
        setActiveSessionFilePath(null);
        setIsActive(false);
        setSessionId(null);
        setStartPage(null);

        const latestSessions = await db
          .select()
          .from(sessions)
          .where(eq(sessions.filePath, filePath))
          .orderBy(desc(sessions.startTime))
          .limit(1);

        if (latestSessions.length > 0) {
          const latest = latestSessions[0];
          const lastKnownPage =
            latest.endPage || latest.lastPage || latest.startPage;
          setLastFocusPage(lastKnownPage);
          setCurrentPageState(lastKnownPage);
        } else {
          const fileRecord = await db
            .select()
            .from(recentFiles)
            .where(eq(recentFiles.filePath, filePath));

          if (
            fileRecord.length > 0 &&
            fileRecord[0].lastPage &&
            fileRecord[0].lastPage > 1
          ) {
            setLastFocusPage(null);
            setCurrentPageState(fileRecord[0].lastPage);
          } else {
            setLastFocusPage(null);
            setCurrentPageState(1);
          }
        }
      }
    } catch (error) {
      console.error("Failed to sync session:", error);
    } finally {
      setIsSessionSyncing(false);
    }
  }, []);

  const clearSessionState = useCallback(() => {
    setIsActive(false);
    setSessionId(null);
    setStartPage(null);
    setLastFocusPage(null);
    setActiveSessionFilePath(null);
  }, []);

  useEffect(() => {
    if (isActive && sessionId) {
      pendingPageRef.current = { sessionId, page: currentPage };

      if (lastPageTimerRef.current) clearTimeout(lastPageTimerRef.current);

      lastPageTimerRef.current = setTimeout(async () => {
        const pending = pendingPageRef.current;
        if (!pending) return;
        try {
          const db = await getDb();
          await db
            .update(sessions)
            .set({ lastPage: pending.page })
            .where(eq(sessions.id, pending.sessionId));
          await saveDb();
        } catch {}
      }, 1500);
    }

    return () => {
      if (lastPageTimerRef.current) clearTimeout(lastPageTimerRef.current);
    };
  }, [currentPage, isActive, sessionId]);

  // ✅ استارت سشن با چک کردن قفل سراسری
  const startSession = useCallback(
    async (filePath: string, totalPages?: number) => {
      if (!filePath) return;
      try {
        const db = await getDb();
        const openSessions = await db
          .select()
          .from(sessions)
          .where(isNull(sessions.endTime));

        if (openSessions.length > 0) {
          const existing = openSessions[0];
          if (existing.filePath !== filePath) {
            const recents = await db
              .select()
              .from(recentFiles)
              .where(eq(recentFiles.filePath, existing.filePath));
            const name = recents.length > 0 ? recents[0].name : "another file";
            // پرتاب ارور برای نمایش در UI
            throw new Error(`SESSION_ACTIVE:${name}`);
          }
        }

        playStartSound();
        const newId = uuidv4();

        let targetPage = currentPage;
        if (lastFocusPage !== null) {
          targetPage = lastFocusPage + 1;
          if (totalPages && targetPage > totalPages) targetPage = totalPages;
        }

        await db.insert(sessions).values({
          id: newId,
          filePath,
          startTime: Date.now(),
          startPage: targetPage,
          lastPage: targetPage,
        });
        await saveDb(true);

        setSessionId(newId);
        setStartPage(targetPage);
        setCurrentPageState(targetPage);
        setIsActive(true);
        setActiveSessionFilePath(filePath); // ✅ ثبت فایل در حال سشن
      } catch (error: any) {
        console.error("Failed to start session:", error);
        if (error.message && error.message.startsWith("SESSION_ACTIVE:")) {
          throw error; // به UI پاس می‌دهیم
        }
        window.dispatchEvent(
          new CustomEvent("margyn-save-error", {
            detail: "Failed to start session. Please try again.",
          }),
        );
      }
    },
    [currentPage, lastFocusPage],
  );

  const stopTimer = useCallback(async () => {
    setTimerEndsAt(null);
    setTimerDurationMs(null);
    setTimerFile(null);
    await setSetting("timerEndsAt", "");
    await setSetting("timerDurationMs", "");
    await setSetting("timerFile", "");
  }, []);

  const endSession = useCallback(async () => {
    if (!sessionId || startPage === null) return;

    try {
      if (lastPageTimerRef.current) {
        clearTimeout(lastPageTimerRef.current);
        lastPageTimerRef.current = null;
      }
      pendingPageRef.current = null;

      playEndSound();
      await stopTimer();
      const pagesRead = Math.abs(currentPage - startPage) + 1;

      const db = await getDb();
      await db
        .update(sessions)
        .set({
          endTime: Date.now(),
          endPage: currentPage,
          lastPage: currentPage,
          pagesRead,
        })
        .where(eq(sessions.id, sessionId));
      await saveDb(true);

      setIsActive(false);
      setSessionId(null);
      setStartPage(null);
      setLastFocusPage(currentPage);
      setActiveSessionFilePath(null); // ✅ آزادسازی قفل
    } catch (error) {
      console.error("Failed to end session:", error);
    }
  }, [sessionId, startPage, currentPage, stopTimer]);

  // ✅ استارت تایمر با ثبت نام فایل
  const startTimer = useCallback(
    async (durationMs: number) => {
      const endsAt = Date.now() + durationMs;
      setTimerEndsAt(endsAt);
      setTimerDurationMs(durationMs);
      setTimerFile(currentFilePath);
      await setSetting("timerEndsAt", endsAt.toString());
      await setSetting("timerDurationMs", durationMs.toString());
      await setSetting("timerFile", currentFilePath || "");
    },
    [currentFilePath],
  );

  useEffect(() => {
    const loadTimer = async () => {
      try {
        const endsAtStr = await getSetting("timerEndsAt");
        const durationStr = await getSetting("timerDurationMs");
        const fileStr = await getSetting("timerFile");
        if (endsAtStr && durationStr) {
          const endsAtNum = parseInt(endsAtStr, 10);
          if (endsAtNum > Date.now()) {
            setTimerEndsAt(endsAtNum);
            setTimerDurationMs(parseInt(durationStr, 10));
            setTimerFile(fileStr || null);
          } else {
            await stopTimer();
          }
        }
      } catch {}
    };
    loadTimer();
  }, [stopTimer]);

  const value = useMemo(
    () => ({
      isActive,
      lastFocusPage,
      sessionId,
      startPage,
      currentPage,
      setCurrentPage,
      startSession,
      endSession,
      syncSessionWithFile,
      clearSessionState,
      isSessionSyncing,
      timerEndsAt,
      timerDurationMs,
      startTimer,
      stopTimer,
      activeSessionFilePath, // ✅
      timerFile, // ✅
    }),
    [
      isActive,
      lastFocusPage,
      sessionId,
      startPage,
      currentPage,
      isSessionSyncing,
      timerEndsAt,
      timerDurationMs,
      setCurrentPage,
      startSession,
      endSession,
      syncSessionWithFile,
      clearSessionState,
      startTimer,
      stopTimer,
      activeSessionFilePath,
      timerFile,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined)
    throw new Error("useSession must be used within a SessionProvider");
  return context;
}
