"use client";

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  ReactNode,
  useEffect,
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
  startSession: (filePath: string) => Promise<void>;
  endSession: () => Promise<void>;
  syncSessionWithFile: (filePath: string) => Promise<void>;
  clearSessionState: () => void;
  isSessionSyncing: boolean; // NEW
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [lastFocusPage, setLastFocusPage] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startPage, setStartPage] = useState<number | null>(null);
  const [currentPage, setCurrentPageState] = useState(1);

  // NEW: State to track if we are currently checking the database for a session
  const [isSessionSyncing, setIsSessionSyncing] = useState(true);

  const setCurrentPage = async (page: number) => {
    setCurrentPageState(page);
    try {
      await setSetting("lastPage", page.toString());
    } catch (error) {}
  };

  const syncSessionWithFile = async (filePath: string) => {
    if (!filePath) return;

    // Start syncing
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
          setLastFocusPage(
            latest.lastPage || latest.endPage || latest.startPage,
          );
        } else {
          setLastFocusPage(null);
        }
      }
    } catch (error) {
      console.error("Failed to sync session:", error);
    } finally {
      // Done syncing
      setIsSessionSyncing(false);
    }
  };

  const clearSessionState = () => {
    setIsActive(false);
    setSessionId(null);
    setStartPage(null);
    setLastFocusPage(null);
  };

  useEffect(() => {
    if (isActive && sessionId) {
      const updateLastPage = async () => {
        try {
          const db = await getDb();
          await db
            .update(sessions)
            .set({ lastPage: currentPage })
            .where(eq(sessions.id, sessionId));
        } catch (e) {}
      };
      updateLastPage();
    }
  }, [currentPage, isActive, sessionId]);

  const startSession = async (filePath: string) => {
    if (!filePath) return;
    try {
      playStartSound();
      const newId = uuidv4();
      setSessionId(newId);

      const targetPage = lastFocusPage ? lastFocusPage : currentPage;

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
      await saveDb();
    } catch (error) {}
  };

  const endSession = async () => {
    if (!sessionId || startPage === null) return;

    try {
      playEndSound();
      const pagesRead = Math.abs(currentPage - startPage) + 1;

      setIsActive(false);
      setSessionId(null);
      setStartPage(null);
      setLastFocusPage(currentPage);

      const db = await getDb();
      await db
        .update(sessions)
        .set({ endTime: Date.now(), endPage: currentPage, pagesRead })
        .where(eq(sessions.id, sessionId));
      await saveDb();
    } catch (error) {}
  };

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
