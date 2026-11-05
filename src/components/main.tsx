"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import MarginCanvas from "./reader/MarginCanvas";
import PdfViewer from "./reader/PdfViewer";
import Toolbar from "./reader/Toolbar";
import HistoryView from "./HistoryView";
import SettingsView from "./SettingsView";
import LibraryView from "./LibraryView";
import SplashScreen from "./SplashScreen";
import TabsBar, { OpenTab } from "./TabsBar";
import TimerDisplay from "./reader/TimerDisplay";
import { encryptData, decryptData } from "@/lib/crypto";
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
  Clock,
} from "lucide-react";
import { SessionProvider, useSession } from "@/providers/SessionProvider";
import { ToolProvider, useTool } from "@/providers/ToolProvider";
import {
  ShortcutProvider,
  useShortcut,
  useShortcuts,
} from "@/providers/ShortcutProvider";
import { TimeProvider } from "@/providers/TimeProvider";
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
import { eq, and, isNull } from "drizzle-orm"; // ✅ اضافه شدن and و isNull

const REQUIRED_END_PHRASE = "END MY SESSION";

function AppContent() {
  const {
    isActive,
    lastFocusPage,
    sessionId,
    startPage,
    startSession,
    endSession,
    currentPage,
    setCurrentPage,
    syncSessionWithFile,
    isSessionSyncing,
    timerEndsAt,
    startTimer,
  } = useSession();
  const { setTool } = useTool();
  const { setShortcutsEnabled } = useShortcuts();

  const [view, setView] = useState<
    "reader" | "library" | "history" | "settings"
  >("reader");
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [activeFileName, setActiveFileName] = useState<string>("");
  const [activeFilePath, setActiveFilePath] = useState<string>("");
  const [activeProjectPath, setActiveProjectPath] = useState<string | null>(
    null,
  );
  const [totalPages, setTotalPages] = useState(0);
  const [isCurrentPdfCompleted, setIsCurrentPdfCompleted] = useState(false);

  const [activeScale, setActiveScale] = useState(1.3);
  const [hasText, setHasText] = useState(true);

  const [isMarginOpen, setIsMarginOpen] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showBackwardErrorModal, setShowBackwardErrorModal] = useState(false);

  const [showTimerModal, setShowTimerModal] = useState(false);
  const [timerInput, setTimerInput] = useState("25");

  const [endText, setEndText] = useState("");
  const [endError, setEndError] = useState(false);
  const endInputRef = useRef<HTMLInputElement>(null);
  const [showCongratsModal, setShowCongratsModal] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const undoStack = useRef<any[][]>([]);
  const isInitRef = useRef(false);
  const scaleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stateRef = useRef({
    requestSafeAction: (action: () => void) => {},
    loadProjectFromPath: async (path: string) => {},
    loadPdfFile: async (
      data: any,
      name: string,
      path: string,
      comp: any,
      proj: any,
    ) => {},
    activeTabId: null as string | null,
    isDirty: false,
    activeProjectPath: null as string | null,
    pdfData: null as any,
    openTabs: [] as OpenTab[],
  });

  useEffect(() => {
    setShortcutsEnabled(view === "reader");
  }, [view, setShortcutsEnabled]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showCloseModal) {
          setShowCloseModal(false);
          setPendingAction(null);
        } else if (showEndModal) setShowEndModal(false);
        else if (showBackwardErrorModal) setShowBackwardErrorModal(false);
        else if (showCongratsModal) setShowCongratsModal(false);
        else if (showTimerModal) setShowTimerModal(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [
    showCloseModal,
    showEndModal,
    showBackwardErrorModal,
    showCongratsModal,
    showTimerModal,
  ]);

  const handleScaleChange = useCallback(
    (newScale: number) => {
      setActiveScale(newScale);
      if (activeTabId) {
        setOpenTabs((prev) =>
          prev.map((t) =>
            t.id === activeTabId ? { ...t, scale: newScale } : t,
          ),
        );
      }

      if (scaleTimeoutRef.current) clearTimeout(scaleTimeoutRef.current);
      scaleTimeoutRef.current = setTimeout(async () => {
        if (activeFilePath) {
          try {
            const db = await getDb();
            await db
              .update(recentFiles)
              .set({ scale: newScale })
              .where(eq(recentFiles.filePath, activeFilePath));
            await saveDb();
          } catch (e) {}
        }
      }, 500);
    },
    [activeTabId, activeFilePath],
  );

  useEffect(() => {
    if (!activeFilePath || currentPage < 1) return;
    const saveLastPage = async () => {
      try {
        const db = await getDb();
        await db
          .update(recentFiles)
          .set({ lastPage: currentPage })
          .where(eq(recentFiles.filePath, activeFilePath));
        await saveDb();
      } catch (e) {}
    };
    saveLastPage();
  }, [currentPage, activeFilePath]);

  useEffect(() => {
    const activeTab = openTabs.find((t) => t.id === activeTabId);
    if (activeTab) {
      setPdfData(activeTab.pdfData);
      setActiveFileName(activeTab.name);
      setActiveFilePath(activeTab.filePath);
      setActiveProjectPath(activeTab.projectPath);
      setTotalPages(activeTab.totalPages);
      setIsCurrentPdfCompleted(activeTab.isCompleted);
      setIsDirty(activeTab.isDirty);
      setActiveScale(activeTab.scale || 1.3);
    } else if (!activeTabId) {
      setPdfData(null);
      setActiveFileName("");
      setActiveFilePath("");
      setActiveProjectPath(null);
      setTotalPages(0);
      setIsCurrentPdfCompleted(false);
      setIsDirty(false);
      setActiveScale(1.3);
      setHasText(true);
    }
  }, [activeTabId, openTabs]);

  useEffect(() => {
    syncSessionWithFile(activeFilePath);
  }, [activeFilePath, syncSessionWithFile]);

  useEffect(() => {
    if (!isAppReady) return;
    const saveTabsToDb = async () => {
      const tabsData = openTabs.map((t) => ({
        id: t.id,
        name: t.name,
        filePath: t.filePath,
        projectPath: t.projectPath,
        totalPages: t.totalPages,
        currentPage: t.currentPage,
        isCompleted: t.isCompleted,
        scale: t.scale,
      }));
      await setSetting("openTabsState", JSON.stringify(tabsData));
      await setSetting("activeTabId", activeTabId || "");
    };
    saveTabsToDb();
  }, [openTabs, activeTabId, isAppReady]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const handleSaveError = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      showToast(detail || "Failed to save drawing.", "error");
    };
    window.addEventListener("margyn-save-error", handleSaveError);
    return () =>
      window.removeEventListener("margyn-save-error", handleSaveError);
  }, []);

  useEffect(() => {
    const handleNoText = () => {
      showToast(
        "No text found to highlight in this area. Please draw over PDF text.",
        "error",
      );
    };
    window.addEventListener("margyn-no-text", handleNoText);
    return () => window.removeEventListener("margyn-no-text", handleNoText);
  }, []);

  const requestSafeAction = (action: () => void) => {
    if (isDirty || (!activeProjectPath && pdfData)) {
      setPendingAction(() => action);
      setShowCloseModal(true);
    } else {
      action();
    }
  };

  const loadPdfFile = async (
    uint8Data: Uint8Array,
    name: string,
    path: string,
    completed: number,
    projectPath: string | null = null,
  ) => {
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

    if (finalProjectPath) {
      await updateRecentFileProjectPath(path, finalProjectPath);
    }
    await setSetting("activeFilePath", path);
    await window.electronAPI?.saveActivePdf(uint8Data);

    const existingTab = openTabs.find((t) => t.filePath === path);

    if (existingTab) {
      setActiveTabId(existingTab.id);
      setPdfData(existingTab.pdfData);
      setActiveFileName(existingTab.name);
      setActiveFilePath(existingTab.filePath);
      setActiveProjectPath(existingTab.projectPath);
      setTotalPages(existingTab.totalPages);
      setIsCurrentPdfCompleted(existingTab.isCompleted);
      setIsDirty(existingTab.isDirty);
      setActiveScale(existingTab.scale || 1.3);
      setView("reader");
      return;
    }

    const db = await getDb();
    const fileRecord = (
      await db.select().from(recentFiles).where(eq(recentFiles.filePath, path))
    )[0];
    const initialScale = fileRecord?.scale || 1.3;

    // ✅ گرفتن اسنپ‌شات از وضعیت اولیه برای بازگردانی در صورت Discard
    const initialDrawings = await db
      .select()
      .from(drawings)
      .where(eq(drawings.filePath, path));
    const initialRecent = (
      await db.select().from(recentFiles).where(eq(recentFiles.filePath, path))
    )[0];
    const snapshot = { drawings: initialDrawings, recentFile: initialRecent };

    const newTabId = Date.now().toString();
    const newTab: OpenTab = {
      id: newTabId,
      name,
      filePath: path,
      pdfData: uint8Data,
      projectPath: finalProjectPath,
      isDirty: false,
      totalPages: 0,
      currentPage: 1,
      isCompleted: completed === 1,
      scale: initialScale,
      snapshot, // ✅ ذخیره اسنپ‌شات در تب
    };

    setOpenTabs((prev) => [...prev, newTab]);

    setActiveTabId(newTabId);
    setPdfData(uint8Data);
    setActiveFileName(name);
    setActiveFilePath(path);
    setActiveProjectPath(finalProjectPath);
    setTotalPages(0);
    setIsCurrentPdfCompleted(completed === 1);
    setIsDirty(false);
    setActiveScale(initialScale);
    setView("reader");
  };

  stateRef.current = {
    requestSafeAction,
    loadProjectFromPath: async (path: string) => {},
    loadPdfFile,
    activeTabId,
    isDirty,
    activeProjectPath,
    pdfData,
    openTabs,
  };

  const handleOpenPdf = useCallback(() => {
    stateRef.current.requestSafeAction(async () => {
      if (window.electronAPI) {
        try {
          const result = await window.electronAPI.openPdf();
          if (result && result.data) {
            const record = await addRecentFile(result.name, result.libraryPath);
            if (record)
              await stateRef.current.loadPdfFile(
                new Uint8Array(result.data),
                record.name,
                record.filePath,
                record.completed || 0,
                null,
              );
          }
        } catch (e) {}
      }
    });
  }, []);

  const handleDropPdf = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      showToast("Only PDF files are supported.", "error");
      return;
    }

    stateRef.current.requestSafeAction(async () => {
      if (!window.electronAPI) return;
      try {
        const filePath = window.electronAPI.getPathForFile?.(file);
        if (!filePath) {
          showToast("Could not resolve file path.", "error");
          return;
        }

        const result = await window.electronAPI.readPdfPath(filePath);
        if (result && result.data) {
          const record = await addRecentFile(result.name, result.libraryPath);
          if (record) {
            await stateRef.current.loadPdfFile(
              new Uint8Array(result.data),
              record.name,
              record.filePath,
              record.completed || 0,
              null,
            );
          }
        } else {
          showToast("Failed to open dropped PDF.", "error");
        }
      } catch (e) {
        showToast("Failed to open dropped PDF.", "error");
      }
    });
  }, []);

  const handleSelectLibraryFile = useCallback((filePath: string) => {
    stateRef.current.requestSafeAction(async () => {
      if (window.electronAPI) {
        try {
          const data = await window.electronAPI.loadLibraryFile(filePath);
          if (data) {
            const db = await getDb();
            const record = (
              await db
                .select()
                .from(recentFiles)
                .where(eq(recentFiles.filePath, filePath))
            )[0];

            let finalName = record?.name;
            if (!finalName) {
              const baseName = filePath.split(/[/\\]/).pop() || "";
              finalName =
                baseName.split("-").slice(1).join("-") || "Untitled Document";
            }

            await stateRef.current.loadPdfFile(
              new Uint8Array(data),
              finalName,
              filePath,
              record?.completed || 0,
              record?.projectPath || null,
            );
          } else {
            const db = await getDb();
            const record = (
              await db
                .select()
                .from(recentFiles)
                .where(eq(recentFiles.filePath, filePath))
            )[0];

            if (record && record.projectPath) {
              await stateRef.current.loadProjectFromPath(record.projectPath);
            } else {
              showToast(
                "File not found. It might have been moved or deleted.",
                "error",
              );
            }
          }
        } catch (e) {
          showToast("Failed to open file.", "error");
        }
      }
    });
  }, []);

  const handleCloseTab = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      const tabToClose = openTabs.find((t) => t.id === tabId);
      if (!tabToClose) return;

      const hasUnsaved =
        tabToClose.isDirty || (!tabToClose.projectPath && tabToClose.pdfData);

      const doClose = () => {
        setOpenTabs((prev) => {
          const remaining = prev.filter((t) => t.id !== tabId);
          if (remaining.length > 0) {
            setActiveTabId(remaining[remaining.length - 1].id);
          } else {
            setActiveTabId(null);
            setPdfData(null);
            setActiveFileName("");
            setActiveFilePath("");
            setActiveProjectPath(null);
            setTotalPages(0);
            setIsCurrentPdfCompleted(false);
            setIsDirty(false);
            setActiveScale(1.3);
            setHasText(true);
            setSetting("activeFilePath", "");
            window.electronAPI?.clearActivePdf();
          }
          return remaining;
        });
      };

      if (hasUnsaved) {
        if (tabId !== activeTabId) {
          setActiveTabId(tabId);
          setView("reader");
        }
        setPendingAction(() => doClose);
        setShowCloseModal(true);
        return;
      }

      if (tabId !== activeTabId) {
        setOpenTabs((prev) => prev.filter((t) => t.id !== tabId));
      } else {
        doClose();
      }
    },
    [openTabs, activeTabId],
  );

  useShortcut("closePdf", () => {
    if (stateRef.current.activeTabId) {
      handleCloseTab(
        { stopPropagation: () => {} } as React.MouseEvent,
        stateRef.current.activeTabId,
      );
    }
  });

  useShortcut("switchTab", () => {
    if (stateRef.current.openTabs.length < 2) return;
    const currentIndex = stateRef.current.openTabs.findIndex(
      (t) => t.id === stateRef.current.activeTabId,
    );
    if (currentIndex !== -1) {
      const nextIndex = (currentIndex + 1) % stateRef.current.openTabs.length;
      setActiveTabId(stateRef.current.openTabs[nextIndex].id);
    }
  });

  const handleReorderTabs = useCallback(
    (draggedIndex: number, hoveredIndex: number) => {
      setOpenTabs((prev) => {
        const newTabs = [...prev];
        const [draggedTab] = newTabs.splice(draggedIndex, 1);
        newTabs.splice(hoveredIndex, 0, draggedTab);
        return newTabs;
      });
    },
    [],
  );

  const loadProjectFromPath = useCallback(async (filePath: string) => {
    if (!window.electronAPI) return;
    try {
      const result = await window.electronAPI.readProjectFromPath(filePath);
      if (!result) {
        showToast("Failed to read project file.", "error");
        return;
      }

      const { data: projectData, filePath: actualPath } = result;
      const db = await getDb();
      const existing = await db
        .select()
        .from(recentFiles)
        .where(eq(recentFiles.projectPath, actualPath));

      const defaultName =
        actualPath
          .split(/[/\\]/)
          .pop()
          ?.replace(".margyn", "")
          .replace(".pdf", "") || "Imported Project";
      const displayName = projectData.fileName || defaultName;

      let record;
      let pdfBytes;

      if (existing.length > 0) {
        record = existing[0];
        const existingPdf = await window.electronAPI.loadLibraryFile(
          record.filePath,
        );
        if (existingPdf) {
          pdfBytes = new Uint8Array(existingPdf);
        } else {
          pdfBytes = Uint8Array.from(
            Buffer.from(projectData.fileBase64, "base64"),
          );
          await window.electronAPI.saveActivePdf(pdfBytes);

          const realLibraryPath = await window.electronAPI.saveLibraryFile(
            pdfBytes,
            displayName + ".pdf",
          );
          const newPath =
            realLibraryPath ||
            "imported-" + Date.now() + "-" + displayName + ".pdf";
          record = await addRecentFile(displayName, newPath, actualPath);
        }
        await db
          .update(recentFiles)
          .set({ lastOpened: Date.now(), name: displayName })
          .where(eq(recentFiles.id, record.id));
      } else {
        pdfBytes = Uint8Array.from(
          Buffer.from(projectData.fileBase64, "base64"),
        );
        await window.electronAPI.saveActivePdf(pdfBytes);

        const realLibraryPath = await window.electronAPI.saveLibraryFile(
          pdfBytes,
          displayName + ".pdf",
        );
        const newPath =
          realLibraryPath ||
          "imported-" + Date.now() + "-" + displayName + ".pdf";
        record = await addRecentFile(displayName, newPath, actualPath);
      }

      if (record && pdfBytes) {
        await stateRef.current.loadPdfFile(
          pdfBytes,
          record.name,
          record.filePath,
          projectData.completed,
          actualPath,
        );

        await db.delete(sessions).where(eq(sessions.filePath, record.filePath));
        await db.delete(drawings).where(eq(drawings.filePath, record.filePath));

        let parsedSessions = [];
        let parsedDrawings = [];

        if (typeof projectData.sessions === "string") {
          try {
            parsedSessions = await decryptData(projectData.sessions);
          } catch (err) {}
        } else if (Array.isArray(projectData.sessions)) {
          parsedSessions = projectData.sessions;
        }

        if (typeof projectData.drawings === "string") {
          try {
            parsedDrawings = await decryptData(projectData.drawings);
          } catch (err) {}
        } else if (Array.isArray(projectData.drawings)) {
          parsedDrawings = projectData.drawings;
        }

        const sessionIdMap: Record<string, string> = {};
        if (parsedSessions.length > 0) {
          const newSessions = parsedSessions.map((s: any) => {
            const newId =
              Date.now().toString() +
              Math.random().toString(36).substring(2, 9);
            sessionIdMap[s.id] = newId;
            return { ...s, id: newId, filePath: record.filePath };
          });
          await db.insert(sessions).values(newSessions);
        }
        if (parsedDrawings.length > 0) {
          const newDrawings = parsedDrawings.map((d: any) => ({
            ...d,
            id:
              Date.now().toString() +
              Math.random().toString(36).substring(2, 9),
            filePath: record.filePath,
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
  }, []);

  stateRef.current.loadProjectFromPath = loadProjectFromPath;

  useEffect(() => {
    if (!isInitRef.current) {
      isInitRef.current = true;
      const init = async () => {
        try {
          await getDb();

          const savedTabsStr = await getSetting("openTabsState");
          const savedActiveId = await getSetting("activeTabId");

          let loadedAnyTabs = false;

          if (savedTabsStr) {
            try {
              const parsedTabs = JSON.parse(savedTabsStr);
              if (Array.isArray(parsedTabs) && parsedTabs.length > 0) {
                const loadedTabs: OpenTab[] = [];
                for (const tab of parsedTabs) {
                  if (window.electronAPI) {
                    const data = await window.electronAPI.loadLibraryFile(
                      tab.filePath,
                    );
                    if (data) {
                      loadedTabs.push({
                        ...tab,
                        pdfData: new Uint8Array(data),
                        isDirty: false,
                      });
                    }
                  }
                }

                if (loadedTabs.length > 0) {
                  setOpenTabs(loadedTabs);
                  loadedAnyTabs = true;

                  const validActive = loadedTabs.find(
                    (t) => t.id === savedActiveId,
                  );
                  if (validActive) {
                    setActiveTabId(validActive.id);
                  } else {
                    setActiveTabId(loadedTabs[0].id);
                  }
                }
              }
            } catch (e) {
              console.error("Failed to parse saved tabs", e);
            }
          }

          if (!loadedAnyTabs && window.electronAPI) {
            const data = await window.electronAPI.loadActivePdf();
            const savedPath = await getSetting("activeFilePath");
            if (data && savedPath) {
              const recents = await getRecentFiles();
              const currentFile = recents.find(
                (f: any) => f.filePath === savedPath,
              );
              if (currentFile) {
                await stateRef.current.loadPdfFile(
                  new Uint8Array(data),
                  currentFile.name,
                  savedPath,
                  currentFile.completed,
                  currentFile.projectPath,
                );
              }
            }
          }
        } catch (err) {
        } finally {
          setIsAppReady(true);
        }
      };
      init();
    }

    const handleFirstClick = () => {
      prewarmAudio();
      window.removeEventListener("click", handleFirstClick);
    };
    window.addEventListener("click", handleFirstClick);

    const handleDataChange = () => {
      setIsDirty(true);
      if (stateRef.current.activeTabId) {
        setOpenTabs((prev) =>
          prev.map((t) =>
            t.id === stateRef.current.activeTabId ? { ...t, isDirty: true } : t,
          ),
        );
      }
    };
    window.addEventListener("margyn-data-changed", handleDataChange);

    let cleanupFileOpen: (() => void) | undefined;
    if (window.electronAPI?.onOpenMargynFile) {
      cleanupFileOpen = window.electronAPI.onOpenMargynFile((filePath) => {
        stateRef.current.requestSafeAction(() =>
          stateRef.current.loadProjectFromPath(filePath),
        );
      });
    }

    let cleanupPdfOpen: (() => void) | undefined;
    if (window.electronAPI?.onOpenPdfFile) {
      cleanupPdfOpen = window.electronAPI.onOpenPdfFile((filePath) => {
        stateRef.current.requestSafeAction(async () => {
          const result = await window.electronAPI?.readPdfPath(filePath);
          if (result && result.data) {
            const record = await addRecentFile(result.name, result.libraryPath);
            if (record) {
              await stateRef.current.loadPdfFile(
                new Uint8Array(result.data),
                record.name,
                record.filePath,
                record.completed || 0,
                null,
              );
            }
          }
        });
      });
    }

    return () => {
      window.removeEventListener("click", handleFirstClick);
      window.removeEventListener("margyn-data-changed", handleDataChange);
      if (cleanupFileOpen) cleanupFileOpen();
      if (cleanupPdfOpen) cleanupPdfOpen();
    };
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    const cleanup = window.electronAPI.onAppCloseRequest(async () => {
      try {
        await saveDb(true);
      } catch (e) {
        console.error("Failed to flush DB before close:", e);
      }

      const dirtyTabs = stateRef.current.openTabs.filter(
        (t) => t.isDirty || (!t.projectPath && t.pdfData),
      );

      if (dirtyTabs.length === 0) {
        window.electronAPI?.forceCloseApp();
        return;
      }

      const processNextDirtyTab = async (remainingDirty: OpenTab[]) => {
        if (remainingDirty.length === 0) {
          try {
            await saveDb(true);
          } catch (e) {}
          window.electronAPI?.forceCloseApp();
          return;
        }

        const currentTabToProcess = remainingDirty[0];
        setActiveTabId(currentTabToProcess.id);
        setView("reader");

        setPendingAction(() => () => {
          const newRemaining = remainingDirty.slice(1);
          processNextDirtyTab(newRemaining);
        });

        setShowCloseModal(true);
      };

      processNextDirtyTab(dirtyTabs);
    });
    return cleanup;
  }, []);

  useEffect(() => {
    if (showEndModal) {
      const timer = setTimeout(() => endInputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [showEndModal]);

  const getProjectData = async () => {
    if (!pdfData || !activeFilePath) return null;
    const db = await getDb();
    const [fileSessions, allDrawings, fileRecords] = await Promise.all([
      db.select().from(sessions).where(eq(sessions.filePath, activeFilePath)),
      db.select().from(drawings).where(eq(drawings.filePath, activeFilePath)),
      db
        .select()
        .from(recentFiles)
        .where(eq(recentFiles.filePath, activeFilePath)),
    ]);
    const fileRecord = fileRecords[0];

    const encryptedSessions = await encryptData(fileSessions);
    const encryptedDrawings = await encryptData(allDrawings);

    return {
      version: "1.0",
      fileName: activeFileName,
      fileBase64: Buffer.from(pdfData).toString("base64"),
      completed: fileRecord?.completed || 0,
      sessions: encryptedSessions,
      drawings: encryptedDrawings,
    };
  };

  const handleSaveProject = async (): Promise<boolean> => {
    if (!window.electronAPI) return false;

    if (!activeProjectPath) {
      const defaultDir = await getSetting("defaultExportDir");
      try {
        const projectData = await getProjectData();
        if (!projectData) return false;

        const savedPath = await window.electronAPI.saveProject(
          projectData,
          null,
          defaultDir,
        );

        if (savedPath) {
          setActiveProjectPath(savedPath);
          await updateRecentFileProjectPath(activeFilePath, savedPath);
          setIsDirty(false);

          if (activeTabId) {
            const db = await getDb();
            const freshDrawings = await db
              .select()
              .from(drawings)
              .where(eq(drawings.filePath, activeFilePath));
            const freshRecent = (
              await db
                .select()
                .from(recentFiles)
                .where(eq(recentFiles.filePath, activeFilePath))
            )[0];
            const newSnapshot = {
              drawings: freshDrawings,
              recentFile: freshRecent,
            };

            setOpenTabs((prev) =>
              prev.map((t) =>
                t.id === activeTabId
                  ? {
                      ...t,
                      projectPath: savedPath,
                      isDirty: false,
                      snapshot: newSnapshot,
                    }
                  : t,
              ),
            );
          }
          showToast("Project saved successfully!", "success");
          return true;
        }
        return false;
      } catch (error) {
        showToast("Failed to save project.", "error");
        return false;
      }
    }

    try {
      const projectData = await getProjectData();
      if (!projectData) return false;

      const savedPath = await window.electronAPI.saveProject(
        projectData,
        activeProjectPath,
        null,
      );

      if (savedPath) {
        setIsDirty(false);
        if (activeTabId) {
          const db = await getDb();
          const freshDrawings = await db
            .select()
            .from(drawings)
            .where(eq(drawings.filePath, activeFilePath));
          const freshRecent = (
            await db
              .select()
              .from(recentFiles)
              .where(eq(recentFiles.filePath, activeFilePath))
          )[0];
          const newSnapshot = {
            drawings: freshDrawings,
            recentFile: freshRecent,
          };

          setOpenTabs((prev) =>
            prev.map((t) =>
              t.id === activeTabId
                ? { ...t, isDirty: false, snapshot: newSnapshot }
                : t,
            ),
          );
        }
        showToast("Project saved successfully!", "success");
        return true;
      }
      return false;
    } catch (error) {
      showToast("Failed to save project.", "error");
      return false;
    }
  };

  const handleExportProject = async (): Promise<boolean> => {
    if (!window.electronAPI) return false;
    try {
      const projectData = await getProjectData();
      if (!projectData) return false;

      const defaultDir = await getSetting("defaultExportDir");
      const savedPath = await window.electronAPI.exportProject(
        projectData,
        defaultDir,
      );

      if (savedPath) {
        setActiveProjectPath(savedPath);
        await updateRecentFileProjectPath(activeFilePath, savedPath);
        setIsDirty(false);
        if (activeTabId) {
          const db = await getDb();
          const freshDrawings = await db
            .select()
            .from(drawings)
            .where(eq(drawings.filePath, activeFilePath));
          const freshRecent = (
            await db
              .select()
              .from(recentFiles)
              .where(eq(recentFiles.filePath, activeFilePath))
          )[0];
          const newSnapshot = {
            drawings: freshDrawings,
            recentFile: freshRecent,
          };

          setOpenTabs((prev) =>
            prev.map((t) =>
              t.id === activeTabId
                ? {
                    ...t,
                    projectPath: savedPath,
                    isDirty: false,
                    snapshot: newSnapshot,
                  }
                : t,
            ),
          );
        }
        showToast("Project exported successfully!", "success");
        return true;
      }
      return false;
    } catch (error) {
      showToast("Failed to export project.", "error");
      return false;
    }
  };

  const handleImportProject = () => {
    stateRef.current.requestSafeAction(async () => {
      if (!window.electronAPI) return;
      try {
        const defaultDir = await getSetting("defaultExportDir");
        const result = await window.electronAPI.importProject(defaultDir);
        if (!result) return;
        await stateRef.current.loadProjectFromPath(result.filePath);
      } catch (error) {
        showToast("Failed to import project.", "error");
      }
    });
  };

  const handleClearCurrentPage = useCallback(async () => {
    if (!activeFilePath) return;
    await clearPageDrawings(activeFilePath, currentPage);
    window.dispatchEvent(new CustomEvent(`margyn-clear-page-${currentPage}`));
    setIsDirty(true);
  }, [currentPage, activeFilePath]);

  const handleClearAllPages = useCallback(async () => {
    if (!activeFilePath) return;
    try {
      const allDrawings = await getAllDrawings(activeFilePath);
      if (allDrawings.length > 0) {
        undoStack.current.push(allDrawings);
        if (undoStack.current.length > 50) undoStack.current.shift();
      }
      await clearAllDrawings(activeFilePath);
      window.dispatchEvent(new CustomEvent("margyn-clear-all"));
      setIsDirty(true);
    } catch (error) {}
  }, [activeFilePath]);

  const handleRedo = useCallback(async () => {
    if (undoStack.current.length > 0 && activeFilePath) {
      const lastState = undoStack.current.pop();
      if (lastState && lastState.length > 0) {
        await restoreDrawings(lastState, activeFilePath);
        window.dispatchEvent(new CustomEvent("margyn-reload-all"));
        setIsDirty(true);
      }
    }
  }, [activeFilePath]);

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

  const handleTryEndSession = () => {
    if (isActive) {
      if (startPage !== null && currentPage < startPage)
        setShowBackwardErrorModal(true);
      else setShowEndModal(true);
    } else {
      startSession(activeFilePath, totalPages);
    }
  };

  useShortcut("endSession", () => {
    if (isActive && !showEndModal && !showBackwardErrorModal) {
      if (startPage !== null && currentPage < startPage)
        setShowBackwardErrorModal(true);
      else setShowEndModal(true);
    }
  });

  useShortcut("openPdf", handleOpenPdf);
  useShortcut("clearPage", handleClearCurrentPage);
  useShortcut("clearAll", handleClearAllPages);
  useShortcut("toggleMargin", () => setIsMarginOpen((prev) => !prev));
  useShortcut("saveProject", handleSaveProject);
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

  const handleModalSave = async () => {
    let success = false;
    if (activeProjectPath) success = await handleSaveProject();
    else success = await handleExportProject();

    if (success) {
      setShowCloseModal(false);
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    }
  };

  // ✅ بازگردانی دیتابیس به حالت اسنپ‌شات در صورت زدن دکمه Don't Save
  const handleModalDiscard = async () => {
    setShowCloseModal(false);
    setIsDirty(false);

    const tabToDiscard = openTabs.find((t) => t.id === activeTabId);
    if (tabToDiscard && tabToDiscard.snapshot) {
      const db = await getDb();

      // ۱. بازگردانی نقاشی‌ها
      await db
        .delete(drawings)
        .where(eq(drawings.filePath, tabToDiscard.filePath));
      if (tabToDiscard.snapshot.drawings.length > 0) {
        await db.insert(drawings).values(tabToDiscard.snapshot.drawings);
      }

      // ۲. بازگردانی وضعیت فایل اخیر (آخرین صفحه، زوم)
      if (tabToDiscard.snapshot.recentFile) {
        await db
          .update(recentFiles)
          .set({
            lastPage: tabToDiscard.snapshot.recentFile.lastPage,
            scale: tabToDiscard.snapshot.recentFile.scale,
            completed: tabToDiscard.snapshot.recentFile.completed,
          })
          .where(eq(recentFiles.filePath, tabToDiscard.filePath));
      }

      // ۳. بازگردانی آخرین صفحه در سشنِ فعال
      const activeSessions = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.filePath, tabToDiscard.filePath),
            isNull(sessions.endTime),
          ),
        );
      if (activeSessions.length > 0 && tabToDiscard.snapshot.recentFile) {
        await db
          .update(sessions)
          .set({ lastPage: tabToDiscard.snapshot.recentFile.lastPage || 1 })
          .where(eq(sessions.id, activeSessions[0].id));
      }

      await saveDb(true);
      // به بوم نقاشی (useInkCanvas) اطلاع میدهیم که تغییراتِ معلق را دور بریزد
      window.dispatchEvent(new Event("margyn-discard-changes"));
    }

    if (activeTabId) {
      setOpenTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, isDirty: false } : t)),
      );
    }
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleModalCancel = () => {
    setShowCloseModal(false);
    setPendingAction(null);
  };

  const handleStartTimer = () => {
    setTimerInput("25");
    setShowTimerModal(true);
  };

  const handleConfirmStartTimer = () => {
    const mins = parseInt(timerInput, 10);
    if (isNaN(mins) || mins <= 0) {
      showToast("Please enter a valid number of minutes.", "error");
      return;
    }
    startTimer(mins * 60 * 1000);
    setShowTimerModal(false);
  };

  const showResumeButton = !isActive && lastFocusPage !== null;

  return (
    <>
      <SplashScreen isAppReady={isAppReady} />

      {isAppReady && (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#09090b]">
          <header className="h-16 flex items-center justify-between px-4 border-b border-white/5 bg-black/40 backdrop-blur-2xl shrink-0 z-[100] shadow-[0_4px_30px_rgba(0,0,0,0.5)] gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
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
                    hasText={hasText}
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

                  {activeProjectPath && (
                    <button
                      onClick={handleSaveProject}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-300 text-xs font-medium border ${isDirty ? "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]" : "text-[#52525b] border-transparent cursor-default"}`}
                      disabled={!isDirty}
                    >
                      <Save
                        size={15}
                        className={isDirty ? "animate-pulse" : ""}
                      />
                      <span className="hidden 2xl:inline">Save</span>
                    </button>
                  )}

                  <div className="w-px h-6 bg-white/10 mx-0.5" />

                  <TimerDisplay />

                  {!timerEndsAt && !isSessionSyncing && (
                    <button
                      onClick={handleStartTimer}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#38bdf8] hover:bg-[#38bdf8]/10 transition-all text-xs font-medium"
                      title="Set focus timer"
                    >
                      <Clock size={15} />
                      <span className="hidden 2xl:inline">Timer</span>
                    </button>
                  )}

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
                      onClick={handleTryEndSession}
                      className={`group relative flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all duration-500 overflow-hidden ${isActive ? "bg-rose-500/10 text-rose-400 border border-rose-500/30" : showResumeButton ? "bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:border-amber-400" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:border-emerald-400"}`}
                    >
                      <div
                        className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md ${isActive ? "bg-rose-500/20" : showResumeButton ? "bg-amber-500/20" : "bg-emerald-500/20"}`}
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

          {view === "reader" && openTabs.length > 0 && (
            <TabsBar
              tabs={openTabs}
              activeTabId={activeTabId}
              onSelectTab={setActiveTabId}
              onCloseTab={handleCloseTab}
              onReorderTabs={handleReorderTabs}
            />
          )}

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
                          <MarginCanvas filePath={activeFilePath} />
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
                    key={activeTabId || "empty"}
                    fileData={pdfData}
                    filePath={activeFilePath}
                    initialScale={activeScale}
                    onScaleChange={handleScaleChange}
                    onTextLayerStatus={setHasText}
                    onDocumentLoad={(pages) => {
                      setTotalPages(pages);
                      if (activeTabId) {
                        setOpenTabs((prev) =>
                          prev.map((t) =>
                            t.id === activeTabId
                              ? { ...t, totalPages: pages }
                              : t,
                          ),
                        );
                      }
                    }}
                    onDropPdf={handleDropPdf}
                    onOpenPdf={handleOpenPdf}
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
                <HistoryView
                  filePath={activeFilePath}
                  fileName={activeFileName}
                  onSessionDeleted={() => syncSessionWithFile(activeFilePath)}
                />
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
                  className={`w-full px-5 py-4 rounded-xl bg-[#18181b] border-2 outline-none transition-all text-center text-lg font-mono tracking-widest shadow-sm ${endError ? "border-rose-400 focus:border-rose-500 text-rose-600 placeholder-rose-300 animate-shake" : "border-[#27272a] focus:border-rose-500/50 text-[#fafafa]"}`}
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

          {showBackwardErrorModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md transition-all duration-300">
              <div className="bg-[#121214] border border-amber-500/30 p-8 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] w-full max-w-md flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <AlertTriangle size={32} className="text-amber-500" />
                </div>
                <Typography
                  variant="pageTitle"
                  as="h2"
                  className="text-[#fafafa] mb-2 font-semibold tracking-tight"
                >
                  Cannot End Session
                </Typography>
                <Typography
                  variant="body"
                  as="p"
                  className="text-[#a1a1aa] mb-8 leading-relaxed"
                >
                  You have navigated behind your session's starting page (Page{" "}
                  {startPage}). To ensure your progress is recorded correctly,
                  you must advance to{" "}
                  <strong>Page {startPage} or beyond</strong> before ending the
                  session.
                </Typography>
                <button
                  onClick={() => setShowBackwardErrorModal(false)}
                  className="w-full px-4 py-3.5 rounded-xl bg-amber-500 text-black hover:bg-amber-400 transition-all font-medium shadow-[0_0_15px_rgba(245,158,11,0.3)] active:scale-[0.98]"
                >
                  Understood
                </button>
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
                  You have unsaved changes in your current project. Do you want
                  to save your progress before leaving?
                </Typography>
                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={handleModalSave}
                    className="w-full px-4 py-3 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all font-medium shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-[0.98]"
                  >
                    Yes, Save
                  </button>
                  <button
                    onClick={handleModalDiscard}
                    className="w-full px-4 py-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all font-medium active:scale-[0.98]"
                  >
                    No, Don't Save
                  </button>
                  <button
                    onClick={handleModalCancel}
                    className="w-full px-4 py-3 rounded-xl bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] border border-[#27272a] transition-all font-medium active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {showTimerModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md transition-all duration-300">
              <div className="bg-[#121214] border border-[#38bdf8]/30 p-8 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] w-full max-w-sm flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-[#38bdf8]/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <Clock size={32} className="text-[#38bdf8]" />
                </div>
                <Typography
                  variant="pageTitle"
                  as="h2"
                  className="text-[#fafafa] mb-2 font-semibold tracking-tight"
                >
                  Set Focus Timer
                </Typography>
                <Typography
                  variant="body"
                  as="p"
                  className="text-[#a1a1aa] mb-8 leading-relaxed"
                >
                  Enter the duration in minutes.
                </Typography>
                <div className="w-full flex items-center bg-[#18181b] border-2 border-[#27272a] focus-within:border-[#38bdf8]/50 rounded-xl transition-all shadow-sm overflow-hidden mb-8">
                  <input
                    type="number"
                    value={timerInput}
                    onChange={(e) => setTimerInput(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") handleConfirmStartTimer();
                      if (e.key === "Escape") setShowTimerModal(false);
                    }}
                    autoFocus
                    className="flex-1 w-full px-5 py-4 bg-transparent outline-none text-center text-xl font-mono tracking-widest text-[#fafafa] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <span className="pr-5 text-[#52525b] font-medium">min</span>
                </div>
                <div className="flex gap-4 w-full">
                  <button
                    onClick={() => setShowTimerModal(false)}
                    className="flex-1 px-4 py-3.5 rounded-xl bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] border border-[#27272a] transition-all font-medium active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmStartTimer}
                    className="flex-1 px-4 py-3.5 rounded-xl bg-[#38bdf8] text-black hover:bg-[#38bdf8]/90 transition-all font-medium shadow-[0_0_15px_rgba(56,189,248,0.3)] active:scale-[0.98]"
                  >
                    Start
                  </button>
                </div>
              </div>
            </div>
          )}

          {toast && (
            <div className="fixed bottom-8 right-8 z-[200] animate-in slide-in-from-bottom-5 fade-in duration-300">
              <div
                className={`flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border backdrop-blur-xl ${toast.type === "success" ? "bg-[#121214]/90 border-emerald-500/30 text-emerald-400 shadow-[0_10px_40px_-10px_rgba(16,185,129,0.3)]" : "bg-[#121214]/90 border-rose-500/30 text-rose-400 shadow-[0_10px_40px_-10px_rgba(244,63,94,0.3)]"}`}
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
    <TimeProvider>
      <SessionProvider>
        <ShortcutProvider>
          <ToolProvider>
            <AppContent />
          </ToolProvider>
        </ShortcutProvider>
      </SessionProvider>
    </TimeProvider>
  );
}
