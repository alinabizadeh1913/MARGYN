"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { generateFlatPdf } from "@/lib/pdfExport";
import { encryptData, decryptData } from "@/lib/crypto";
import { SessionProvider, useSession } from "@/providers/SessionProvider";
import { ToolProvider, useTool } from "@/providers/ToolProvider";
import { useShortcut, useShortcuts } from "@/providers/ShortcutProvider";
import SplashScreen from "../SplashScreen";
import TabsBar, { OpenTab } from "../TabsBar";
import { AppHeader } from "./AppHeader";
import { AppReader } from "./AppReader";
import { AppModals } from "./AppModals";
import NoteModal from "./NoteModal"; // ✅ اضافه شد
import { REQUIRED_END_PHRASE } from "./constants";
import {
  clearPageDrawings,
  clearAllDrawings,
  getDb,
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
import { sessions, drawings, recentFiles, notes } from "@/db/schema"; // ✅ notes اضافه شد
import { eq, and } from "drizzle-orm";

export function AppContent() {
  const {
    isActive,
    lastFocusPage,
    startPage,
    startSession,
    endSession,
    currentPage,
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

  // ✅ استیت مربوط به نوت‌ها
  const [showNoteModal, setShowNoteModal] = useState(false);

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
  const prevActiveTabId = useRef<string | null>(null);

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
    if (!isAppReady) return;
    if (activeTabId !== prevActiveTabId.current) {
      const tab = openTabs.find((t) => t.id === activeTabId);
      window.dispatchEvent(
        new CustomEvent("margyn-tab-switched", {
          detail: {
            tabId: activeTabId,
            toolState: tab?.toolState,
          },
        }),
      );
      prevActiveTabId.current = activeTabId;
    }
  }, [activeTabId, openTabs, isAppReady]);

  useEffect(() => {
    const handleToolStateChange = (
      e: CustomEvent<{ tabId: string; toolState: any }>,
    ) => {
      const { tabId, toolState } = e.detail;
      setOpenTabs((prev) =>
        prev.map((t) => (t.id === tabId ? { ...t, toolState } : t)),
      );
    };
    window.addEventListener(
      "margyn-tool-state-changed",
      handleToolStateChange as EventListener,
    );
    return () =>
      window.removeEventListener(
        "margyn-tool-state-changed",
        handleToolStateChange as EventListener,
      );
  }, []);

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
        else if (showNoteModal) setShowNoteModal(false); // ✅ اضافه شد
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
    showNoteModal, // ✅ اضافه شد
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
        toolState: t.toolState, // ✅ اضافه شد
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

  const handleDeleteBlankPage = async (pageNumberToDelete: number) => {
    if (totalPages <= 1) {
      showToast("Cannot delete the only page.", "error");
      return;
    }

    try {
      const db = await getDb();
      await db
        .delete(drawings)
        .where(
          and(
            eq(drawings.filePath, activeFilePath),
            eq(drawings.pageNumber, pageNumberToDelete),
          ),
        );

      const allDrawings = await db
        .select()
        .from(drawings)
        .where(eq(drawings.filePath, activeFilePath));
      const toUpdate = allDrawings.filter(
        (d: any) => d.pageNumber > pageNumberToDelete,
      );
      for (const d of toUpdate) {
        await db
          .update(drawings)
          .set({ pageNumber: d.pageNumber - 1 })
          .where(eq(drawings.id, d.id));
      }

      const newTotal = totalPages - 1;
      setTotalPages(newTotal);
      setOpenTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId ? { ...t, totalPages: newTotal } : t,
        ),
      );

      await saveDb(true);
      window.dispatchEvent(new Event("margyn-reload-all"));
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
        await db.delete(notes).where(eq(notes.filePath, newPath)); // ✅ اضافه شد

        let parsedSessions = [];
        let parsedDrawings = [];
        let parsedNotes = []; // ✅ اضافه شد

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

        if (typeof projectData.notes === "string") {
          try {
            parsedNotes = await decryptData(projectData.notes);
          } catch (err) {}
        } else if (Array.isArray(projectData.notes)) {
          parsedNotes = projectData.notes;
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
        if (parsedNotes.length > 0) {
          const newNotes = parsedNotes.map((n: any) => ({
            ...n,
            id:
              Date.now().toString() +
              Math.random().toString(36).substring(2, 9),
            filePath: newPath,
          }));
          await db.insert(notes).values(newNotes);
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
        await db.delete(notes).where(eq(notes.filePath, record.filePath)); // ✅ اضافه شد

        let parsedSessions = [];
        let parsedDrawings = [];
        let parsedNotes = []; // ✅ اضافه شد

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

        if (typeof projectData.notes === "string") {
          try {
            parsedNotes = await decryptData(projectData.notes);
          } catch (err) {}
        } else if (Array.isArray(projectData.notes)) {
          parsedNotes = projectData.notes;
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
        if (parsedNotes.length > 0) {
          const newNotes = parsedNotes.map((n: any) => ({
            ...n,
            id:
              Date.now().toString() +
              Math.random().toString(36).substring(2, 9),
            filePath: record.filePath,
          }));
          await db.insert(notes).values(newNotes);
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
    const [fileSessions, allDrawings, fileRecords, allNotes] =
      await Promise.all([
        // ✅ allNotes اضافه شد
        db.select().from(sessions).where(eq(sessions.filePath, activeFilePath)),
        db.select().from(drawings).where(eq(drawings.filePath, activeFilePath)),
        db
          .select()
          .from(recentFiles)
          .where(eq(recentFiles.filePath, activeFilePath)),
        db.select().from(notes).where(eq(notes.filePath, activeFilePath)), // ✅ اضافه شد
      ]);
    const fileRecord = fileRecords[0];

    const encryptedSessions = await encryptData(fileSessions);
    const encryptedDrawings = await encryptData(allDrawings);
    const encryptedNotes = await encryptData(allNotes); // ✅ اضافه شد

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
      notes: encryptedNotes, // ✅ اضافه شد
    };
  };

  const handleExportMargyn = async (): Promise<boolean> => {
    if (!window.electronAPI) return false;
    setExportingType("margyn");
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
      setExportingType(null);
    }
  };

  const handleExportPdf = async () => {
    if (!window.electronAPI) return;
    setExportingType("pdf");
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
      setExportingType(null);
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
  useShortcut("newBlank", handleCreateBlankDocument);

  // ✅ شورتکات نوت‌ها
  useShortcut("note", () => {
    if (activeFilePath) setShowNoteModal(true);
  });

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
          <AppHeader
            view={view}
            setView={setView}
            handleClearCurrentPage={handleClearCurrentPage}
            handleClearAllPages={handleClearAllPages}
            hasText={hasText}
            handleCreateBlankDocument={handleCreateBlankDocument}
            handleOpenPdf={handleOpenPdf}
            handleImportProject={handleImportProject}
            setShowExportModal={setShowExportModal}
            activeProjectPath={activeProjectPath}
            isDirty={isDirty}
            handleSaveProject={handleSaveProject}
            activeTab={activeTab}
            activeSessionFilePath={activeSessionFilePath}
            activeFilePath={activeFilePath}
            timerEndsAt={timerEndsAt}
            isActive={isActive}
            isSessionSyncing={isSessionSyncing}
            isCurrentPdfCompleted={isCurrentPdfCompleted}
            showResumeButton={showResumeButton}
            handleTryEndSession={handleTryEndSession}
            handleStartTimer={handleStartTimer}
            pdfData={pdfData}
          />

          {view === "reader" && openTabs.length > 0 && (
            <TabsBar
              tabs={openTabs}
              activeTabId={activeTabId}
              onSelectTab={setActiveTabId}
              onCloseTab={handleCloseTab}
              onReorderTabs={handleReorderTabs}
            />
          )}

          <AppReader
            view={view}
            pdfData={pdfData}
            activeTab={activeTab}
            isMarginOpen={isMarginOpen}
            setIsMarginOpen={setIsMarginOpen}
            activeFilePath={activeFilePath}
            totalPages={totalPages}
            activeCanvasBg={activeCanvasBg}
            setTotalPages={setTotalPages}
            setOpenTabs={setOpenTabs}
            activeTabId={activeTabId}
            handleDeleteBlankPage={handleDeleteBlankPage}
            activeScale={activeScale}
            handleCanvasBgChange={handleCanvasBgChange}
            handleScaleChange={handleScaleChange}
            setHasText={setHasText}
            handleDropPdf={handleDropPdf}
            handleOpenPdf={handleOpenPdf}
            activeFileName={activeFileName}
            syncSessionWithFile={syncSessionWithFile}
            handleSelectLibraryFile={handleSelectLibraryFile}
            handleImportProject={handleImportProject}
            onOpenNote={() => setShowNoteModal(true)} // ✅ اضافه شد
          />

          <AppModals
            showEndModal={showEndModal}
            setShowEndModal={setShowEndModal}
            showBackwardErrorModal={showBackwardErrorModal}
            setShowBackwardErrorModal={setShowBackwardErrorModal}
            startPage={startPage}
            showCongratsModal={showCongratsModal}
            setShowCongratsModal={setShowCongratsModal}
            activeFileName={activeFileName}
            showCloseModal={showCloseModal}
            handleModalSave={handleModalSave}
            handleModalDiscard={handleModalDiscard}
            handleModalCancel={handleModalCancel}
            showTimerModal={showTimerModal}
            setShowTimerModal={setShowTimerModal}
            timerInput={timerInput}
            setTimerInput={setTimerInput}
            handleConfirmStartTimer={handleConfirmStartTimer}
            showExportModal={showExportModal}
            setShowExportModal={setShowExportModal}
            handleExportPdf={handleExportPdf}
            handleExportMargyn={handleExportMargyn}
            exportingType={exportingType}
            toast={toast}
            endText={endText}
            setEndText={setEndText}
            endError={endError}
            setEndError={setEndError}
            endInputRef={endInputRef}
            handleConfirmEndSession={handleConfirmEndSession}
          />

          {/* ✅ رندر مدال نوت‌ها */}
          <NoteModal
            isOpen={showNoteModal}
            onClose={() => setShowNoteModal(false)}
            filePath={activeFilePath}
            pageNumber={currentPage}
            onSave={() => {
              setIsDirty(true);
              if (activeTabId) {
                setOpenTabs((prev) =>
                  prev.map((t) =>
                    t.id === activeTabId ? { ...t, isDirty: true } : t,
                  ),
                );
              }
            }}
          />
        </div>
      )}
    </>
  );
}
