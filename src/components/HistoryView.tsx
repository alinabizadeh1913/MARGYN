"use client";

import React, { useEffect, useState } from "react";
import { getDb } from "@/db";
import { sessions } from "@/db/schema";
import { Lock, CheckCircle2, Shield } from "lucide-react";
import { desc } from "drizzle-orm";
import Typography from "@/typography";

export default function HistoryView() {
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      const db = await getDb();
      const allSessions = await db.select().from(sessions).orderBy(desc(sessions.startTime));
      
      const now = Date.now();
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

      const grouped = allSessions.reduce((acc: any, session: any) => {
        const date = new Date(session.startTime).toLocaleDateString("en-US", {
          weekday: 'short', month: 'short', day: 'numeric'
        });
        if (!acc[date]) acc[date] = { pages: 0, isLocked: true, dateStr: date };
        
        if (now - session.startTime > SEVEN_DAYS_MS) {
          acc[date].isLocked = false;
          acc[date].pages += (session.pagesRead || 0);
        }
        return acc;
      }, {});

      setHistory(Object.values(grouped));
    };
    fetchHistory();
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] p-10 overflow-y-auto">
      <div className="max-w-4xl w-full mx-auto">
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-3">
            <Shield className="text-emerald-500" size={28} />
            <Typography variant="pageTitle" as="h1" className="text-[#fafafa]">
              The 7-Day Lock
            </Typography>
          </div>
          <Typography variant="body" as="p" className="text-[#a1a1aa] max-w-xl">
            To protect your mind from obsessive counting, your reading stats are kept hidden for 7 days. 
            After a week has passed, the truth is revealed here.
          </Typography>
        </header>

        <div className="grid gap-4">
          {history.map((day, idx) => (
            <div 
              key={idx} 
              className={`flex items-center justify-between p-6 rounded-2xl border transition-all duration-500 ${
                day.isLocked 
                  ? "bg-[#121214] border-[#27272a]" 
                  : "bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
              }`}
            >
              <div className="flex items-center gap-4">
                {day.isLocked ? (
                  <Lock size={20} className="text-[#52525b]" />
                ) : (
                  <CheckCircle2 size={20} className="text-emerald-500" />
                )}
                <Typography variant="cardTitle" as="span" className={day.isLocked ? "text-[#a1a1aa]" : "text-[#fafafa]"}>
                  {day.dateStr}
                </Typography>
              </div>

              <div>
                {day.isLocked ? (
                  <Typography variant="microLabel" className="text-[#52525b]">
                    Locked
                  </Typography>
                ) : (
                  <Typography variant="statSmall" as="span" className="text-emerald-500">
                    {day.pages} {day.pages === 1 ? "Page" : "Pages"}
                  </Typography>
                )}
              </div>
            </div>
          ))}

          {history.length === 0 && (
            <div className="text-center py-20">
              <Typography variant="microLabel" className="text-[#52525b]">
                No history yet. Start reading.
              </Typography>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}