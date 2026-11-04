"use client";

import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  ReactNode,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { getDb, saveDb } from "@/db";
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
  const [currentPage, setCurrentPage] = useState(1);

  const startSession = async () => {
    try {
      // 1. Play sound immediately (non-blocking)
      playStartSound();

      // 2. Optimistically update UI state for zero lag
      const newId = uuidv4();
      setSessionId(newId);
      setStartPage(currentPage);
      setIsActive(true);

      // 3. Save to DB in background
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
      // 1. Play sound immediately
      playEndSound();

      // 2. Optimistic UI update
      const pagesRead = Math.abs(currentPage - startPage) + 1;
      setIsActive(false);
      setSessionId(null);
      setStartPage(null);

      // 3. Save to DB in background
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

  // Memoize the context value to prevent unnecessary re-renders across the app
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
