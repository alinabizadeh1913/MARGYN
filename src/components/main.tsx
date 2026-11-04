"use client";

import React, { useState, useCallback } from "react";
import MarginCanvas from "./reader/MarginCanvas";
import PdfViewer from "./reader/PdfViewer";
import Toolbar from "./reader/Toolbar";
import HistoryView from "./HistoryView";
import SettingsView from "./SettingsView";
import {
  Play,
  Square,
  Settings,
  Library,
  BookOpen,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { SessionProvider, useSession } from "@/providers/SessionProvider";
import { ToolProvider, useTool } from "@/providers/ToolProvider";
import { ShortcutProvider, useShortcut } from "@/providers/ShortcutProvider";
import Typography from "@/typography";
import { clearPageDrawings, clearAllDrawings } from "@/db";

function AppContent() {
  const { isActive, startSession, endSession, currentPage } = useSession();
  const { setTool } = useTool();
  const [view, setView] = useState<"reader" | "history" | "settings">("reader");
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [isMarginOpen, setIsMarginOpen] = useState(true);

  const handleOpenPdf = useCallback(async () => {
    if (window.electronAPI) {
      const data = await window.electronAPI.openPdf();
      if (data) setPdfData(new Uint8Array(data));
    }
  }, []);

  const toggleSession = useCallback(() => {
    if (isActive) endSession();
    else startSession();
  }, [isActive, endSession, startSession]);

  const handleClearCurrentPage = useCallback(async () => {
    await clearPageDrawings(currentPage);
    // Dispatch custom event to tell canvases to clear instantly without reloading
    window.dispatchEvent(new CustomEvent(`margyn-clear-page-${currentPage}`));
  }, [currentPage]);

  const handleClearAllPages = useCallback(async () => {
    await clearAllDrawings();
    // Dispatch custom event to clear all canvases
    window.dispatchEvent(new CustomEvent("margyn-clear-all"));
  }, []);

  useShortcut("pen", () => setTool("pen"));
  useShortcut("eraser", () => setTool("eraser"));
  useShortcut("toggleSession", toggleSession);
  useShortcut("openPdf", handleOpenPdf);
  useShortcut("clearPage", handleClearCurrentPage);
  useShortcut("clearAll", handleClearAllPages);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#09090b]">
      <header className="h-14 flex items-center justify-between px-6 border-b border-[#27272a] bg-[#09090b]/80 backdrop-blur-md shrink-0 z-50">
        <div className="flex items-center gap-6">
          <Typography variant="cardTitle" as="span" className="text-[#fafafa]">
            MARGYN
          </Typography>
          <div className="flex items-center gap-1 bg-[#18181b] p-1 rounded-lg border border-[#27272a]">
            <button
              onClick={() => setView("reader")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${view === "reader" ? "bg-[#27272a] text-[#fafafa]" : "text-[#a1a1aa] hover:text-[#fafafa]"}`}
            >
              <BookOpen size={14} />
              <Typography variant="button">Reader</Typography>
            </button>
            <button
              onClick={() => setView("history")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${view === "history" ? "bg-[#27272a] text-[#fafafa]" : "text-[#a1a1aa] hover:text-[#fafafa]"}`}
            >
              <Library size={14} />
              <Typography variant="button">History</Typography>
            </button>
            <button
              onClick={() => setView("settings")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${view === "settings" ? "bg-[#27272a] text-[#fafafa]" : "text-[#a1a1aa] hover:text-[#fafafa]"}`}
            >
              <Settings size={14} />
              <Typography variant="button">Settings</Typography>
            </button>
          </div>
          {view === "reader" && (
            <button
              onClick={handleOpenPdf}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] transition-colors text-xs font-medium border border-transparent hover:border-[#3f3f46]"
            >
              <FileText size={14} />
              <Typography variant="button">Open PDF</Typography>
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {view === "reader" && pdfData && (
            <button
              onClick={toggleSession}
              className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-300 ${isActive ? "bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20" : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20"}`}
            >
              {isActive ? (
                <>
                  <Square size={12} fill="currentColor" />
                  <Typography variant="button">End Session</Typography>
                </>
              ) : (
                <>
                  <Play size={12} fill="currentColor" />
                  <Typography variant="button">Start Session</Typography>
                </>
              )}
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {view === "reader" && (
          <>
            <div
              className={`h-full border-r border-[#27272a] relative bg-[#121214] transition-all duration-300 ease-in-out flex flex-col shrink-0 ${isMarginOpen ? "w-[40%]" : "w-0 border-r-0"}`}
            >
              <div
                className={`w-full h-full min-w-[300px] flex flex-col transition-opacity duration-300 ${isMarginOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              >
                {pdfData && (
                  <div className="p-4 border-b border-[#27272a]/50 flex justify-center shrink-0">
                    <Toolbar
                      onClearCurrentPage={handleClearCurrentPage}
                      onClearAllPages={handleClearAllPages}
                    />
                  </div>
                )}
                <div className="flex-1 relative overflow-hidden">
                  <MarginCanvas />
                </div>
              </div>
            </div>

            {pdfData && (
              <button
                onClick={() => setIsMarginOpen(!isMarginOpen)}
                className="absolute top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-6 h-16 bg-[#18181b] border-y border-r border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] rounded-r-lg transition-all duration-300 shadow-[2px_0_10px_rgba(0,0,0,0.5)]"
                style={{ left: isMarginOpen ? "calc(40% - 1px)" : "0px" }}
              >
                {isMarginOpen ? (
                  <ChevronLeft size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </button>
            )}

            <div className="flex-1 h-full bg-[#18181b] relative overflow-hidden">
              <PdfViewer fileData={pdfData} />
            </div>
          </>
        )}

        {view === "history" && (
          <div className="flex-1 h-full overflow-hidden">
            <HistoryView />
          </div>
        )}
        {view === "settings" && (
          <div className="flex-1 h-full overflow-hidden">
            <SettingsView />
          </div>
        )}
      </main>
    </div>
  );
}

export default function MainComponent() {
  return (
    <SessionProvider>
      <ToolProvider>
        <ShortcutProvider>
          <AppContent />
        </ShortcutProvider>
      </ToolProvider>
    </SessionProvider>
  );
}
