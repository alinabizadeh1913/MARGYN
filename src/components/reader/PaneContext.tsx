"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SessionContext, useSession } from "@/providers/SessionProvider";
import { getDb } from "@/db";
import { recentFiles } from "@/db/schema";
import { eq } from "drizzle-orm";

/** true = this pane owns keyboard / session; false = it is a passive split pane. */
const PaneFocusContext = createContext(true);
export const usePaneFocused = () => useContext(PaneFocusContext);

const noop = () => {};

/**
 * Wraps ONE split pane. The focused pane sees the real study session (page
 * tracking, locks, timers). The other panes get a frozen copy: they keep the
 * page they were on, never lock navigation and ignore page changes until the
 * user focuses them (every pointer-down / wheel on a pane focuses it first).
 */
export function PaneScope({
  focused,
  filePath,
  getSavedPage,
  children,
}: {
  focused: boolean;
  filePath: string;
  getSavedPage: (filePath: string) => number | undefined;
  children: React.ReactNode;
}) {
  const real = useSession();
  const lastRef = useRef<number | undefined>(undefined);
  const [, force] = useState(0);

  if (lastRef.current === undefined) lastRef.current = getSavedPage(filePath);
  if (focused) lastRef.current = real.currentPage;

  // A pane that has never been focused and has no remembered page: ask the DB.
  useEffect(() => {
    if (focused || lastRef.current !== undefined || !filePath) return;
    let alive = true;
    (async () => {
      try {
        const db = await getDb();
        const rows = await db
          .select()
          .from(recentFiles)
          .where(eq(recentFiles.filePath, filePath));
        const p = rows[0]?.lastPage;
        if (alive && p && p > 0 && lastRef.current === undefined) {
          lastRef.current = p;
          force((n) => n + 1);
        }
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [focused, filePath]);

  const page = focused ? real.currentPage : (lastRef.current ?? 1);

  const value = useMemo(
    () =>
      focused
        ? real
        : {
            ...real,
            isActive: false,
            lastFocusPage: null,
            currentPage: page,
            setCurrentPage: noop,
          },
    [focused, real, page],
  );

  return (
    <PaneFocusContext.Provider value={focused}>
      <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
    </PaneFocusContext.Provider>
  );
}
