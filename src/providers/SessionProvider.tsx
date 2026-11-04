"use client";

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  ReactNode,
  useEffect,
  useCallback,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { getDb, saveDb, getSetting, setSetting } from "@/db";
import { sessions } from "@/db/schema";
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
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [lastFocusPage, setLastFocusPage] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startPage, setStartPage] = useState<number | null>(null);
  const [currentPage, setCurrentPageState] = useState(1);
  const [isSessionSyncing, setIsSessionSyncing] = useState(true);

  const setCurrentPage = useCallback(async (page: number) => {
    setCurrentPageState(page);
    try {
      await setSetting("lastPage", page.toString());
    } catch (error) {}
  }, []);

  const syncSessionWithFile = useCallback(async (filePath: string) => {
    // ✅ FIX: اگر فایل پاس داده نشد، لودینگ باید متوقف شود
    if (!filePath) {
      setIsSessionSyncing(false);
      return;
    }
    setIsSessionSyncing(true);

    try {
      const db = await getDb();

      // آیا سشن فعالی وجود دارد؟
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
        // سشن بسته است، آخرین سشن را برای Resume پیدا می‌کنیم
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
          // ✅ FIX: Get the absolute last page from DB
          const lastKnownPage =
            latest.endPage || latest.lastPage || latest.startPage;

          setLastFocusPage(lastKnownPage);

          // ✅ CRITICAL FIX: Sync currentPage so UI shows the correct page
          setCurrentPageState(lastKnownPage);
          await setSetting("lastPage", lastKnownPage.toString());
        } else {
          setLastFocusPage(null);
          setCurrentPageState(1);
          await setSetting("lastPage", "1");
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

  useEffect(() => {
    if (isActive && sessionId) {
      const updateLastPage = async () => {
        try {
          const db = await getDb();
          await db
            .update(sessions)
            .set({ lastPage: currentPage })
            .where(eq(sessions.id, sessionId));
          await saveDb(true);
        } catch (e) {}
      };
      updateLastPage();
    }
  }, [currentPage, isActive, sessionId]);

  const startSession = useCallback(
    async (filePath: string, totalPages?: number) => {
      if (!filePath) return;
      try {
        playStartSound();
        const newId = uuidv4();
        setSessionId(newId);

        // ✅ محاسبه دقیق صفحه شروع
        let targetPage = currentPage;
        if (lastFocusPage !== null) {
          targetPage = lastFocusPage + 1;
          // اگر به انتهای فایل رسیده بودیم، از خود صفحه آخر شروع کن
          if (totalPages && targetPage > totalPages) {
            targetPage = totalPages;
          }
        }

        setStartPage(targetPage);
        setCurrentPageState(targetPage);
        setIsActive(true);

        const db = await getDb();
        await db.insert(sessions).values({
          id: newId,
          filePath,
          startTime: Date.now(),
          startPage: targetPage,
          lastPage: targetPage,
        });
        await saveDb(true);
      } catch (error) {}
    },
    [currentPage, lastFocusPage],
  );

  const endSession = useCallback(async () => {
    if (!sessionId || startPage === null) return;

    try {
      playEndSound();
      const pagesRead = Math.abs(currentPage - startPage) + 1;

      setIsActive(false);
      setSessionId(null);
      setStartPage(null);
      // ✅ آپدیت کردن lastFocusPage با صفحه فعلی
      setLastFocusPage(currentPage);

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
    } catch (error) {}
  }, [sessionId, startPage, currentPage]);

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
    }),
    [
      isActive,
      lastFocusPage,
      sessionId,
      startPage,
      currentPage,
      isSessionSyncing,
      setCurrentPage,
      startSession,
      endSession,
      syncSessionWithFile,
      clearSessionState,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
