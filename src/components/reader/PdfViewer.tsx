"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import * as pdfjsLib from "pdfjs-dist";
import { useSession } from "@/providers/SessionProvider";
import { useTool } from "@/providers/ToolProvider";
import {
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize,
  Minimize,
  ChevronUp,
  ChevronDown,
  Palette,
  ShieldAlert,
  Lock,
  Hash,
  FileDown,
  Edit3, // ✅ اضافه شد
} from "lucide-react";
import Typography from "@/typography";
import PdfDrawingLayer from "./PdfDrawingLayer";
import { buildTextLines } from "./pdfText";
import type { TextLine } from "./inkTypes";

pdfjsLib.GlobalWorkerOptions.workerSrc = "pdf.worker.min.mjs";

const REQUIRED_PHRASE = "I AM BREAKING MY FOCUS";
const DEFAULT_SCALE = 1.3;
const PREFETCH_WINDOW = 5;
const MAX_CACHE_SIZE = 20;

interface LoadedDoc {
  id: number;
  doc: pdfjsLib.PDFDocumentProxy;
}
interface DisplayedPage {
  key: string;
  pageNumber: number;
  width: number;
  height: number;
}
interface CachedPage {
  canvas: HTMLCanvasElement;
  cssWidth: number;
  cssHeight: number;
  textLines: TextLine[];
}

interface PdfViewerProps {
  fileData: Uint8Array | null;
  filePath?: string;
  initialScale?: number;
  canvasBg: string;
  onCanvasBgChange: (color: string) => void;
  onDocumentLoad?: (totalPages: number) => void;
  onDropPdf?: (file: File) => void;
  onOpenPdf?: () => void;
  onScaleChange?: (scale: number) => void;
  onTextLayerStatus?: (hasText: boolean) => void;
  onOpenNote?: () => void; // ✅ اضافه شد
}

