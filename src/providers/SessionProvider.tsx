"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { v4 as uuidv4 } from "uuid";
import { getDb, saveDb } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { playStartSound, playEndSound } from "@/lib/audio";

/* =========================================================
   MARGYN — Session Context
========================================================= */

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
      const db = await getDb();
      const newId = uuidv4();
      const start = Date.now();

      await db.insert(sessions).values({
        id: newId,
        startTime: start,
        startPage: currentPage,
      });
      await saveDb();

      setSessionId(newId);
      setStartPage(currentPage);
      setIsActive(true);

      // Play the subtle start chime
      playStartSound();
    } catch (error) {
      console.error("Failed to start session:", error);
    }
  };

  const endSession = async () => {
    if (!sessionId || startPage === null) return;

    try {
      const db = await getDb();
      const end = Date.now();
      const pagesRead = Math.abs(currentPage - startPage) + 1;

      await db
        .update(sessions)
        .set({
          endTime: end,
          endPage: currentPage,
          pagesRead: pagesRead,
        })
        .where(eq(sessions.id, sessionId));

      await saveDb();

      setIsActive(false);
      setSessionId(null);
      setStartPage(null);

      // Play the resolution chime
      playEndSound();
    } catch (error) {
      console.error("Failed to end session:", error);
    }
  };

  return (
    <SessionContext.Provider
      value={{
        isActive,
        sessionId,
        startPage,
        currentPage,
        setCurrentPage,
        startSession,
        endSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
