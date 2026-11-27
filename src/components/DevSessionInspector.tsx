"use client";

import React, { useState, useEffect } from "react";
import { getDb, saveDb } from "@/db";
import { sessions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import {
  Trash2,
  Clock,
  Database,
  FastForward,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import Typography from "@/typography";

export default function DevSessionInspector() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const db = await getDb();
      const res = await db
        .select()
        .from(sessions)
        .orderBy(desc(sessions.startTime));
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleTimeTravel = async (id: string) => {
    try {
      const db = await getDb();
      // Set start time to 8 days ago, and end time to 8 days ago + 1 hour
      const pastTime = Date.now() - 8 * 24 * 60 * 60 * 1000;
      await db
        .update(sessions)
        .set({
          startTime: pastTime,
          endTime: pastTime + 3600000,
        })
        .where(eq(sessions.id, id));
      await saveDb(true);
      fetchSessions();
    } catch (e) {
      console.error("Failed to time travel", e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this session permanently?")) return;
    try {
      const db = await getDb();
      await db.delete(sessions).where(eq(sessions.id, id));
      await saveDb(true);
      fetchSessions();
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  const handleClearAll = async () => {
    if (
      !confirm(
        "Are you sure you want to delete ALL sessions? This cannot be undone.",
      )
    )
      return;
    try {
      const db = await getDb();
      await db.delete(sessions);
      await saveDb(true);
      fetchSessions();
    } catch (e) {
      console.error("Failed to clear all", e);
    }
  };

  return (
    <div className="bg-nm-panel border border-amber-500/30 rounded-3xl p-6 mt-10 shadow-nm-glow-warn">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-nm-edge">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Database className="text-amber-500" size={20} />
          </div>
          <div>
            <Typography variant="cardTitle" className="text-amber-500">
              Developer Mode: Session Inspector
            </Typography>
            <Typography variant="caption" className="text-nm-muted">
              Temporary tool to verify database logic.
            </Typography>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-colors text-xs font-medium"
          >
            <AlertTriangle size={14} />
            Clear All
          </button>
          <button
            onClick={fetchSessions}
            className="p-2 text-nm-muted hover:text-white bg-nm-raise border border-nm-edge rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-10 text-nm-dim">
          No sessions found in the database.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-nm-muted">
            <thead className="text-xs uppercase bg-nm-raise text-nm-dim">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Status</th>
                <th className="px-4 py-3">Start Time</th>
                <th className="px-4 py-3">End Time</th>
                <th className="px-4 py-3 text-center">Pages (Start → End)</th>
                <th className="px-4 py-3 text-center">Last Page (Resume)</th>
                <th className="px-4 py-3 text-center">Pages Read</th>
                <th className="px-4 py-3 text-right rounded-tr-lg">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nm-edge">
              {data.map((session) => {
                const isActive = !session.endTime;
                const isLocked =
                  !isActive &&
                  Date.now() - session.startTime <= 7 * 24 * 60 * 60 * 1000;

                return (
                  <tr
                    key={session.id}
                    className="hover:bg-nm-raise/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      {isActive ? (
                        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-md text-xs font-bold">
                          Active
                        </span>
                      ) : isLocked ? (
                        <span className="px-2 py-1 bg-nm-line text-nm-muted rounded-md text-xs font-bold">
                          Locked
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-nm-accent/10 text-nm-accent rounded-md text-xs font-bold">
                          Unlocked
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {new Date(session.startTime).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {session.endTime
                        ? new Date(session.endTime).toLocaleString()
                        : "---"}
                    </td>
                    <td className="px-4 py-3 text-center font-mono">
                      {session.startPage}{" "}
                      <span className="text-nm-dim">→</span>{" "}
                      {session.endPage || "?"}
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-amber-500">
                      {session.lastPage || session.startPage}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-emerald-500">
                      {session.pagesRead || 0}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleTimeTravel(session.id)}
                          className="p-1.5 text-nm-muted hover:text-amber-500 hover:bg-amber-500/10 rounded-md transition-colors"
                          title="Time Travel (Make it 8 days old)"
                        >
                          <FastForward size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(session.id)}
                          className="p-1.5 text-nm-muted hover:text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors"
                          title="Delete Session"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