export default function PdfViewer({
  fileData,
  filePath,
  initialScale,
  canvasBg,
  onCanvasBgChange,
  onDocumentLoad,
  onDropPdf,
  onOpenPdf,
  onScaleChange,
  onTextLayerStatus,
  onOpenNote, // ✅ اضافه شد
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const goToPageInputRef = useRef<HTMLInputElement>(null);

  const docIdRef = useRef(0);
  const inflightRef = useRef<Promise<void>>(Promise.resolve());
  const displayedKeyRef = useRef<string | null>(null);

  const cacheRef = useRef<Map<string, CachedPage>>(new Map());
  const prefetchingRef = useRef<Set<string>>(new Set());

  const holdTimeout = useRef<NodeJS.Timeout | null>(null);
  const holdInterval = useRef<NodeJS.Timeout | null>(null);

  const { isActive, lastFocusPage, currentPage, setCurrentPage } = useSession();
  const { tool } = useTool();

  const [loadedDoc, setLoadedDoc] = useState<LoadedDoc | null>(null);
  const [scale, setScale] = useState(initialScale || DEFAULT_SCALE);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [displayed, setDisplayed] = useState<DisplayedPage | null>(null);
  const [textLines, setTextLines] = useState<TextLine[]>([]);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const [showBackModal, setShowBackModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [confirmError, setConfirmError] = useState(false);

  const [showGoToPageModal, setShowGoToPageModal] = useState(false);
  const [goToPageValue, setGoToPageValue] = useState("");

  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (initialScale) setScale(initialScale);
  }, [initialScale]);

  const changeScale = useCallback(
    (newScale: number) => {
      setScale(newScale);
      if (onScaleChange) onScaleChange(newScale);
    },
    [onScaleChange],
  );

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showBackModal) setShowBackModal(false);
        else if (showGoToPageModal) setShowGoToPageModal(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showBackModal, showGoToPageModal]);

  const isNavigationLocked = !isActive && lastFocusPage !== null;

  const requestKey = loadedDoc
    ? `${loadedDoc.id}:${currentPage}:${scale}`
    : null;
  const isCacheHit = requestKey ? cacheRef.current.has(requestKey) : false;
  const isLoading =
    !isCacheHit &&
    (isRendering ||
      requestKey === null ||
      displayed?.key !== requestKey ||
      revealedKey !== requestKey);

  const latestRef = useRef({
    onDocumentLoad,
    currentPage,
    setCurrentPage,
    onTextLayerStatus,
  });
  useEffect(() => {
    latestRef.current = {
      onDocumentLoad,
      currentPage,
      setCurrentPage,
      onTextLayerStatus,
    };
  });

  const toggleFullscreen = () => {
    if (!document.fullscreenElement)
      viewerRef.current?.requestFullscreen().catch((err) => console.error(err));
    else document.exitFullscreen();
  };

  useEffect(() => {
    const handleFullscreenChange = () =>
      setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setContainerSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    cacheRef.current.forEach((cached) => {
      cached.canvas.width = 0;
      cached.canvas.height = 0;
    });
    cacheRef.current.clear();
    prefetchingRef.current.clear();
  }, [fileData, scale]);

  useEffect(() => {
    setLoadedDoc(null);
    setDisplayed(null);
    setRevealedKey(null);
    setErrorKey(null);
    displayedKeyRef.current = null;
    if (!fileData) {
      latestRef.current.onDocumentLoad?.(0);
      return;
    }

    let cancelled = false;
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(fileData),
    });

    loadingTask.promise
      .then((doc) => {
        if (cancelled) return;
        docIdRef.current += 1;
        setLoadedDoc({ id: docIdRef.current, doc });
        latestRef.current.onDocumentLoad?.(doc.numPages);
        if (latestRef.current.currentPage > doc.numPages)
          latestRef.current.setCurrentPage(1);
      })
      .catch((error) => {
        if (!cancelled) console.error("Failed to load PDF:", error);
      });

    return () => {
      cancelled = true;
      loadingTask.destroy();
    };
  }, [fileData]);

  const prefetchPages = useCallback(
    (doc: LoadedDoc, current: number) => {
      const start = Math.max(1, current - PREFETCH_WINDOW);
      const end = Math.min(doc.doc.numPages, current + PREFETCH_WINDOW);

      for (let i = start; i <= end; i++) {
        if (i === current) continue;
        const key = `${doc.id}:${i}:${scale}`;
        if (cacheRef.current.has(key) || prefetchingRef.current.has(key))
          continue;

        prefetchingRef.current.add(key);
        const delay = Math.abs(i - current) * 50;

        setTimeout(async () => {
          try {
            const page = await doc.doc.getPage(i);
            const viewport = page.getViewport({ scale });
            const outputScale = window.devicePixelRatio || 1;

            const offscreen = document.createElement("canvas");
            offscreen.width = Math.floor(viewport.width * outputScale);
            offscreen.height = Math.floor(viewport.height * outputScale);
            const ctx = offscreen.getContext("2d", { alpha: false });
            if (!ctx) return;

            const task = page.render({
              canvasContext: ctx,
              viewport,
              transform:
                outputScale !== 1
                  ? [outputScale, 0, 0, outputScale, 0, 0]
                  : undefined,
            });

            await task.promise;

            const textContent = await page.getTextContent();
            const lines = buildTextLines(
              textContent.items as any[],
              viewport,
              pdfjsLib.Util,
            );

            cacheRef.current.set(key, {
              canvas: offscreen,
              cssWidth: Math.floor(viewport.width),
              cssHeight: Math.floor(viewport.height),
              textLines: lines,
            });

            if (cacheRef.current.size > MAX_CACHE_SIZE) {
              const protectedKey = `${doc.id}:${current}:${scale}`;
              const oldestKey = cacheRef.current.keys().next().value;
              if (oldestKey && oldestKey !== protectedKey) {
                const c = cacheRef.current.get(oldestKey)?.canvas;
                if (c) {
                  c.width = 0;
                  c.height = 0;
                }
                cacheRef.current.delete(oldestKey);
              }
            }
          } catch (err: any) {
            if (err.message !== "Transport destroyed")
              console.warn(`Prefetch failed for page ${i}`, err);
          } finally {
            prefetchingRef.current.delete(key);
          }
        }, delay);
      }
    },
    [scale],
  );

  useLayoutEffect(() => {
    if (!loadedDoc || !requestKey) return;
    if (displayedKeyRef.current === requestKey) return;

    const { doc } = loadedDoc;
    const pageNumber = currentPage;
    const currentKey = requestKey;
    let cancelled = false;
    let task: pdfjsLib.RenderTask | null = null;
    let renderTimeout: NodeJS.Timeout | null = null;
    let getPageTimeout: NodeJS.Timeout | null = null;

    const cached = cacheRef.current.get(currentKey);
    if (cached) {
      const visible = canvasRef.current;
      const visibleCtx = visible?.getContext("2d", { alpha: false });
      if (visible && visibleCtx) {
        visible.width = cached.canvas.width;
        visible.height = cached.canvas.height;
        visibleCtx.drawImage(cached.canvas, 0, 0);
        displayedKeyRef.current = currentKey;
        setDisplayed({
          key: currentKey,
          pageNumber,
          width: cached.cssWidth,
          height: cached.cssHeight,
        });
        setTextLines(cached.textLines);
        latestRef.current.onTextLayerStatus?.(cached.textLines.length > 0);
        setRevealedKey(currentKey);
        setIsRendering(false);
        prefetchPages(loadedDoc, pageNumber);
        return;
      }
    }

    setIsRendering(true);
    const previousRun = inflightRef.current;

    const run = async () => {
      await Promise.race([
        previousRun,
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
      if (cancelled) return;

      let offscreen: HTMLCanvasElement | null = null;
      let page: pdfjsLib.PDFPageProxy | null = null;

      try {
        page = await Promise.race([
          doc.getPage(pageNumber),
          new Promise<never>((_, reject) => {
            getPageTimeout = setTimeout(
              () => reject(new Error("getPage timeout")),
              8000,
            );
          }),
        ]);
        if (getPageTimeout) clearTimeout(getPageTimeout);
        if (cancelled) {
          page.cleanup();
          return;
        }

        const viewport = page.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;
        const cssWidth = Math.floor(viewport.width);
        const cssHeight = Math.floor(viewport.height);

        offscreen = document.createElement("canvas");
        offscreen.width = Math.floor(viewport.width * outputScale);
        offscreen.height = Math.floor(viewport.height * outputScale);
        const offCtx = offscreen.getContext("2d", { alpha: false });
        if (!offCtx) throw new Error("2D canvas context unavailable");

        task = page.render({
          canvasContext: offCtx,
          viewport,
          transform:
            outputScale !== 1
              ? [outputScale, 0, 0, outputScale, 0, 0]
              : undefined,
        });

        const renderPromise = task.promise;
        const timeoutPromise = new Promise<void>((_, reject) => {
          renderTimeout = setTimeout(() => {
            try {
              task?.cancel();
            } catch (e) {}
            reject(new Error("Render timeout"));
          }, 30000);
        });

        await Promise.race([renderPromise, timeoutPromise]);
        if (renderTimeout) clearTimeout(renderTimeout);
        if (cancelled) return;

        const textContent = await page.getTextContent();
        const lines = buildTextLines(
          textContent.items as any[],
          viewport,
          pdfjsLib.Util,
        );

        if (!cancelled) {
          setTextLines(lines);
          latestRef.current.onTextLayerStatus?.(lines.length > 0);
        }

        const visible = canvasRef.current;
        const visibleCtx = visible?.getContext("2d", { alpha: false });
        if (!visible || !visibleCtx) return;

        visible.width = offscreen.width;
        visible.height = offscreen.height;
        visibleCtx.drawImage(offscreen, 0, 0);
        displayedKeyRef.current = currentKey;

        setDisplayed({
          key: currentKey,
          pageNumber,
          width: cssWidth,
          height: cssHeight,
        });
        cacheRef.current.set(currentKey, {
          canvas: offscreen,
          cssWidth,
          cssHeight,
          textLines: lines,
        });
        offscreen = null;
        prefetchPages(loadedDoc, pageNumber);
      } catch (error: any) {
        if (renderTimeout) clearTimeout(renderTimeout);
        if (getPageTimeout) clearTimeout(getPageTimeout);
        if (error.message === "Transport destroyed") return;
        if (!cancelled && error?.name !== "RenderingCancelledException") {
          console.error("Render error:", error);
          setErrorKey(currentKey);
        }
      } finally {
        setIsRendering(false);
        if (renderTimeout) clearTimeout(renderTimeout);
        if (getPageTimeout) clearTimeout(getPageTimeout);
        if (offscreen) {
          offscreen.width = 0;
          offscreen.height = 0;
        }
        if (page && cancelled) page.cleanup();
      }
    };

    inflightRef.current = run();

    return () => {
      cancelled = true;
      if (renderTimeout) clearTimeout(renderTimeout);
      if (getPageTimeout) clearTimeout(getPageTimeout);
      if (task) {
        try {
          task.cancel();
        } catch (e) {}
      }
    };
  }, [loadedDoc, requestKey, currentPage, scale, prefetchPages]);

  useEffect(() => {
    if (
      !requestKey ||
      displayed?.key !== requestKey ||
      revealedKey === requestKey
    )
      return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setRevealedKey(requestKey));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [displayed, requestKey, revealedKey]);

  const handleNextPage = useCallback(() => {
    if (isNavigationLocked) return;
    if (loadedDoc && currentPage < loadedDoc.doc.numPages)
      setCurrentPage(currentPage + 1);
  }, [loadedDoc, currentPage, setCurrentPage, isNavigationLocked]);

  const handlePrevPage = useCallback(() => {
    if (isNavigationLocked) return;
    if (currentPage <= 1) return;
    if (isActive) {
      setShowBackModal(true);
      setConfirmText("");
      setConfirmError(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      setCurrentPage(currentPage - 1);
    }
  }, [currentPage, isActive, setCurrentPage, isNavigationLocked]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isScrolling = false;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const zoomStep = 0.1;
        if (e.deltaY < 0) {
          changeScale(Math.min(3, scale + zoomStep));
        } else {
          changeScale(Math.max(0.5, scale - zoomStep));
        }
        return;
      }

      e.preventDefault();
      if (isNavigationLocked) return;
      if (isActive) return;
      if (isScrolling) return;

      if (e.deltaY > 0) handleNextPage();
      else if (e.deltaY < 0) handlePrevPage();

      isScrolling = true;
      setTimeout(() => {
        isScrolling = false;
      }, 400);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [
    isActive,
    isNavigationLocked,
    handleNextPage,
    handlePrevPage,
    scale,
    changeScale,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showBackModal || showGoToPageModal) return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;
      if (isNavigationLocked) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        handleNextPage();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        handlePrevPage();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleNextPage,
    handlePrevPage,
    showBackModal,
    showGoToPageModal,
    isNavigationLocked,
  ]);

  const handleConfirmBack = () => {
    if (confirmText === REQUIRED_PHRASE) {
      setShowBackModal(false);
      setCurrentPage(currentPage - 1);
    } else {
      setConfirmError(true);
      setConfirmText("");
      inputRef.current?.focus();
    }
  };

  const handleIncrement = useCallback(() => {
    if (!loadedDoc) return;
    setGoToPageValue((prev) => {
      const current = parseInt(prev, 10) || currentPage;
      if (current < loadedDoc.doc.numPages) return (current + 1).toString();
      return prev;
    });
  }, [loadedDoc, currentPage]);

  const handleDecrement = useCallback(() => {
    setGoToPageValue((prev) => {
      const current = parseInt(prev, 10) || currentPage;
      if (current > 1) return (current - 1).toString();
      return prev;
    });
  }, [currentPage]);

  const startContinuousChange = (dir: "up" | "down") => {
    if (dir === "up") handleIncrement();
    else handleDecrement();

    holdTimeout.current = setTimeout(() => {
      holdInterval.current = setInterval(() => {
        if (dir === "up") handleIncrement();
        else handleDecrement();
      }, 80);
    }, 400);
  };

  const stopContinuousChange = useCallback(() => {
    if (holdTimeout.current) clearTimeout(holdTimeout.current);
    if (holdInterval.current) clearInterval(holdInterval.current);
    holdTimeout.current = null;
    holdInterval.current = null;
  }, []);

  useEffect(() => {
    if (!showGoToPageModal) stopContinuousChange();
    return () => stopContinuousChange();
  }, [showGoToPageModal, stopContinuousChange]);

  const handleGoToPage = () => {
    if (!loadedDoc || isNavigationLocked) return;
    const inputVal = goToPageInputRef.current?.value;
    let page = parseInt(inputVal || goToPageValue, 10);
    if (isNaN(page) || page < 1) page = 1;
    if (page > loadedDoc.doc.numPages) page = loadedDoc.doc.numPages;

    setCurrentPage(page);
    setShowGoToPageModal(false);
    stopContinuousChange();
  };

  useEffect(() => {
    if (showGoToPageModal) {
      setGoToPageValue(currentPage.toString());
      setTimeout(() => goToPageInputRef.current?.focus(), 150);
    }
  }, [showGoToPageModal, currentPage]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!fileData && !isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!fileData && onDropPdf) {
      const file = e.dataTransfer.files?.[0];
      if (file) onDropPdf(file);
    }
  };

  if (!fileData) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center text-center px-6 bg-[#09090b] relative overflow-hidden transition-all duration-300 ${isDragging ? "bg-[#38bdf8]/5" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[120px] pointer-events-none transition-all duration-500 ${isDragging ? "bg-[#38bdf8]/20 scale-110" : "bg-[#38bdf8]/5"}`}
        />
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#a855f7]/5 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#10b981]/5 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2 pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:64px_64px] opacity-[0.02] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in-95 duration-700 ease-out">
          <button
            onClick={onOpenPdf}
            className={`relative group mb-10 outline-none transition-all duration-500 ${isDragging ? "-translate-y-4 scale-110 pointer-events-none" : "cursor-pointer"}`}
            disabled={isDragging}
          >
            <div
              className={`absolute inset-0 blur-xl rounded-3xl transition-all duration-500 ${isDragging ? "bg-[#38bdf8]/40" : "bg-[#38bdf8]/0 group-hover:bg-[#38bdf8]/20"}`}
            />
            <div
              className={`w-24 h-24 rounded-3xl bg-[#121214] border shadow-[0_0_40px_rgba(0,0,0,0.5)] flex items-center justify-center relative z-10 transition-all duration-500 ${isDragging ? "border-[#38bdf8] bg-[#18181b]" : "border-white/10 group-hover:-translate-y-2 group-hover:border-[#38bdf8]/40 group-hover:bg-[#18181b]"}`}
            >
              {isDragging ? (
                <FileDown size={36} className="text-[#38bdf8] animate-bounce" />
              ) : (
                <Upload
                  size={36}
                  className="text-[#71717a] group-hover:text-[#38bdf8] transition-colors duration-300"
                />
              )}
            </div>
          </button>

          <div className="flex flex-col items-center max-w-md pointer-events-none">
            <Typography
              variant="pageTitle"
              as="h1"
              className={`text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/50 mb-3 tracking-tight text-3xl font-bold transition-all duration-500 ${isDragging ? "scale-105" : ""}`}
            >
              {isDragging ? "Drop your PDF here" : "Read, don't count."}
            </Typography>
            <Typography
              variant="body"
              as="p"
              className="text-[#a1a1aa] leading-relaxed text-sm transition-all duration-300"
            >
              {isDragging
                ? "Release to start your focus session."
                : "Open a PDF to begin your session. Drag & drop anywhere, or click the icon above."}
            </Typography>
          </div>
        </div>
      </div>
    );
  }

  const hasRenderError = errorKey !== null && errorKey === requestKey;

  return (
    <div
      ref={viewerRef}
      className="w-full h-full flex flex-col relative overflow-hidden transition-colors duration-500 ease-in-out"
      style={{ backgroundColor: canvasBg }}
    >
      <div className="absolute top-8 right-8 flex flex-col gap-4 z-50">
        {/* ✅ دکمه نوت اضافه شد */}
        {onOpenNote && (
          <button
            onClick={onOpenNote}
            className="bg-white/95 backdrop-blur-xl border border-zinc-200 p-2.5 rounded-2xl shadow-sm transition-all duration-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
            title="Page Notes (Ctrl+T)"
          >
            <Edit3 size={20} />
          </button>
        )}

        <div className="bg-white/95 backdrop-blur-xl border border-zinc-200 p-2 rounded-2xl flex flex-col gap-1.5 shadow-sm">
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-all duration-200"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <div className="h-px w-full bg-zinc-200 my-0.5" />
          <div className="relative w-full h-full flex items-center justify-center py-0.5">
            <input
              type="color"
              value={canvasBg}
              onChange={(e) => onCanvasBgChange(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer z-20"
              title="Canvas Background Color"
            />
            <button className="p-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-all duration-200">
              <Palette size={18} />
            </button>
          </div>
          <div className="h-px w-full bg-zinc-200 my-0.5" />

          <button
            onClick={() => changeScale(Math.min(3, scale + 0.2))}
            className="p-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-all duration-200"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={() => changeScale(Math.max(0.5, scale - 0.2))}
            className="p-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-all duration-200"
          >
            <ZoomOut size={18} />
          </button>
          <button
            onClick={() => changeScale(DEFAULT_SCALE)}
            className="p-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-all duration-200"
          >
            <RotateCcw size={18} />
          </button>
        </div>

        {loadedDoc && (
          <>
            <div className="bg-white/95 backdrop-blur-xl border border-zinc-200 p-2 rounded-2xl flex flex-col gap-1.5 shadow-sm items-center">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1 || isNavigationLocked}
                className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center ${currentPage === 1 || isNavigationLocked ? "text-zinc-300 cursor-not-allowed" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 active:scale-95"}`}
                title="Previous Page (Arrow Up)"
              >
                <ChevronUp size={20} />
              </button>
              <div className="h-px w-full bg-zinc-200 my-0.5" />
              <button
                onClick={handleNextPage}
                disabled={
                  currentPage === loadedDoc.doc.numPages || isNavigationLocked
                }
                className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center ${currentPage === loadedDoc.doc.numPages || isNavigationLocked ? "text-zinc-300 cursor-not-allowed" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 active:scale-95"}`}
                title="Next Page (Arrow Down)"
              >
                <ChevronDown size={20} />
              </button>
            </div>

            <button
              onClick={() => setShowGoToPageModal(true)}
              disabled={isNavigationLocked}
              className={`bg-white/95 backdrop-blur-xl border border-zinc-200 p-3 rounded-2xl shadow-sm transition-all duration-200 flex items-center justify-center ${isNavigationLocked ? "text-zinc-300 cursor-not-allowed" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"}`}
              title="Go to Page"
            >
              <Hash size={20} className="block" />
            </button>
          </>
        )}
      </div>

      <div
        ref={containerRef}
        className="flex-1 w-full h-full relative flex items-center justify-center overflow-hidden"
      >
        <div className="p-8">
          <div
            className="relative bg-white ring-1 ring-black/5"
            style={{
              width: displayed?.width ?? 0,
              height: displayed?.height ?? 0,
            }}
          >
            <canvas
              ref={canvasRef}
              className="block"
              style={{
                width: displayed?.width ?? 0,
                height: displayed?.height ?? 0,
              }}
            />
          </div>
        </div>

        {displayed && containerSize.width > 0 && (
          <div className="absolute inset-0 z-10">
            <PdfDrawingLayer
              filePath={filePath || ""}
              pageNumber={displayed.pageNumber}
              width={containerSize.width}
              height={containerSize.height}
              pdfWidth={displayed.width}
              pdfHeight={displayed.height}
              textLines={textLines}
            />
          </div>
        )}
      </div>

      {isLoading && (
        <div className="absolute inset-0 z-[999] flex flex-col items-center justify-center bg-[#121214]">
          {hasRenderError ? (
            <Typography
              variant="microLabel"
              className="text-rose-400 tracking-widest"
            >
              Failed to render page
            </Typography>
          ) : (
            <>
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-[4px] border-white/5 rounded-full"></div>
                <div className="absolute inset-0 border-[4px] border-t-[#38bdf8] rounded-full animate-spin shadow-[0_0_15px_rgba(56,189,248,0.5)]"></div>
              </div>
              <Typography
                variant="microLabel"
                className="text-[#38bdf8] mt-6 tracking-widest animate-pulse"
              >
                Rendering Page
              </Typography>
            </>
          )}
        </div>
      )}

      {showBackModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-md transition-all duration-300">
          <div className="bg-[#121214] border border-rose-500/30 p-8 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] w-full max-w-lg flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <ShieldAlert size={32} className="text-rose-500" />
            </div>
            <Typography
              variant="pageTitle"
              as="h2"
              className="text-[#fafafa] mb-2 font-semibold tracking-tight"
            >
              Break Your Focus?
            </Typography>
            <Typography
              variant="body"
              as="p"
              className="text-[#a1a1aa] mb-8 max-w-sm leading-relaxed"
            >
              Going back breaks your flow. If you absolutely must, type the
              following phrase in <strong>ALL CAPITAL LETTERS</strong>:
            </Typography>
            <div className="w-full bg-[#09090b] border border-[#27272a] rounded-2xl p-4 mb-6 flex items-center justify-center gap-3 select-none">
              <Lock size={16} className="text-[#52525b]" />
              <span className="text-[#fafafa] font-mono text-base font-bold tracking-widest">
                {REQUIRED_PHRASE}
              </span>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value);
                setConfirmError(false);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") handleConfirmBack();
              }}
              onPaste={(e) => e.preventDefault()}
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
              autoComplete="off"
              spellCheck="false"
              placeholder="TYPE HERE (UPPERCASE ONLY)"
              className={`w-full px-5 py-4 rounded-xl bg-[#18181b] border-2 outline-none transition-all text-center text-lg font-mono tracking-widest shadow-sm ${confirmError ? "border-rose-400 focus:border-rose-500 text-rose-600 placeholder-rose-300 animate-shake" : "border-[#27272a] focus:border-rose-500/50 text-[#fafafa]"}`}
            />
            {confirmError && (
              <Typography
                variant="caption"
                className="text-rose-500 mt-3 font-medium animate-pulse"
              >
                Incorrect. You must type it exactly as shown (ALL CAPS).
              </Typography>
            )}
            <div className="flex gap-4 w-full mt-8">
              <button
                onClick={() => setShowBackModal(false)}
                className="flex-1 px-4 py-3.5 rounded-xl bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] border border-[#27272a] transition-all font-medium active:scale-[0.98]"
              >
                Keep Focusing
              </button>
              <button
                onClick={handleConfirmBack}
                className="flex-1 px-4 py-3.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-all font-medium shadow-[0_0_15px_rgba(244,63,94,0.3)] active:scale-[0.98]"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      {showGoToPageModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-md transition-all duration-300">
          <div className="bg-[#121214] border border-[#38bdf8]/30 p-8 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] w-full max-w-sm flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-[#38bdf8]/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <Hash size={32} className="text-[#38bdf8]" />
            </div>
            <Typography
              variant="pageTitle"
              as="h2"
              className="text-[#fafafa] mb-2 font-semibold tracking-tight"
            >
              Go to Page
            </Typography>
            <Typography
              variant="body"
              as="p"
              className="text-[#a1a1aa] mb-8 leading-relaxed"
            >
              Enter the page number you want to jump to.
            </Typography>
            <div className="w-full flex items-center bg-[#18181b] border-2 border-[#27272a] focus-within:border-[#38bdf8]/50 rounded-xl transition-all shadow-sm overflow-hidden mb-8">
              <input
                ref={goToPageInputRef}
                type="number"
                value={goToPageValue}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setGoToPageValue("");
                    return;
                  }
                  let num = parseInt(val, 10);
                  if (isNaN(num)) {
                    setGoToPageValue("");
                    return;
                  }
                  if (num < 1) num = 1;
                  if (loadedDoc && num > loadedDoc.doc.numPages) {
                    num = loadedDoc.doc.numPages;
                  }
                  setGoToPageValue(num.toString());
                }}
                onBlur={() => {
                  if (goToPageValue === "")
                    setGoToPageValue(currentPage.toString());
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") handleGoToPage();
                  if (e.key === "Escape") setShowGoToPageModal(false);
                }}
                autoFocus
                className="flex-1 w-full px-5 py-4 bg-transparent outline-none text-center text-xl font-mono tracking-widest text-[#fafafa] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="flex flex-col h-full border-l border-[#27272a] shrink-0 bg-black/10">
                <button
                  onMouseDown={() => startContinuousChange("up")}
                  onMouseUp={stopContinuousChange}
                  onMouseLeave={stopContinuousChange}
                  onTouchStart={() => startContinuousChange("up")}
                  onTouchEnd={stopContinuousChange}
                  className="flex-1 px-3.5 hover:bg-white/5 text-[#a1a1aa] hover:text-white transition-colors flex items-center justify-center border-b border-[#27272a] active:bg-white/10"
                  tabIndex={-1}
                >
                  <ChevronUp size={18} />
                </button>
                <button
                  onMouseDown={() => startContinuousChange("down")}
                  onMouseUp={stopContinuousChange}
                  onMouseLeave={stopContinuousChange}
                  onTouchStart={() => startContinuousChange("down")}
                  onTouchEnd={stopContinuousChange}
                  className="flex-1 px-3.5 hover:bg-white/5 text-[#a1a1aa] hover:text-white transition-colors flex items-center justify-center active:bg-white/10"
                  tabIndex={-1}
                >
                  <ChevronDown size={18} />
                </button>
              </div>
            </div>
            <div className="flex gap-4 w-full">
              <button
                onClick={() => setShowGoToPageModal(false)}
                className="flex-1 px-4 py-3.5 rounded-xl bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] border border-[#27272a] transition-all font-medium active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={handleGoToPage}
                disabled={isNavigationLocked}
                className={`flex-1 px-4 py-3.5 rounded-xl transition-all font-medium active:scale-[0.98] ${isNavigationLocked ? "bg-[#38bdf8]/50 text-black/50 cursor-not-allowed shadow-none" : "bg-[#38bdf8] text-black hover:bg-[#38bdf8]/90 shadow-[0_0_15px_rgba(56,189,248,0.3)]"}`}
              >
                Go
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
