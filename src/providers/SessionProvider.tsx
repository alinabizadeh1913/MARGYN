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
import { getDb, saveDb, getSetting, setSetting } from "@/db"; // Added getSetting, setSetting
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { playStartSound, playEndSound } from "@/lib/audio";

interface SessionContextType {
  isActive: boolean;
  sessionId: string | null;
  startPage: number | null;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startPage, setStartPage] = useState<number | null>(null);
  const [currentPage, setCurrentPageState] = useState(1);

  // Load last viewed page on mount
  useEffect(() => {
    const loadLastPage = async () => {
      try {
        const saved = await getSetting("lastPage");
        if (saved) setCurrentPageState(parseInt(saved, 10));
      } catch (error) {
        console.error("Failed to load last page:", error);
      }
    };
    loadLastPage();
  }, []);

  // Wrapper function to save current page to DB
  const setCurrentPage = async (page: number) => {
    setCurrentPageState(page);
    try {
      await setSetting("lastPage", page.toString());
    } catch (error) {
      console.error("Failed to save current page:", error);
    }
  };

  const startSession = async () => {
    try {
      playStartSound();
      const newId = uuidv4();
      setSessionId(newId);
      setStartPage(currentPage);
      setIsActive(true);

      const db = await getDb();
      await db.insert(sessions).values({
        id: newId,
        startTime: Date.now(),
        startPage: currentPage,
      });
      await saveDb();
    } catch (error) {
      console.error("Failed to start session:", error);
    }
  };

  const endSession = async () => {
    if (!sessionId || startPage === null) return;

    try {
      playEndSound();
      const pagesRead = Math.abs(currentPage - startPage) + 1;
      setIsActive(false);
      setSessionId(null);
      setStartPage(null);

      const db = await getDb();
      await db
        .update(sessions)
        .set({ endTime: Date.now(), endPage: currentPage, pagesRead })
        .where(eq(sessions.id, sessionId));
      await saveDb();
    } catch (error) {
      console.error("Failed to end session:", error);
    }
  };

  const value = useMemo(
    () => ({
      isActive,
      sessionId,
      startPage,
      currentPage,
      setCurrentPage,
      startSession,
      endSession,
    }),
    [isActive, sessionId, startPage, currentPage],
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
