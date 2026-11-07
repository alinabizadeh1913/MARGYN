"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import PdfDrawingLayer from "./PdfDrawingLayer";
import {
  Plus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Trash2,
  Type,
  Maximize,
  Minimize,
  Palette,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useSession } from "@/providers/SessionProvider";
import ColorPicker from "./ColorPicker";

interface BlankPageViewerProps {
  filePath: string;
  initialPages?: number;
  canvasBg?: string;
  onCanvasBgChange: (color: string) => void;
  initialScale?: number;
  onScaleChange?: (scale: number) => void;
  onPageAdded: (newTotal: number) => void;
  onDeletePage: (pageNumber: number) => void;
  onOpenNote?: () => void;
}

const PAGE_WIDTH = 800;
const PAGE_HEIGHT = 1131;

export default function BlankPageViewer({
  filePath,
  initialPages = 1,
  canvasBg = "#ffffff",
  onCanvasBgChange,
  initialScale = 1,
  onScaleChange,
  onPageAdded,
  onDeletePage,
  onOpenNote,
}: BlankPageViewerProps) {
  const { currentPage, setCurrentPage } = useSession();
  const [scale, setScale] = useState(initialScale);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

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
    setScale(initialScale);
  }, [initialScale]);

  const changeScale = useCallback(
    (newScale: number) => {
      setScale(newScale);
      if (onScaleChange) onScaleChange(newScale);
    },
    [onScaleChange],
  );

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
    if (currentPage > initialPages) {
      setCurrentPage(initialPages);
    }
  }, [initialPages, currentPage, setCurrentPage]);

  const handleAddPage = () => {
    const newTotal = initialPages + 1;
    onPageAdded(newTotal);
    setCurrentPage(newTotal);
  };

  const handleNextPage = useCallback(() => {
    if (currentPage < initialPages) setCurrentPage(currentPage + 1);
  }, [currentPage, initialPages, setCurrentPage]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  }, [currentPage, setCurrentPage]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isScrolling = false;

    const handleWheel = (e: WheelEvent) => {
      // ✅ اضافه شد: بررسی Ctrl + Scroll برای زوم
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
      if (isScrolling) return;

      if (e.deltaY > 0) {
        handleNextPage();
      } else if (e.deltaY < 0) {
        handlePrevPage();
      }

      isScrolling = true;
      setTimeout(() => {
        isScrolling = false;
      }, 400);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        handleNextPage();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        handlePrevPage();
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleNextPage, handlePrevPage, scale, changeScale]); // ✅ scale و changeScale به وابستگی‌ها اضافه شدند

  const pageW = PAGE_WIDTH * scale;
  const pageH = PAGE_HEIGHT * scale;

  return (
    <div
      ref={viewerRef}
      className="w-full h-full relative flex flex-col overflow-hidden transition-colors duration-500 ease-in-out"
      style={{ backgroundColor: canvasBg }}
    >
      <div className="absolute top-8 right-8 flex flex-col gap-4 z-50">
        <div className="bg-black/20 backdrop-blur-xl border border-white/20 p-2 rounded-2xl flex flex-col gap-1.5 shadow-xl transition-all duration-300 hover:bg-white hover:border-zinc-300 group/panel">
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl text-white/70 group-hover/panel:text-zinc-800 hover:bg-zinc-100 transition-all duration-200"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <div className="h-px w-full bg-white/20 group-hover/panel:bg-zinc-200 my-0.5 transition-colors" />
          <ColorPicker
            color={canvasBg || "#ffffff"}
            onChange={onCanvasBgChange}
            trigger={
              <div className="p-2.5 rounded-xl text-white/70 group-hover/panel:text-zinc-800 hover:bg-zinc-100 transition-all duration-200 flex items-center justify-center">
                <Palette size={18} />
              </div>
            }
          />
          <div className="h-px w-full bg-white/20 group-hover/panel:bg-zinc-200 my-0.5 transition-colors" />
          <button
            onClick={() => changeScale(Math.min(3, scale + 0.2))}
            className="p-2.5 rounded-xl text-white/70 group-hover/panel:text-zinc-800 hover:bg-zinc-100 transition-all duration-200"
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={() => changeScale(Math.max(0.5, scale - 0.2))}
            className="p-2.5 rounded-xl text-white/70 group-hover/panel:text-zinc-800 hover:bg-zinc-100 transition-all duration-200"
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>
          <button
            onClick={() => changeScale(1)}
            className="p-2.5 rounded-xl text-white/70 group-hover/panel:text-zinc-800 hover:bg-zinc-100 transition-all duration-200"
            title="Reset Zoom"
          >
            <RotateCcw size={18} />
          </button>
        </div>

        <div className="bg-black/20 backdrop-blur-xl border border-white/20 p-2 rounded-2xl flex flex-col gap-1.5 shadow-xl items-center transition-all duration-300 hover:bg-white hover:border-zinc-300 group/panel">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center 
              ${
                currentPage === 1
                  ? "text-white/30 group-hover/panel:text-zinc-400 cursor-not-allowed"
                  : "text-white/70 group-hover/panel:text-zinc-800 hover:bg-zinc-100 active:scale-95"
              }`}
          >
            <ChevronUp size={20} />
          </button>
          <div className="h-px w-full bg-white/20 group-hover/panel:bg-zinc-200 my-0.5 transition-colors" />
          <button
            onClick={handleNextPage}
            disabled={currentPage === initialPages}
            className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center 
              ${
                currentPage === initialPages
                  ? "text-white/30 group-hover/panel:text-zinc-400 cursor-not-allowed"
                  : "text-white/70 group-hover/panel:text-zinc-800 hover:bg-zinc-100 active:scale-95"
              }`}
          >
            <ChevronDown size={20} />
          </button>
        </div>

        {initialPages > 1 && (
          <button
            onClick={() => onDeletePage(currentPage)}
            className="bg-black/20 backdrop-blur-xl border border-white/20 p-3 rounded-2xl shadow-xl transition-all duration-300 text-white/70 hover:text-rose-500 hover:bg-white hover:border-rose-200 flex items-center justify-center"
            title="Delete This Page"
          >
            <Trash2 size={20} />
          </button>
        )}

        {onOpenNote && (
          <button
            onClick={onOpenNote}
            className="bg-black/20 backdrop-blur-xl border border-white/20 p-3 rounded-2xl shadow-xl transition-all duration-300 text-white/70 hover:text-zinc-900 hover:bg-white hover:border-zinc-200 flex items-center justify-center"
            title="Page Notes (Ctrl+T)"
          >
            <Type size={20} />
          </button>
        )}
      </div>

      <div
        ref={containerRef}
        className="flex-1 w-full h-full relative flex items-center justify-center overflow-hidden"
      >
        <div className="p-8 z-0">
          <div
            className="relative shadow-2xl ring-1 ring-zinc-400 border border-zinc-300/50"
            style={{
              width: pageW,
              height: pageH,
              backgroundColor: canvasBg,
            }}
          >
            <div className="absolute top-4 left-4 text-zinc-400 font-mono text-sm select-none opacity-50 z-20 pointer-events-none tabular-nums">
              {currentPage} / {initialPages}
            </div>
          </div>
        </div>

        {containerSize.width > 0 && (
          <div className="absolute inset-0 z-10">
            <PdfDrawingLayer
              filePath={filePath}
              pageNumber={currentPage}
              width={containerSize.width}
              height={containerSize.height}
              pdfWidth={pageW}
              pdfHeight={pageH}
              textLines={[]}
              onDeletePage={
                initialPages > 1 ? () => onDeletePage(currentPage) : undefined
              }
            />
          </div>
        )}
      </div>

      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50">
        <button
          onClick={handleAddPage}
          title="Add New Page"
          className="flex items-center justify-center w-14 h-14 rounded-full bg-[#121214]/90 backdrop-blur-md border border-[#27272a] text-[#a1a1aa] hover:text-white hover:bg-[#18181b] hover:border-[#38bdf8]/50 transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.5)] group active:scale-95"
        >
          <Plus
            size={24}
            className="group-hover:text-[#38bdf8] group-hover:scale-110 transition-all duration-300"
          />
        </button>
      </div>
    </div>
  );
}
