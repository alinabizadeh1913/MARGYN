"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import MarginCanvas from "./reader/MarginCanvas";
import PdfViewer from "./reader/PdfViewer";
import BlankPageViewer from "./reader/BlankPageViewer";
import Toolbar from "./reader/Toolbar";
import HistoryView from "./HistoryView";
import SettingsView from "./SettingsView";
import LibraryView from "./LibraryView";
import SplashScreen from "./SplashScreen";
import TabsBar, { OpenTab } from "./TabsBar";
import TimerDisplay from "./reader/TimerDisplay";
import { encryptData, decryptData } from "@/lib/crypto";
import { generateFlatPdf } from "@/lib/pdfExport";
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
  FilePlus,
  FileDown,
  FileArchive,
} from "lucide-react";
import { SessionProvider, useSession } from "@/providers/SessionProvider";
import { ToolProvider, useTool } from "@/providers/ToolProvider";
import {
  ShortcutProvider,
  useShortcut,
  useShortcuts,
} from "@/providers/ShortcutProvider";
import { TimeProvider } from "@/providers/TimeProvider";
import { ContextMenuProvider } from "@/providers/ContextMenuProvider";
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
  updateRecentFileCanvasBg,
} from "@/db";
import { prewarmAudio } from "@/lib/audio";
import { sessions, drawings, recentFiles } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

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
    stopTimer,
    activeSessionFilePath,
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
  const [activeCanvasBg, setActiveCanvasBg] = useState("#ffffff");
  const [hasText, setHasText] = useState(true);

  const [isMarginOpen, setIsMarginOpen] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showBackwardErrorModal, setShowBackwardErrorModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // ✅ تغییر: استیت به جای boolean، نوع خروجی را نگه می‌دارد
  const [exportingType, setExportingType] = useState<"pdf" | "margyn" | null>(
    null,
  );

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

  const isClosingRef = useRef(false);
  const isInitRef = useRef(false);
  const scaleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stateRef = useRef({
    loadProjectFromPath: async (path: string) => {},
    loadPdfFile: async (
      data: any,
      name: string,
      path: string,
      comp: any,
      proj: any,
    ) => {},
    activeTabId: null as string | null,
    openTabs: [] as OpenTab[],
  });

  const activeTab = openTabs.find((t) => t.id === activeTabId);

  useEffect(() => {
    setShortcutsEnabled(view === "reader");
  }, [view, setShortcutsEnabled]);

  useEffect(() => {
    window.dispatchEvent(new Event("margyn-clear-active-ink"));
  }, [activeTabId]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showCloseModal) handleModalCancel();
        else if (showEndModal) setShowEndModal(false);
        else if (showBackwardErrorModal) setShowBackwardErrorModal(false);
        else if (showCongratsModal) setShowCongratsModal(false);
        else if (showTimerModal) setShowTimerModal(false);
        else if (showExportModal) setShowExportModal(false);
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
    showExportModal,
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

  const handleCanvasBgChange = useCallback(
    (newColor: string) => {
      setActiveCanvasBg(newColor);
      if (activeTabId) {
        setOpenTabs((prev) =>
          prev.map((t) =>
            t.id === activeTabId ? { ...t, canvasBg: newColor } : t,
          ),
        );
      }
      if (activeFilePath) {
        updateRecentFileCanvasBg(activeFilePath, newColor);
      }
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
    const tab = openTabs.find((t) => t.id === activeTabId);
    if (tab) {
      setPdfData(tab.pdfData);
      setActiveFileName(tab.name);
      setActiveFilePath(tab.filePath);
      setActiveProjectPath(tab.projectPath);
      setTotalPages(tab.totalPages);
      setIsCurrentPdfCompleted(tab.isCompleted);
      setIsDirty(tab.isDirty);
      setActiveScale(tab.scale || 1.3);
      setActiveCanvasBg(tab.canvasBg || "#ffffff");
    } else if (!activeTabId) {
      setPdfData(null);
      setActiveFileName("");
      setActiveFilePath("");
      setActiveProjectPath(null);
      setTotalPages(0);
      setIsCurrentPdfCompleted(false);
      setIsDirty(false);
      setActiveScale(1.3);
      setActiveCanvasBg("#ffffff");
      setHasText(true);
    }
  }, [activeTabId, openTabs]);

  useEffect(() => {
    syncSessionWithFile(activeFilePath);
  }, [activeFilePath, syncSessionWithFile]);

  const prevIsActive = useRef(isActive);
  useEffect(() => {
    if (prevIsActive.current !== isActive) {
      setIsDirty(true);
      if (activeTabId) {
        setOpenTabs((prev) =>
          prev.map((t) => (t.id === activeTabId ? { ...t, isDirty: true } : t)),
        );
      }
      prevIsActive.current = isActive;
    }
  }, [isActive, activeTabId]);

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
        canvasBg: t.canvasBg,
        isBlank: t.isBlank,
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
      setActiveCanvasBg(existingTab.canvasBg || "#ffffff");
      setView("reader");
      return;
    }

    const db = await getDb();
    const fileRecord = (
      await db.select().from(recentFiles).where(eq(recentFiles.filePath, path))
    )[0];
    const initialScale = fileRecord?.scale || 1.3;
    const initialCanvasBg = fileRecord?.canvasBg || "#ffffff";

    const initialDrawings = await db
      .select()
      .from(drawings)
      .where(eq(drawings.filePath, path));
    const initialRecent = (
      await db.select().from(recentFiles).where(eq(recentFiles.filePath, path))
    )[0];
    const initialSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.filePath, path));
    const snapshot = {
      drawings: initialDrawings,
      recentFile: initialRecent,
      sessions: initialSessions,
    };

    const newTabId =
      Date.now().toString() + Math.random().toString(36).substring(2, 5);
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
      canvasBg: initialCanvasBg,
      isBlank: false,
      snapshot,
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
    setActiveCanvasBg(initialCanvasBg);
    setView("reader");
  };

  const handleCreateBlankDocument = useCallback(() => {
    const newTabId =
      Date.now().toString() + Math.random().toString(36).substring(2, 5);
    const newPath = `blank-${newTabId}`;

    const newTab: OpenTab = {
      id: newTabId,
      name: "Untitled Blank",
      filePath: newPath,
      pdfData: new Uint8Array(),
      projectPath: null,
      isDirty: false,
      totalPages: 1,
      currentPage: 1,
      isCompleted: false,
      scale: 1,
      canvasBg: "#ffffff",
      isBlank: true,
      snapshot: { drawings: [], recentFile: null, sessions: [] },
    };

    setOpenTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTabId);
    setPdfData(new Uint8Array());
    setActiveFileName("Untitled Blank");
    setActiveFilePath(newPath);
    setActiveProjectPath(null);
    setTotalPages(1);
    setIsCurrentPdfCompleted(false);
    setIsDirty(false);
    setActiveScale(1);
    setActiveCanvasBg("#ffffff");
    setView("reader");
    showToast("Blank document created!", "success");
  }, []);

  stateRef.current = {
    loadProjectFromPath: async (path: string) => {},
    loadPdfFile,
    activeTabId,
    openTabs,
  };

  const handleOpenPdf = useCallback(async () => {
    if (window.electronAPI) {
      try {
        const results = await window.electronAPI.openPdf();
        if (results && results.length > 0) {
          for (const result of results) {
            if (result && result.data) {
              const record = await addRecentFile(
                result.name,
                result.libraryPath,
              );
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
          }
        }
      } catch (e) {}
    }
  }, []);

  const handleDropPdf = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      showToast("Only PDF files are supported.", "error");
      return;
    }

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
  }, []);

  const handleSelectLibraryFile = useCallback(async (filePath: string) => {
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
  }, []);

  const handleCloseTab = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      const tabToClose = openTabs.find((t) => t.id === tabId);
      if (!tabToClose) return;

      const hasUnsaved = tabToClose.isDirty;

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
            setActiveCanvasBg("#ffffff");
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

  // ✅ تابع جدید برای حذف صفحه در صفحات بلانک
  const handleDeleteBlankPage = async (pageNumberToDelete: number) => {
    if (totalPages <= 1) {
      showToast("Cannot delete the only page.", "error");
      return;
    }

    try {
      const db = await getDb();
      // 1. حذف نقاشی‌های مربوط به آن صفحه
      await db
        .delete(drawings)
        .where(
          and(
            eq(drawings.filePath, activeFilePath),
            eq(drawings.pageNumber, pageNumberToDelete),
          ),
        );

      // 2. شیفت دادن نقاشی‌های صفحات بعدی به یک شماره عقب‌تر
      const allDrawings = await db
        .select()
        .from(drawings)
        .where(eq(drawings.filePath, activeFilePath));
      const toUpdate = allDrawings.filter(
        (d: any) => d.pageNumber > pageNumberToDelete, // ✅ اصلاح تایپ‌اسکریپت
      );
      for (const d of toUpdate) {
        await db
          .update(drawings)
          .set({ pageNumber: d.pageNumber - 1 })
          .where(eq(drawings.id, d.id));
      }

      // 3. آپدیت کردن تعداد کل صفحات
      const newTotal = totalPages - 1;
      setTotalPages(newTotal);
      setOpenTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId ? { ...t, totalPages: newTotal } : t,
        ),
      );

      await saveDb(true);
      window.dispatchEvent(new Event("margyn-reload-all")); // رفرش کردن کانواس‌ها
      showToast("Page deleted successfully.", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to delete page.", "error");
    }
  };

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

      const isBlankDoc = projectData.isBlank || !projectData.fileBase64;

      if (isBlankDoc) {
        const newTabId =
          Date.now().toString() + Math.random().toString(36).substring(2, 5);
        const newPath = `blank-${newTabId}`;
        const displayName = projectData.fileName || "Untitled Blank";

        const newTab: OpenTab = {
          id: newTabId,
          name: displayName,
          filePath: newPath,
          pdfData: new Uint8Array(),
          projectPath: actualPath,
          isDirty: false,
          totalPages: projectData.totalPages || 1,
          currentPage: 1,
          isCompleted: projectData.completed === 1,
          scale: 1,
          canvasBg: "#ffffff",
          isBlank: true,
          snapshot: { drawings: [], recentFile: null, sessions: [] },
        };

        setOpenTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTabId);
        setPdfData(new Uint8Array());
        setActiveFileName(displayName);
        setActiveFilePath(newPath);
        setActiveProjectPath(actualPath);
        setTotalPages(projectData.totalPages || 1);
        setIsCurrentPdfCompleted(projectData.completed === 1);
        setIsDirty(false);
        setActiveScale(1);
        setView("reader");

        await db.delete(sessions).where(eq(sessions.filePath, newPath));
        await db.delete(drawings).where(eq(drawings.filePath, newPath));

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
            return { ...s, id: newId, filePath: newPath };
          });
          await db.insert(sessions).values(newSessions);
        }
        if (parsedDrawings.length > 0) {
          const newDrawings = parsedDrawings.map((d: any) => ({
            ...d,
            id:
              Date.now().toString() +
              Math.random().toString(36).substring(2, 9),
            filePath: newPath,
            sessionId:
              d.sessionId && sessionIdMap[d.sessionId]
                ? sessionIdMap[d.sessionId]
                : null,
          }));
          await db.insert(drawings).values(newDrawings);
        }
        await saveDb(true);
        showToast("Blank document loaded successfully!", "success");
        return;
      }

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
                    if (tab.isBlank) {
                      loadedTabs.push({
                        ...tab,
                        pdfData: new Uint8Array(),
                        isDirty: false,
                      });
                    } else {
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
        stateRef.current.loadProjectFromPath(filePath);
      });
    }

    let cleanupPdfOpen: (() => void) | undefined;
    if (window.electronAPI?.onOpenPdfFile) {
      cleanupPdfOpen = window.electronAPI.onOpenPdfFile(async (filePath) => {
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
      if (isClosingRef.current) return;
      isClosingRef.current = true;

      try {
        await saveDb(true);
      } catch (e) {
        console.error("Failed to flush DB before close:", e);
      }

      const dirtyTabs = stateRef.current.openTabs.filter((t) => t.isDirty);

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
    if (!activeFilePath) return null;
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
      fileBase64: activeTab?.isBlank
        ? ""
        : pdfData
          ? Buffer.from(pdfData).toString("base64")
          : "",
      isBlank: !!activeTab?.isBlank,
      totalPages: totalPages,
      completed: fileRecord?.completed || 0,
      sessions: encryptedSessions,
      drawings: encryptedDrawings,
    };
  };

  const handleExportMargyn = async (): Promise<boolean> => {
    if (!window.electronAPI) return false;
    setExportingType("margyn"); // ✅ فقط دکمه مارگین اسپینر می‌شود
    try {
      const projectData = await getProjectData();
      if (!projectData) {
        setExportingType(null);
        return false;
      }

      const defaultDir = await getSetting("defaultExportDir");
      const savedPath = await window.electronAPI.exportProject(
        projectData,
        defaultDir,
      );

      if (savedPath) {
        setActiveProjectPath(savedPath);
        if (activeFilePath && !activeTab?.isBlank) {
          await updateRecentFileProjectPath(activeFilePath, savedPath);
        }
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
          const freshSessions = await db
            .select()
            .from(sessions)
            .where(eq(sessions.filePath, activeFilePath));

          const newSnapshot = {
            drawings: freshDrawings,
            recentFile: freshRecent,
            sessions: freshSessions,
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
        setShowExportModal(false);
        return true;
      }
      return false;
    } catch (error) {
      showToast("Failed to export project.", "error");
      return false;
    } finally {
      setExportingType(null); // ✅ ریست کردن
    }
  };

  const handleExportPdf = async () => {
    if (!window.electronAPI) return;
    setExportingType("pdf"); // ✅ فقط دکمه PDF اسپینر می‌شود
    try {
      const db = await getDb();
      const allDrawings = await db
        .select()
        .from(drawings)
        .where(eq(drawings.filePath, activeFilePath));

      const pdfBytes = await generateFlatPdf(
        activeTab?.isBlank ? null : pdfData,
        !!activeTab?.isBlank,
        totalPages,
        allDrawings,
      );

      const defaultName = activeFileName
        ? activeFileName.replace(/\.[^/.]+$/, "") + ".pdf"
        : "MARGYN_Export.pdf";

      const savedPath = await window.electronAPI.savePdf(pdfBytes, defaultName);

      if (savedPath) {
        showToast("PDF exported successfully with all annotations!", "success");
        setShowExportModal(false);
      }
    } catch (error) {
      console.error("PDF Export Error:", error);
      showToast("Failed to export as PDF.", "error");
    } finally {
      setExportingType(null); // ✅ ریست کردن
    }
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
          if (activeFilePath && !activeTab?.isBlank) {
            await updateRecentFileProjectPath(activeFilePath, savedPath);
          }
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
            const freshSessions = await db
              .select()
              .from(sessions)
              .where(eq(sessions.filePath, activeFilePath));

            const newSnapshot = {
              drawings: freshDrawings,
              recentFile: freshRecent,
              sessions: freshSessions,
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
          const freshSessions = await db
            .select()
            .from(sessions)
            .where(eq(sessions.filePath, activeFilePath));

          const newSnapshot = {
            drawings: freshDrawings,
            recentFile: freshRecent,
            sessions: freshSessions,
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

  const handleImportProject = async () => {
    if (!window.electronAPI) return;
    try {
      const defaultDir = await getSetting("defaultExportDir");
      const result = await window.electronAPI.importProject(defaultDir);
      if (!result) return;
      await stateRef.current.loadProjectFromPath(result.filePath);
    } catch (error) {
      showToast("Failed to import project.", "error");
    }
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
      await clearAllDrawings(activeFilePath);
      window.dispatchEvent(new CustomEvent("margyn-clear-all"));
      setIsDirty(true);
    } catch (error) {}
  }, [activeFilePath]);

  useShortcut("pen", () => setTool("pen"));
  useShortcut("eraser", () => setTool("eraser"));

  const requestStartSession = useCallback(async () => {
    if (activeSessionFilePath && activeSessionFilePath !== activeFilePath) {
      const db = await getDb();
      const recents = await db
        .select()
        .from(recentFiles)
        .where(eq(recentFiles.filePath, activeSessionFilePath));
      const name = recents.length > 0 ? recents[0].name : "another file";
      showToast(
        `Focus session is active in "${name}". Please end it first.`,
        "error",
      );
      return;
    }

    try {
      await startSession(activeFilePath, totalPages);
    } catch (err: any) {
      if (err.message && err.message.startsWith("SESSION_ACTIVE:")) {
        showToast(
          `Focus session is active in "${err.message.split(":")[1]}".`,
          "error",
        );
      }
    }
  }, [activeSessionFilePath, activeFilePath, startSession, totalPages]);

  useShortcut("startSession", () => {
    if (
      !isActive &&
      !showEndModal &&
      !isCurrentPdfCompleted &&
      activeFilePath &&
      !isSessionSyncing
    ) {
      requestStartSession();
    }
  });

  const handleTryEndSession = () => {
    if (isActive) {
      if (startPage !== null && currentPage < startPage)
        setShowBackwardErrorModal(true);
      else setShowEndModal(true);
    } else {
      requestStartSession();
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
  useShortcut("exportProject", () => {
    if (pdfData) setShowExportModal(true);
  });

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
    else success = await handleExportMargyn();

    if (success) {
      setShowCloseModal(false);
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    }
  };

  const handleModalDiscard = async () => {
    setShowCloseModal(false);
    setIsDirty(false);

    const tabToDiscard = openTabs.find((t) => t.id === activeTabId);
    if (tabToDiscard && tabToDiscard.snapshot) {
      try {
        const db = await getDb();

        await db
          .delete(drawings)
          .where(eq(drawings.filePath, tabToDiscard.filePath));
        if (tabToDiscard.snapshot.drawings.length > 0) {
          await db.insert(drawings).values(tabToDiscard.snapshot.drawings);
        }

        if (tabToDiscard.snapshot.recentFile) {
          await db
            .update(recentFiles)
            .set({
              lastPage: tabToDiscard.snapshot.recentFile.lastPage,
              scale: tabToDiscard.snapshot.recentFile.scale,
              completed: tabToDiscard.snapshot.recentFile.completed,
              canvasBg: tabToDiscard.snapshot.recentFile.canvasBg,
            })
            .where(eq(recentFiles.filePath, tabToDiscard.filePath));
        }

        await db
          .delete(sessions)
          .where(eq(sessions.filePath, tabToDiscard.filePath));
        if (
          tabToDiscard.snapshot.sessions &&
          tabToDiscard.snapshot.sessions.length > 0
        ) {
          await db.insert(sessions).values(tabToDiscard.snapshot.sessions);
        }

        await saveDb(true);

        window.dispatchEvent(new Event("margyn-reload-all"));
        try {
          await syncSessionWithFile(tabToDiscard.filePath);
        } catch (e) {}
        stopTimer();

        if (activeTabId) {
          setOpenTabs((prev) =>
            prev.map((t) =>
              t.id === activeTabId
                ? {
                    ...t,
                    isDirty: false,
                    currentPage:
                      tabToDiscard.snapshot?.recentFile?.lastPage || 1,
                    scale: tabToDiscard.snapshot?.recentFile?.scale || 1.3,
                    canvasBg:
                      tabToDiscard.snapshot?.recentFile?.canvasBg || "#ffffff",
                  }
                : t,
            ),
          );
        }
      } catch (e) {
        console.error("Failed to discard changes", e);
      }
    } else {
      if (activeTabId) {
        setOpenTabs((prev) =>
          prev.map((t) =>
            t.id === activeTabId ? { ...t, isDirty: false } : t,
          ),
        );
      }
    }

    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleModalCancel = () => {
    setShowCloseModal(false);
    setPendingAction(null);
    isClosingRef.current = false;
  };

  const handleStartTimer = () => {
    if (!isActive) return;
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
                <>
                  <button
                    onClick={handleCreateBlankDocument}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#38bdf8] hover:text-white hover:bg-[#38bdf8]/20 transition-all duration-300 text-xs font-medium border border-transparent hover:border-[#38bdf8]/30"
                  >
                    <FilePlus size={15} />
                    <span className="hidden 2xl:inline">New Blank</span>
                  </button>

                  <button
                    onClick={handleOpenPdf}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-all duration-300 text-xs font-medium border border-transparent hover:border-white/10"
                  >
                    <FileText size={15} />
                    <span className="hidden 2xl:inline">Open PDF</span>
                  </button>
                </>
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
                    onClick={() => setShowExportModal(true)}
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

                  {/* ✅ غیرفعال کردن کامل بخش سشن برای صفحات بلانک */}
                  {activeTab?.isBlank ? (
                    <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#18181b] text-[#52525b] border border-[#27272a] cursor-not-allowed">
                      <Lock size={14} />
                      <span className="hidden 2xl:inline">
                        <Typography variant="button">
                          No Session (Blank)
                        </Typography>
                      </span>
                    </div>
                  ) : activeSessionFilePath ? (
                    activeSessionFilePath === activeFilePath ? (
                      timerEndsAt ? (
                        <TimerDisplay />
                      ) : (
                        isActive &&
                        !isSessionSyncing && (
                          <button
                            onClick={handleStartTimer}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#38bdf8] hover:bg-[#38bdf8]/10 transition-all text-xs font-medium"
                            title="Set focus timer"
                          >
                            <Clock size={15} />
                            <span className="hidden 2xl:inline">Timer</span>
                          </button>
                        )
                      )
                    ) : (
                      <button
                        disabled
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#52525b] border border-[#27272a] cursor-not-allowed opacity-60 text-xs font-medium"
                        title="Focus session is active in another file"
                      >
                        <Clock size={15} />
                        <span className="hidden 2xl:inline">Timer</span>
                      </button>
                    )
                  ) : null}

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
                {pdfData && !activeTab?.isBlank && (
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
                  {activeTab?.isBlank ? (
                    <BlankPageViewer
                      filePath={activeFilePath}
                      initialPages={totalPages}
                      canvasBg={activeCanvasBg}
                      onPageAdded={(newTotal) => {
                        setTotalPages(newTotal);
                        if (activeTabId) {
                          setOpenTabs((prev) =>
                            prev.map((t) =>
                              t.id === activeTabId
                                ? { ...t, totalPages: newTotal }
                                : t,
                            ),
                          );
                        }
                      }}
                      onDeletePage={handleDeleteBlankPage} // ✅ پاس داده شد
                    />
                  ) : (
                    <PdfViewer
                      key={activeTabId || "empty"}
                      fileData={pdfData}
                      filePath={activeFilePath}
                      initialScale={activeScale}
                      canvasBg={activeCanvasBg}
                      onCanvasBgChange={handleCanvasBgChange}
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
                  )}
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

          {showExportModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-md transition-all duration-300">
              <div className="bg-[#121214] border border-[#38bdf8]/30 p-8 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] w-full max-w-md flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
                <div className="w-16 h-16 bg-[#38bdf8]/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
                  <Upload size={32} className="text-[#38bdf8]" />
                </div>
                <Typography
                  variant="pageTitle"
                  as="h2"
                  className="text-[#fafafa] mb-2 font-semibold tracking-tight"
                >
                  Export Document
                </Typography>
                <Typography
                  variant="body"
                  as="p"
                  className="text-[#a1a1aa] mb-8 leading-relaxed"
                >
                  Choose a format to save your work.
                </Typography>

                <div className="flex flex-col gap-3 w-full">
                  <button
                    onClick={handleExportPdf}
                    disabled={exportingType !== null}
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] hover:border-[#38bdf8]/50 transition-all group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                        <FileDown size={20} className="text-rose-400" />
                      </div>
                      {/* ✅ استفاده از flex-col برای ایجاد فاصله بین عنوان و توضیحات */}
                      <div className="flex flex-col text-left gap-1">
                        <Typography
                          variant="cardTitle"
                          className="text-[#fafafa]"
                        >
                          PDF Document
                        </Typography>
                        <Typography
                          variant="caption"
                          className="text-[#a1a1aa]"
                        >
                          Flat PDF with all annotations
                        </Typography>
                      </div>
                    </div>
                    {exportingType === "pdf" ? (
                      <div className="w-5 h-5 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin shrink-0" />
                    ) : (
                      <ChevronRight
                        size={20}
                        className="text-[#52525b] group-hover:text-[#38bdf8] transition-colors shrink-0"
                      />
                    )}
                  </button>

                  <button
                    onClick={handleExportMargyn}
                    disabled={exportingType !== null}
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-[#18181b] border border-[#27272a] hover:bg-[#27272a] hover:border-[#38bdf8]/50 transition-all group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <FileArchive size={20} className="text-emerald-400" />
                      </div>
                      {/* ✅ استفاده از flex-col برای ایجاد فاصله بین عنوان و توضیحات */}
                      <div className="flex flex-col text-left gap-1">
                        <Typography
                          variant="cardTitle"
                          className="text-[#fafafa]"
                        >
                          Margyn Project
                        </Typography>
                        <Typography
                          variant="caption"
                          className="text-[#a1a1aa]"
                        >
                          Editable project (.margyn)
                        </Typography>
                      </div>
                    </div>
                    {exportingType === "margyn" ? (
                      <div className="w-5 h-5 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin shrink-0" />
                    ) : (
                      <ChevronRight
                        size={20}
                        className="text-[#52525b] group-hover:text-[#38bdf8] transition-colors shrink-0"
                      />
                    )}
                  </button>
                </div>

                <button
                  onClick={() => setShowExportModal(false)}
                  disabled={exportingType !== null}
                  className="w-full mt-4 px-4 py-3 rounded-xl bg-transparent text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] transition-all font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
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
            <ContextMenuProvider>
              <AppContent />
            </ContextMenuProvider>
          </ToolProvider>
        </ShortcutProvider>
      </SessionProvider>
    </TimeProvider>
  );
}
