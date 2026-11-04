"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import MarginCanvas from "./reader/MarginCanvas";
import PdfViewer from "./reader/PdfViewer";
import Toolbar from "./reader/Toolbar";
import HistoryView from "./HistoryView";
import SettingsView from "./SettingsView";
import LibraryView from "./LibraryView";
import SplashScreen from "./SplashScreen";
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
  Activity,
  Lock,
  Trophy,
  CheckCircle2,
  XCircle,
  Download,
  Upload,
  Save,
  AlertTriangle,
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
  markFileCompleted,
  getRecentFiles,
  getSetting,
  setSetting,
  saveDb,
  updateRecentFileProjectPath,
} from "@/db";
import { prewarmAudio } from "@/lib/audio";
import { sessions, drawings, recentFiles } from "@/db/schema";
import { eq } from "drizzle-orm";

const REQUIRED_END_PHRASE = "END MY SESSION";

function AppContent() {
  const {
    isActive,
    lastFocusPage,
    sessionId,
    startSession,
    endSession,
    currentPage,
    syncSessionWithFile,
    isSessionSyncing,
  } = useSession();
  const { setTool } = useTool();

  const [view, setView] = useState<
    "reader" | "library" | "history" | "settings"
  >("reader");
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [isMarginOpen, setIsMarginOpen] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);

  const [activeFileName, setActiveFileName] = useState<string>("");
  const [activeFilePath, setActiveFilePath] = useState<string>("");
  const [activeProjectPath, setActiveProjectPath] = useState<string | null>(
    null,
  );
  const [totalPages, setTotalPages] = useState(0);
  const [isCurrentPdfCompleted, setIsCurrentPdfCompleted] = useState(false);

  const [isDirty, setIsDirty] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [endText, setEndText] = useState("");
  const [endError, setEndError] = useState(false);
  const endInputRef = useRef<HTMLInputElement>(null);
  const [showCongratsModal, setShowCongratsModal] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const undoStack = useRef<any[][]>([]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadPdfFile = async (
    uint8Data: Uint8Array,
    name: string,
    path: string,
    completed: number,
    projectPath: string | null = null,
  ) => {
    if (isActive && sessionId) {
      try {
        const db = await getDb();
        await db
          .update(sessions)
          .set({ lastPage: currentPage })
          .where(eq(sessions.id, sessionId));
        await saveDb(true);
      } catch (e) {}
    }

    setPdfData(uint8Data);
    await window.electronAPI?.saveActivePdf(uint8Data);
    setActiveFileName(name);
    setActiveFilePath(path);

    let finalProjectPath = projectPath;

    if (!finalProjectPath) {
      const db = await getDb();
      const fileRecord = (
        await db
          .select()
          .from(recentFiles)
          .where(eq(recentFiles.filePath, path))
      )[0];
      if (fileRecord && fileRecord.projectPath) {
        finalProjectPath = fileRecord.projectPath;
      }
    }

    setActiveProjectPath(finalProjectPath);
    setIsCurrentPdfCompleted(completed === 1);
    await setSetting("activeFilePath", path);

    if (finalProjectPath) {
      await updateRecentFileProjectPath(path, finalProjectPath);
    }

    await syncSessionWithFile(path);
    setView("reader");
    setIsDirty(false);
  };

  const handleOpenPdf = useCallback(async () => {
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.openPdf();
        if (result && result.data) {
          const record = await addRecentFile(result.name, result.libraryPath);
          if (record)
            await loadPdfFile(
              new Uint8Array(result.data),
              record.name,
              record.filePath,
              record.completed || 0,
            );
        }
      } catch (e) {}
    }
  }, [syncSessionWithFile, isActive, sessionId, currentPage]);

  const handleSelectLibraryFile = useCallback(
    async (filePath: string) => {
      if (window.electronAPI) {
        try {
          const data = await window.electronAPI.loadLibraryFile(filePath);
          if (data) {
            const fileName =
              filePath.split("-").slice(1).join("-") || "Document.pdf";
            const record = await addRecentFile(fileName, filePath);
            if (record)
              await loadPdfFile(
                new Uint8Array(data),
                record.name,
                record.filePath,
                record.completed || 0,
              );
          }
        } catch (e) {}
      }
    },
    [syncSessionWithFile, isActive, sessionId, currentPage],
  );

  const loadProjectFromPath = useCallback(
    async (filePath: string) => {
      if (!window.electronAPI) return;
      try {
        const result = await window.electronAPI.readProjectFromPath(filePath);
        if (!result) {
          showToast("Failed to read project file.", "error");
          return;
        }

        const { data: projectData, filePath: actualPath } = result;
        const pdfBytes = Uint8Array.from(
          Buffer.from(projectData.fileBase64, "base64"),
        );

        const fakePath = "imported-" + Date.now() + "-" + projectData.fileName;
        const record = await addRecentFile(projectData.fileName, fakePath);

        if (record) {
          await loadPdfFile(
            pdfBytes,
            record.name,
            record.filePath,
            projectData.completed,
            actualPath,
          );

          const db = await getDb();
          await db
            .delete(sessions)
            .where(eq(sessions.filePath, record.filePath));

          const sessionIdMap: Record<string, string> = {};
          if (projectData.sessions?.length > 0) {
            const newSessions = projectData.sessions.map((s: any) => {
              const newId =
                Date.now().toString() +
                Math.random().toString(36).substring(2, 9);
              sessionIdMap[s.id] = newId;
              return { ...s, id: newId, filePath: record.filePath };
            });
            await db.insert(sessions).values(newSessions);
          }
          if (projectData.drawings?.length > 0) {
            const newDrawings = projectData.drawings.map((d: any) => ({
              ...d,
              id:
                Date.now().toString() +
                Math.random().toString(36).substring(2, 9),
              sessionId:
                d.sessionId && sessionIdMap[d.sessionId]
                  ? sessionIdMap[d.sessionId]
                  : null,
            }));
            await db.insert(drawings).values(newDrawings);
          }
          await saveDb(true);
          showToast("Project loaded successfully!", "success");
        }
      } catch (error) {
        console.error("Failed to load project", error);
        showToast("Failed to load project.", "error");
      }
    },
    [syncSessionWithFile, isActive, sessionId, currentPage],
  );

  useEffect(() => {
    const init = async () => {
      try {
        await getDb();
        if (window.electronAPI) {
          const data = await window.electronAPI.loadActivePdf();
          const savedPath = await getSetting("activeFilePath");

          if (data && savedPath) {
            setPdfData(new Uint8Array(data));
            setActiveFilePath(savedPath);

            const recents = await getRecentFiles();
            const currentFile = recents.find(
              (f: any) => f.filePath === savedPath,
            );
            if (currentFile) {
              setActiveFileName(currentFile.name);
              setIsCurrentPdfCompleted(currentFile.completed === 1);
              if (currentFile.projectPath) {
                setActiveProjectPath(currentFile.projectPath);
              }
            }
            await syncSessionWithFile(savedPath);
          } else {
            await syncSessionWithFile("");
          }
        }
      } catch (err) {
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

    const handleDataChange = () => setIsDirty(true);
    window.addEventListener("margyn-data-changed", handleDataChange);

    let cleanupFileOpen: (() => void) | undefined;
    if (window.electronAPI?.onOpenMargynFile) {
      cleanupFileOpen = window.electronAPI.onOpenMargynFile((filePath) => {
        loadProjectFromPath(filePath);
      });
    }

    // ✅ NEW: Listen for PDFs opened via Windows
    let cleanupPdfOpen: (() => void) | undefined;
    if (window.electronAPI?.onOpenPdfFile) {
      cleanupPdfOpen = window.electronAPI.onOpenPdfFile(async (filePath) => {
        const result = await window.electronAPI?.readPdfPath(filePath);
        if (result && result.data) {
          const record = await addRecentFile(result.name, result.libraryPath);
          if (record) {
            await loadPdfFile(
              new Uint8Array(result.data),
              record.name,
              record.filePath,
              record.completed || 0,
            );
          }
        }
      });
    }

    return () => {
      window.removeEventListener("click", handleFirstClick);
      window.removeEventListener("margyn-data-changed", handleDataChange);
      if (cleanupFileOpen) cleanupFileOpen();
      if (cleanupPdfOpen) cleanupPdfOpen();
    };
  }, [syncSessionWithFile, loadProjectFromPath]);

  useEffect(() => {
    if (!window.electronAPI) return;
    const cleanup = window.electronAPI.onAppCloseRequest(() => {
      if (isDirty) setShowCloseModal(true);
      else window.electronAPI?.forceCloseApp();
    });
    return cleanup;
  }, [isDirty]);

  useEffect(() => {
    if (showEndModal) {
      const timer = setTimeout(() => endInputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [showEndModal]);

  const getProjectData = async () => {
    if (!pdfData || !activeFilePath) return null;
    const db = await getDb();
    const fileSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.filePath, activeFilePath));
    const allDrawings = await db.select().from(drawings);
    const fileRecord = (
      await db
        .select()
        .from(recentFiles)
        .where(eq(recentFiles.filePath, activeFilePath))
    )[0];

    return {
      version: "1.0",
      fileName: activeFileName,
      fileBase64: Buffer.from(pdfData).toString("base64"),
      completed: fileRecord?.completed || 0,
      sessions: fileSessions,
      drawings: allDrawings,
    };
  };

  const handleSaveProject = async () => {
    if (!window.electronAPI) return;
    try {
      const projectData = await getProjectData();
      if (!projectData) return;

      const savedPath = await window.electronAPI.saveProject(
        projectData,
        activeProjectPath,
      );

      if (savedPath) {
        setActiveProjectPath(savedPath);
        await updateRecentFileProjectPath(activeFilePath, savedPath);
        setIsDirty(false);
        showToast("Project saved successfully!", "success");
      }
    } catch (error) {
      showToast("Failed to save project.", "error");
    }
  };

  const handleExportProject = async () => {
    if (!window.electronAPI) return;
    try {
      const projectData = await getProjectData();
      if (!projectData) return;
      const defaultDir = await getSetting("defaultExportDir");
      const savedPath = await window.electronAPI.exportProject(
        projectData,
        defaultDir,
      );
      if (savedPath) showToast("Project exported successfully!", "success");
    } catch (error) {
      showToast("Failed to export project.", "error");
    }
  };

  const handleImportProject = async () => {
    if (!window.electronAPI) return;
    try {
      const result = await window.electronAPI.importProject();
      if (!result) return;

      const { data: projectData, filePath } = result;
      const pdfBytes = Uint8Array.from(
        Buffer.from(projectData.fileBase64, "base64"),
      );
      const fakePath = "imported-" + Date.now() + "-" + projectData.fileName;
      const record = await addRecentFile(projectData.fileName, fakePath);

      if (record) {
        await loadPdfFile(
          pdfBytes,
          record.name,
          record.filePath,
          projectData.completed,
          filePath,
        );

        const db = await getDb();
        await db.delete(sessions).where(eq(sessions.filePath, record.filePath));

        const sessionIdMap: Record<string, string> = {};
        if (projectData.sessions?.length > 0) {
          const newSessions = projectData.sessions.map((s: any) => {
            const newId =
              Date.now().toString() +
              Math.random().toString(36).substring(2, 9);
            sessionIdMap[s.id] = newId;
            return { ...s, id: newId, filePath: record.filePath };
          });
          await db.insert(sessions).values(newSessions);
        }
        if (projectData.drawings?.length > 0) {
          const newDrawings = projectData.drawings.map((d: any) => ({
            ...d,
            id:
              Date.now().toString() +
              Math.random().toString(36).substring(2, 9),
            sessionId:
              d.sessionId && sessionIdMap[d.sessionId]
                ? sessionIdMap[d.sessionId]
                : null,
          }));
          await db.insert(drawings).values(newDrawings);
        }
        await saveDb(true);
        setIsDirty(false);
        showToast("Project imported successfully!", "success");
      }
    } catch (error) {
      showToast("Failed to import project.", "error");
    }
  };

  const handleClearCurrentPage = useCallback(async () => {
    await clearPageDrawings(currentPage);
    window.dispatchEvent(new CustomEvent(`margyn-clear-page-${currentPage}`));
    setIsDirty(true);
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
      setIsDirty(true);
    } catch (error) {}
  }, []);

  const handleRedo = useCallback(async () => {
    if (undoStack.current.length > 0) {
      const lastState = undoStack.current.pop();
      if (lastState && lastState.length > 0) {
        await restoreDrawings(lastState);
        window.dispatchEvent(new CustomEvent("margyn-reload-all"));
        setIsDirty(true);
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

  useShortcut("pen", () => setTool("pen"));
  useShortcut("eraser", () => setTool("eraser"));

  useShortcut("startSession", () => {
    if (
      !isActive &&
      !showEndModal &&
      !isCurrentPdfCompleted &&
      activeFilePath &&
      !isSessionSyncing
    )
      startSession(activeFilePath, totalPages);
  });

  useShortcut("endSession", () => {
    if (isActive && !showEndModal) setShowEndModal(true);
  });
  useShortcut("openPdf", handleOpenPdf);
  useShortcut("clearPage", handleClearCurrentPage);
  useShortcut("clearAll", handleClearAllPages);
  useShortcut("toggleMargin", () => setIsMarginOpen((prev) => !prev));
  useShortcut("saveProject", handleSaveProject);

  // ✅ NEW SHORTCUTS
  useShortcut("importProject", handleImportProject);
  useShortcut("exportProject", handleExportProject);

  const handleConfirmEndSession = async () => {
    if (endText === REQUIRED_END_PHRASE) {
      setShowEndModal(false);
      setEndText("");
      setEndError(false);

      if (currentPage === totalPages && totalPages > 0) {
        setIsCurrentPdfCompleted(true);
        if (activeFilePath) await markFileCompleted(activeFilePath);
        setShowCongratsModal(true);
      }
      await endSession();
      setIsDirty(true);
    } else {
      setEndError(true);
      setEndText("");
      endInputRef.current?.focus();
    }
  };

  const handleCloseApp = async (saveFirst: boolean) => {
    if (saveFirst) await handleSaveProject();
    window.electronAPI?.forceCloseApp();
  };

  const showResumeButton = !isActive && lastFocusPage !== null;

  return (
    <>
      <SplashScreen isAppReady={isAppReady} />

      {isAppReady && (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#09090b]">
          <header className="h-16 flex items-center justify-between px-4 border-b border-white/5 bg-black/40 backdrop-blur-2xl shrink-0 z-50 shadow-[0_4px_30px_rgba(0,0,0,0.5)] gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                  <img
                    src="/logo.png"
                    alt="MARGYN"
                    className="w-full h-full object-contain"
                  />
                </div>
                <Typography
                  variant="cardTitle"
                  as="span"
                  className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 tracking-wider hidden 2xl:block"
                >
                  MARGYN
                </Typography>
              </div>

              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5 shrink-0">
                <button
                  onClick={() => setView("reader")}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-300 ${view === "reader" ? "bg-[#27272a] text-white shadow-[0_2px_10px_rgba(0,0,0,0.5)] border border-white/10" : "text-[#a1a1aa] hover:text-white hover:bg-white/5"}`}
                >
                  <BookOpen size={15} />
                  <span className="hidden 2xl:inline">
                    <Typography variant="button">Reader</Typography>
                  </span>
                </button>
                <button
                  onClick={() => setView("library")}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-300 ${view === "library" ? "bg-[#27272a] text-white shadow-[0_2px_10px_rgba(0,0,0,0.5)] border border-white/10" : "text-[#a1a1aa] hover:text-white hover:bg-white/5"}`}
                >
                  <FolderOpen size={15} />
                  <span className="hidden 2xl:inline">
                    <Typography variant="button">Library</Typography>
                  </span>
                </button>
                <button
                  onClick={() => setView("history")}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-300 ${view === "history" ? "bg-[#27272a] text-white shadow-[0_2px_10px_rgba(0,0,0,0.5)] border border-white/10" : "text-[#a1a1aa] hover:text-white hover:bg-white/5"}`}
                >
                  <Library size={15} />
                  <span className="hidden 2xl:inline">
                    <Typography variant="button">History</Typography>
                  </span>
                </button>
                <button
                  onClick={() => setView("settings")}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-300 ${view === "settings" ? "bg-[#27272a] text-white shadow-[0_2px_10px_rgba(0,0,0,0.5)] border border-white/10" : "text-[#a1a1aa] hover:text-white hover:bg-white/5"}`}
                >
                  <Settings size={15} />
                  <span className="hidden 2xl:inline">
                    <Typography variant="button">Settings</Typography>
                  </span>
                </button>
              </div>

              {view === "reader" && pdfData && (
                <div className="flex items-center animate-in fade-in slide-in-from-left-4 duration-300 border-l border-white/10 pl-2 shrink-0">
                  <Toolbar
                    onClearCurrentPage={handleClearCurrentPage}
                    onClearAllPages={handleClearAllPages}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {view === "reader" && (
                <button
                  onClick={handleOpenPdf}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-all duration-300 text-xs font-medium border border-transparent hover:border-white/10"
                >
                  <FileText size={15} />
                  <span className="hidden 2xl:inline">Open PDF</span>
                </button>
              )}

              {view === "reader" && pdfData && (
                <>
                  <button
                    onClick={handleImportProject}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#38bdf8] hover:text-white hover:bg-[#38bdf8]/20 transition-all duration-300 text-xs font-medium border border-[#38bdf8]/30"
                  >
                    <Download size={15} />
                    <span className="hidden 2xl:inline">Import</span>
                  </button>

                  <button
                    onClick={handleExportProject}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#38bdf8] hover:text-white hover:bg-[#38bdf8]/20 transition-all duration-300 text-xs font-medium border border-[#38bdf8]/30"
                  >
                    <Upload size={15} />
                    <span className="hidden 2xl:inline">Export</span>
                  </button>

                  <button
                    onClick={handleSaveProject}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-300 text-xs font-medium border ${
                      isDirty
                        ? "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                        : "text-[#52525b] border-transparent cursor-default"
                    }`}
                    disabled={!isDirty}
                  >
                    <Save
                      size={15}
                      className={isDirty ? "animate-pulse" : ""}
                    />
                    <span className="hidden 2xl:inline">Save</span>
                  </button>

                  <div className="w-px h-6 bg-white/10 mx-0.5" />

                  {isSessionSyncing ? (
                    <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#18181b] text-[#52525b] border border-[#27272a] cursor-wait">
                      <div className="w-3.5 h-3.5 border-2 border-[#52525b] border-t-transparent rounded-full animate-spin" />
                      <span className="hidden 2xl:inline">
                        <Typography variant="button">Checking...</Typography>
                      </span>
                    </div>
                  ) : isCurrentPdfCompleted ? (
                    <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#18181b] text-[#52525b] border border-[#27272a] cursor-not-allowed">
                      <CheckCircle2 size={14} />
                      <span className="hidden 2xl:inline">
                        <Typography variant="button">Completed</Typography>
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (isActive) setShowEndModal(true);
                        else startSession(activeFilePath, totalPages);
                      }}
                      className={`group relative flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all duration-500 overflow-hidden ${
                        isActive
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                          : showResumeButton
                            ? "bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:border-amber-400"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:border-emerald-400"
                      }`}
                    >
                      <div
                        className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md ${
                          isActive
                            ? "bg-rose-500/20"
                            : showResumeButton
                              ? "bg-amber-500/20"
                              : "bg-emerald-500/20"
                        }`}
                      />

                      {isActive ? (
                        <>
                          <Square
                            size={13}
                            fill="currentColor"
                            className="relative z-10"
                          />
                          <span className="hidden 2xl:inline relative z-10">
                            <Typography variant="button">
                              End Session
                            </Typography>
                          </span>
                        </>
                      ) : showResumeButton ? (
                        <>
                          <Activity size={13} className="relative z-10" />
                          <span className="hidden 2xl:inline relative z-10">
                            <Typography variant="button">
                              Resume Session
                            </Typography>
                          </span>
                        </>
                      ) : (
                        <>
                          <Play
                            size={13}
                            fill="currentColor"
                            className="relative z-10"
                          />
                          <span className="hidden 2xl:inline relative z-10">
                            <Typography variant="button">
                              Start Session
                            </Typography>
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          </header>

          <main className="flex-1 flex overflow-hidden relative">
            {view === "reader" && (
              <>
                {pdfData && (
                  <>
                    <div
                      className={`h-full border-r border-white/5 relative bg-[#0c0c0e] flex flex-col shrink-0 ${isMarginOpen ? "w-[40%]" : "w-0 border-r-0"}`}
                    >
                      <div
                        className={`w-full h-full min-w-[300px] flex flex-col ${isMarginOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                      >
                        <div className="flex-1 relative overflow-hidden">
                          <MarginCanvas />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setIsMarginOpen(!isMarginOpen)}
                      className="absolute top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-7 h-20 bg-white border-y border-r border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-r-xl transition-colors shadow-sm"
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
                  <PdfViewer
                    fileData={pdfData}
                    onDocumentLoad={setTotalPages}
                  />
                </div>
              </>
            )}

            {view === "library" && (
              <div className="flex-1 h-full overflow-hidden bg-[#09090b]">
                <LibraryView
                  onSelectFile={handleSelectLibraryFile}
                  onImportProject={handleImportProject}
                />
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

          {showEndModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md transition-all duration-300">
              <div className="bg-[#121214] border border-rose-500/30 p-8 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] w-full max-w-lg flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <Square size={32} className="text-rose-500" />
                </div>
                <Typography
                  variant="pageTitle"
                  as="h2"
                  className="text-[#fafafa] mb-2 font-semibold tracking-tight"
                >
                  End Focus Session?
                </Typography>
                <Typography
                  variant="body"
                  as="p"
                  className="text-[#a1a1aa] mb-8 max-w-sm leading-relaxed"
                >
                  You are about to end your focus session. Your reading stats
                  will be locked and revealed in 7 days.
                  <br />
                  <br />
                  To confirm, type the following phrase in{" "}
                  <strong>ALL CAPITAL LETTERS</strong>:
                </Typography>
                <div className="w-full bg-[#09090b] border border-[#27272a] rounded-2xl p-4 mb-6 flex items-center justify-center gap-3 select-none">
                  <Lock size={16} className="text-[#52525b]" />
                  <span className="text-[#fafafa] font-mono text-base font-bold tracking-widest">
                    {REQUIRED_END_PHRASE}
                  </span>
                </div>
                <input
                  ref={endInputRef}
                  type="text"
                  value={endText}
                  onChange={(e) => {
                    setEndText(e.target.value);
                    setEndError(false);
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") handleConfirmEndSession();
                  }}
                  onPaste={(e) => e.preventDefault()}
                  onCopy={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  onDrop={(e) => e.preventDefault()}
                  onContextMenu={(e) => e.preventDefault()}
                  autoComplete="off"
                  spellCheck="false"
                  placeholder="TYPE HERE (UPPERCASE ONLY)"
                  autoFocus
                  className={`w-full px-5 py-4 rounded-xl bg-[#18181b] border-2 outline-none transition-all text-center text-lg font-mono tracking-widest shadow-sm ${
                    endError
                      ? "border-rose-400 focus:border-rose-500 text-rose-600 placeholder-rose-300 animate-shake"
                      : "border-[#27272a] focus:border-rose-500/50 text-[#fafafa]"
                  }`}
                />
                {endError && (
                  <Typography
                    variant="caption"
                    className="text-rose-500 mt-3 font-medium animate-pulse"
                  >
                    Incorrect. You must type it exactly as shown.
                  </Typography>
                )}
                <div className="flex gap-4 w-full mt-8">
                  <button
                    onClick={() => setShowEndModal(false)}
                    className="flex-1 px-4 py-3.5 rounded-xl bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] border border-[#27272a] transition-all font-medium active:scale-[0.98]"
                  >
                    Keep Focusing
                  </button>
                  <button
                    onClick={handleConfirmEndSession}
                    className="flex-1 px-4 py-3.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-all font-medium shadow-[0_0_15px_rgba(244,63,94,0.3)] active:scale-[0.98]"
                  >
                    End Session
                  </button>
                </div>
              </div>
            </div>
          )}

          {showCongratsModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-lg transition-all duration-500">
              <div className="bg-[#121214] border border-emerald-500/30 p-10 rounded-3xl shadow-[0_20px_80px_-15px_rgba(16,185,129,0.2)] w-full max-w-lg flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 relative">
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse" />
                  <Trophy
                    size={48}
                    className="text-emerald-500 relative z-10"
                  />
                </div>
                <Typography
                  variant="pageTitle"
                  as="h2"
                  className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-[#38bdf8] mb-2 font-bold tracking-tight text-3xl"
                >
                  Congratulations!
                </Typography>
                <Typography
                  variant="bodyMedium"
                  as="p"
                  className="text-[#fafafa] mb-2"
                >
                  You have successfully completed:
                </Typography>
                <div className="w-full bg-[#09090b] border border-emerald-500/20 rounded-2xl p-4 mb-8">
                  <Typography
                    variant="cardTitle"
                    className="text-[#fafafa] truncate px-4"
                  >
                    {activeFileName || "Your Document"}
                  </Typography>
                </div>
                <Typography
                  variant="body"
                  as="p"
                  className="text-[#a1a1aa] mb-8 max-w-sm leading-relaxed"
                >
                  That's another step forward in your journey. Your focus and
                  dedication are paying off. Take a moment to appreciate your
                  progress!
                </Typography>
                <button
                  onClick={() => setShowCongratsModal(false)}
                  className="w-full px-4 py-3.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all font-medium shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-[0.98]"
                >
                  Awesome!
                </button>
              </div>
            </div>
          )}

          {showCloseModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-md transition-all duration-300">
              <div className="bg-[#121214] border border-amber-500/30 p-8 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] w-full max-w-md flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <AlertTriangle size={32} className="text-amber-500" />
                </div>
                <Typography
                  variant="pageTitle"
                  as="h2"
                  className="text-[#fafafa] mb-2 font-semibold tracking-tight"
                >
                  Unsaved Changes
                </Typography>
                <Typography
                  variant="body"
                  as="p"
                  className="text-[#a1a1aa] mb-8 leading-relaxed"
                >
                  You have unsaved changes in your current project. If you close
                  now, your progress might be lost. Do you want to save before
                  closing?
                </Typography>
                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={() => handleCloseApp(true)}
                    className="w-full px-4 py-3 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all font-medium shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-[0.98]"
                  >
                    Save & Close
                  </button>
                  <button
                    onClick={() => handleCloseApp(false)}
                    className="w-full px-4 py-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all font-medium active:scale-[0.98]"
                  >
                    Discard & Close
                  </button>
                  <button
                    onClick={() => setShowCloseModal(false)}
                    className="w-full px-4 py-3 rounded-xl bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] border border-[#27272a] transition-all font-medium active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {toast && (
            <div className="fixed bottom-8 right-8 z-[200] animate-in slide-in-from-bottom-5 fade-in duration-300">
              <div
                className={`flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl ${
                  toast.type === "success"
                    ? "bg-[#121214]/90 border-emerald-500/30 text-emerald-400 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.3)]"
                    : "bg-[#121214]/90 border-rose-500/30 text-rose-400 shadow-[0_10px_40px_-10px_rgba(244,63,94,0.3)]"
                }`}
              >
                {toast.type === "success" ? (
                  <CheckCircle2 size={24} className="shrink-0" />
                ) : (
                  <XCircle size={24} className="shrink-0" />
                )}
                <Typography
                  variant="bodyMedium"
                  className="text-[#fafafa] font-medium"
                >
                  {toast.message}
                </Typography>
              </div>
            </div>
          )}
        </div>
      )}
    </>
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
