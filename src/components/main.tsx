"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import MarginCanvas from "./reader/MarginCanvas";
import PdfViewer from "./reader/PdfViewer";
import Toolbar from "./reader/Toolbar";
import HistoryView from "./HistoryView";
import SettingsView from "./SettingsView";
import LibraryView from "./LibraryView";
import {
  Play,
  Square,
  Settings,
  Library,
  BookOpen,
  FileText,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
} from "lucide-react";
import { SessionProvider, useSession } from "@/providers/SessionProvider";
import { ToolProvider, useTool } from "@/providers/ToolProvider";
import { ShortcutProvider, useShortcut } from "@/providers/ShortcutProvider";
import Typography from "@/typography";
import {
  clearPageDrawings,
  clearAllDrawings,
  getDb,
  getAllDrawings,
  restoreDrawings,
  addRecentFile,
} from "@/db";
import { prewarmAudio } from "@/lib/audio";

function AppContent() {
  const { isActive, startSession, endSession, currentPage } = useSession();
  const { setTool } = useTool();
  const [view, setView] = useState<
    "reader" | "library" | "history" | "settings"
  >("reader");
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [isMarginOpen, setIsMarginOpen] = useState(true);
  const [isAppReady, setIsAppReady] = useState(false);

  const undoStack = useRef<any[][]>([]);

  useEffect(() => {
    const init = async () => {
      try {
        await getDb();
        if (window.electronAPI) {
          const data = await window.electronAPI.loadActivePdf();
          if (data) setPdfData(new Uint8Array(data));
        }
      } catch (err) {
        console.error("Init error:", err);
      } finally {
        setIsAppReady(true);
      }
    };
    init();

    const handleFirstClick = () => {
      prewarmAudio();
      window.removeEventListener("click", handleFirstClick);
    };
    window.addEventListener("click", handleFirstClick);
    return () => window.removeEventListener("click", handleFirstClick);
  }, []);

  const handleOpenPdf = useCallback(async () => {
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.openPdf();
        if (result && result.data) {
          const uint8Data = new Uint8Array(result.data);
          setPdfData(uint8Data);
          await window.electronAPI.saveActivePdf(uint8Data);
          await addRecentFile(result.name, result.libraryPath);
          setView("reader");
        }
      } catch (e) {
        console.error("Failed to open PDF", e);
      }
    }
  }, []);

  const handleSelectLibraryFile = useCallback(async (filePath: string) => {
    if (window.electronAPI) {
      try {
        const data = await window.electronAPI.loadLibraryFile(filePath);
        if (data) {
          const uint8Data = new Uint8Array(data);
          setPdfData(uint8Data);
          await window.electronAPI.saveActivePdf(uint8Data);

          const fileName =
            filePath.split("-").slice(1).join("-") || "Document.pdf";
          await addRecentFile(fileName, filePath);
          setView("reader");
        }
      } catch (e) {
        console.error("Failed to load library file", e);
      }
    }
  }, []);

  const handleClearCurrentPage = useCallback(async () => {
    await clearPageDrawings(currentPage);
    window.dispatchEvent(new CustomEvent(`margyn-clear-page-${currentPage}`));
  }, [currentPage]);

  const handleClearAllPages = useCallback(async () => {
    try {
      const allDrawings = await getAllDrawings();
      if (allDrawings.length > 0) {
        undoStack.current.push(allDrawings);
        if (undoStack.current.length > 50) undoStack.current.shift();
      }
      await clearAllDrawings();
      window.dispatchEvent(new CustomEvent("margyn-clear-all"));
    } catch (error) {
      console.error("Failed to clear all pages:", error);
    }
  }, []);

  const handleRedo = useCallback(async () => {
    if (undoStack.current.length > 0) {
      const lastState = undoStack.current.pop();
      if (lastState && lastState.length > 0) {
        await restoreDrawings(lastState);
        window.dispatchEvent(new CustomEvent("margyn-reload-all"));
      }
    }
  }, []);

  useEffect(() => {
    const handleGlobalKeys = async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      if (e.ctrlKey || e.metaKey) {
        if (e.code === "KeyZ" && !e.shiftKey) {
          e.preventDefault();
          await handleClearAllPages();
        } else if (e.code === "KeyY" || (e.code === "KeyZ" && e.shiftKey)) {
          e.preventDefault();
          await handleRedo();
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeys);
    return () => window.removeEventListener("keydown", handleGlobalKeys);
  }, [handleClearAllPages, handleRedo]);

  // اتصال دقیق به میانبرهای جدید
  useShortcut("pen", () => setTool("pen"));
  useShortcut("eraser", () => setTool("eraser"));
  useShortcut("startSession", () => {
    if (!isActive) startSession();
  });
  useShortcut("endSession", () => {
    if (isActive) endSession();
  });
  useShortcut("openPdf", handleOpenPdf);
  useShortcut("clearPage", handleClearCurrentPage);
  useShortcut("clearAll", handleClearAllPages);

  if (!isAppReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#09090b]">
        <div className="w-12 h-12 border-4 border-white/10 border-t-[#38bdf8] rounded-full animate-spin shadow-[0_0_20px_rgba(56,189,248,0.3)]"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#09090b]">
      <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-black/40 backdrop-blur-2xl shrink-0 z-50 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#38bdf8] to-[#a855f7] flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.4)]">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <Typography
              variant="cardTitle"
              as="span"
              className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 tracking-wider"
            >
              MARGYN
            </Typography>
          </div>

          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setView("reader")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all duration-300 ${view === "reader" ? "bg-[#27272a] text-white shadow-[0_2px_10px_rgba(0,0,0,0.5)] border border-white/10" : "text-[#a1a1aa] hover:text-white hover:bg-white/5"}`}
            >
              <BookOpen size={15} />
              <Typography variant="button">Reader</Typography>
            </button>
            <button
              onClick={() => setView("library")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all duration-300 ${view === "library" ? "bg-[#27272a] text-white shadow-[0_2px_10px_rgba(0,0,0,0.5)] border border-white/10" : "text-[#a1a1aa] hover:text-white hover:bg-white/5"}`}
            >
              <FolderOpen size={15} />
              <Typography variant="button">Library</Typography>
            </button>
            <button
              onClick={() => setView("history")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all duration-300 ${view === "history" ? "bg-[#27272a] text-white shadow-[0_2px_10px_rgba(0,0,0,0.5)] border border-white/10" : "text-[#a1a1aa] hover:text-white hover:bg-white/5"}`}
            >
              <Library size={15} />
              <Typography variant="button">History</Typography>
            </button>
            <button
              onClick={() => setView("settings")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all duration-300 ${view === "settings" ? "bg-[#27272a] text-white shadow-[0_2px_10px_rgba(0,0,0,0.5)] border border-white/10" : "text-[#a1a1aa] hover:text-white hover:bg-white/5"}`}
            >
              <Settings size={15} />
              <Typography variant="button">Settings</Typography>
            </button>
          </div>

          {view === "reader" && (
            <button
              onClick={handleOpenPdf}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-all duration-300 text-xs font-medium border border-transparent hover:border-white/10"
            >
              <FileText size={15} />
              <Typography variant="button">Open PDF</Typography>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {view === "reader" && pdfData && (
            <button
              onClick={() => (isActive ? endSession() : startSession())}
              className={`group relative flex items-center gap-2 px-6 py-2 rounded-full transition-all duration-500 overflow-hidden ${isActive ? "bg-rose-500/10 text-rose-400 border border-rose-500/30" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:border-emerald-400"}`}
            >
              <div
                className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md ${isActive ? "bg-rose-500/20" : "bg-emerald-500/20"}`}
              />
              {isActive ? (
                <>
                  <Square
                    size={13}
                    fill="currentColor"
                    className="relative z-10"
                  />
                  <Typography variant="button" className="relative z-10">
                    End Session
                  </Typography>
                </>
              ) : (
                <>
                  <Play
                    size={13}
                    fill="currentColor"
                    className="relative z-10"
                  />
                  <Typography variant="button" className="relative z-10">
                    Start Session
                  </Typography>
                </>
              )}
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {view === "reader" && (
          <>
            {pdfData && (
              <>
                <div
                  className={`h-full border-r border-white/5 relative bg-[#0c0c0e] transition-all duration-500 ease-in-out flex flex-col shrink-0 ${isMarginOpen ? "w-[40%]" : "w-0 border-r-0"}`}
                >
                  <div
                    className={`w-full h-full min-w-[300px] flex flex-col transition-opacity duration-500 ${isMarginOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                  >
                    <div className="py-4 px-6 flex justify-center shrink-0 z-20">
                      <Toolbar
                        onClearCurrentPage={handleClearCurrentPage}
                        onClearAllPages={handleClearAllPages}
                      />
                    </div>
                    <div className="flex-1 relative overflow-hidden">
                      <MarginCanvas />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsMarginOpen(!isMarginOpen)}
                  className="absolute top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-7 h-20 bg-white border-y border-r border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-r-xl transition-all duration-300 shadow-sm"
                  style={{ left: isMarginOpen ? "calc(40% - 1px)" : "0px" }}
                >
                  {isMarginOpen ? (
                    <ChevronLeft size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </button>
              </>
            )}

            <div className="flex-1 h-full relative overflow-hidden flex items-center justify-center">
              <PdfViewer fileData={pdfData} />
            </div>
          </>
        )}

        {view === "library" && (
          <div className="flex-1 h-full overflow-hidden bg-[#09090b]">
            <LibraryView onSelectFile={handleSelectLibraryFile} />
          </div>
        )}

        {view === "history" && (
          <div className="flex-1 h-full overflow-hidden bg-[#09090b]">
            <HistoryView />
          </div>
        )}
        {view === "settings" && (
          <div className="flex-1 h-full overflow-hidden bg-[#09090b]">
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
