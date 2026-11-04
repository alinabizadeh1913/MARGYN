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
  // ✅ Focus Timer
  timerEndsAt: number | null;
  timerDurationMs: number | null;
  startTimer: (durationMs: number) => Promise<void>;
  stopTimer: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [lastFocusPage, setLastFocusPage] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startPage, setStartPage] = useState<number | null>(null);
  const [currentPage, setCurrentPageState] = useState(1);
  const [isSessionSyncing, setIsSessionSyncing] = useState(true);

  // ✅ Focus Timer state
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [timerDurationMs, setTimerDurationMs] = useState<number | null>(null);

  // ✅ debounce برای updateLastPage
  const lastPageTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingPageRef = useRef<{ sessionId: string; page: number } | null>(
    null,
  );

  const setCurrentPage = useCallback(async (page: number) => {
    setCurrentPageState(page);
    try {
      await setSetting("lastPage", page.toString());
    } catch (error) {}
  }, []);

  const syncSessionWithFile = useCallback(async (filePath: string) => {
    if (!filePath) {
      setIsSessionSyncing(false);
      return;
    }
    setIsSessionSyncing(true);

    try {
      const db = await getDb();

      const openSessions = await db
        .select()
        .from(sessions)
        .where(and(isNull(sessions.endTime), eq(sessions.filePath, filePath)));

      if (openSessions.length > 0) {
        const active = openSessions[0];
        setIsActive(true);
        setSessionId(active.id);
        setStartPage(active.startPage);
        const targetPage = active.lastPage || active.startPage;
        setCurrentPageState(targetPage);
        await setSetting("lastPage", targetPage.toString());
      } else {
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
          await setSetting("lastPage", lastKnownPage.toString());
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
            await setSetting("lastPage", fileRecord[0].lastPage.toString());
          } else {
            setLastFocusPage(null);
            setCurrentPageState(1);
            await setSetting("lastPage", "1");
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
  }, []);

  // ✅ debounce روی updateLastPage - جلوگیری از I/O storm
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
        } catch (e) {}
      }, 1500);
    }

    return () => {
      if (lastPageTimerRef.current) clearTimeout(lastPageTimerRef.current);
    };
  }, [currentPage, isActive, sessionId]);

  // ✅ شروع session: اول DB، بعد UI
  const startSession = useCallback(
    async (filePath: string, totalPages?: number) => {
      if (!filePath) return;
      try {
        playStartSound();
        const newId = uuidv4();

        let targetPage = currentPage;
        if (lastFocusPage !== null) {
          targetPage = lastFocusPage + 1;
          if (totalPages && targetPage > totalPages) targetPage = totalPages;
        }

        const db = await getDb();
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
      } catch (error) {
        console.error("Failed to start session:", error);
        window.dispatchEvent(
          new CustomEvent("margyn-save-error", {
            detail: "Failed to start session. Please try again.",
          }),
        );
      }
    },
    [currentPage, lastFocusPage],
  );

  const endSession = useCallback(async () => {
    if (!sessionId || startPage === null) return;

    try {
      // ✅ پاک کردن pending timer
      if (lastPageTimerRef.current) {
        clearTimeout(lastPageTimerRef.current);
        lastPageTimerRef.current = null;
      }
      pendingPageRef.current = null;

      playEndSound();
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
    } catch (error) {
      console.error("Failed to end session:", error);
    }
  }, [sessionId, startPage, currentPage]);

  // ✅ Focus Timer
  const startTimer = useCallback(async (durationMs: number) => {
    const endsAt = Date.now() + durationMs;
    setTimerEndsAt(endsAt);
    setTimerDurationMs(durationMs);
    await setSetting("timerEndsAt", endsAt.toString());
    await setSetting("timerDurationMs", durationMs.toString());
  }, []);

  const stopTimer = useCallback(async () => {
    setTimerEndsAt(null);
    setTimerDurationMs(null);
    await setSetting("timerEndsAt", "");
    await setSetting("timerDurationMs", "");
  }, []);

  // ✅ بازیابی timer از DB در start
  useEffect(() => {
    const loadTimer = async () => {
      try {
        const endsAtStr = await getSetting("timerEndsAt");
        const durationStr = await getSetting("timerDurationMs");
        if (endsAtStr && durationStr) {
          const endsAtNum = parseInt(endsAtStr, 10);
          if (endsAtNum > Date.now()) {
            setTimerEndsAt(endsAtNum);
            setTimerDurationMs(parseInt(durationStr, 10));
          } else {
            await setSetting("timerEndsAt", "");
            await setSetting("timerDurationMs", "");
          }
        }
      } catch (e) {}
    };
    loadTimer();
  }, []);

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
