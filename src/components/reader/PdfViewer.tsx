"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
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
} from "lucide-react";
import Typography from "@/typography";
import PdfDrawingLayer from "./PdfDrawingLayer";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const REQUIRED_PHRASE = "I AM BREAKING MY FOCUS";

export default function PdfViewer({
  fileData,
}: {
  fileData: Uint8Array | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isActive, currentPage, setCurrentPage } = useSession();
  const { canvasBg, setCanvasBg } = useTool();

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState(1.6); // زوم اولیه به 1.6 تغییر کرد
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const [showBackModal, setShowBackModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [confirmError, setConfirmError] = useState(false);

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
      for (let entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!fileData) {
      setPdfDoc(null);
      return;
    }
    const loadPdf = async () => {
      try {
        const safeData = new Uint8Array(fileData);
        const loadingTask = pdfjsLib.getDocument({ data: safeData });
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        if (currentPage > doc.numPages) setCurrentPage(1);
      } catch (error) {
        console.error("Failed to load PDF:", error);
      }
    };
    loadPdf();
  }, [fileData]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let isCancelled = false;

    const renderPage = async () => {
      setIsLoading(true);

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        try {
          await renderTaskRef.current.promise;
        } catch (e) {}
        renderTaskRef.current = null;
      }

      if (isCancelled) return;

      try {
        const page = await pdfDoc.getPage(currentPage);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d", { alpha: false });

        if (canvas && context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;

          setPageSize({ width: viewport.width, height: viewport.height });

          const renderContext = { canvasContext: context, viewport };
          renderTaskRef.current = page.render(renderContext);
          await renderTaskRef.current.promise;
        }
      } catch (error: any) {
        if (error?.name !== "RenderingCancelledException") {
          console.error("Render error:", error);
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) renderTaskRef.current.cancel();
    };
  }, [pdfDoc, currentPage, scale]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  const handleNextPage = useCallback(() => {
    if (pdfDoc && currentPage < pdfDoc.numPages) {
      setCurrentPage(currentPage + 1);
    }
  }, [pdfDoc, currentPage, setCurrentPage]);

  const handlePrevPage = useCallback(() => {
    if (currentPage <= 1) return;

    if (isActive) {
      setShowBackModal(true);
      setConfirmText("");
      setConfirmError(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setCurrentPage(currentPage - 1);
    }
  }, [currentPage, isActive, setCurrentPage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showBackModal) return;
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
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNextPage, handlePrevPage, showBackModal]);

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

  if (!fileData) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center px-6 bg-[#09090b] relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#38bdf8]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="w-24 h-24 rounded-3xl bg-[#121214] border border-white/5 shadow-2xl flex items-center justify-center mb-8 relative group">
          <div className="absolute inset-0 bg-[#38bdf8]/10 blur-md rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <Upload
            size={36}
            className="text-[#52525b] group-hover:text-[#38bdf8] transition-colors relative z-10"
          />
        </div>
        <Typography
          variant="pageTitle"
          as="h1"
          className="text-transparent bg-clip-text bg-gradient-to-br from-white to-white/50 mb-4 tracking-tight"
        >
          Read, don't count.
        </Typography>
        <Typography variant="body" as="p" className="text-[#a1a1aa] max-w-md">
          Open a PDF to begin your session. No page numbers. No pressure. Just
          you and the text.
        </Typography>
      </div>
    );
  }

  return (
    <div
      ref={viewerRef}
      className="w-full h-full flex flex-col relative overflow-hidden transition-colors duration-500 ease-in-out"
      style={{ backgroundColor: canvasBg }}
    >
      <div className="absolute top-8 right-8 flex flex-col gap-4 z-50">
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
              onChange={(e) => setCanvasBg(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer z-20"
              title="Canvas Background Color"
            />
            <button className="p-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-all duration-200">
              <Palette size={18} />
            </button>
          </div>
          <div className="h-px w-full bg-zinc-200 my-0.5" />

          <button
            onClick={() => setScale((prev) => Math.min(3, prev + 0.2))}
            className="p-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-all duration-200"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={() => setScale((prev) => Math.max(0.5, prev - 0.2))}
            className="p-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-all duration-200"
          >
            <ZoomOut size={18} />
          </button>
          <button
            onClick={() => setScale(1.6)} // ریست به زوم 1.6
            className="p-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-all duration-200"
          >
            <RotateCcw size={18} />
          </button>
        </div>

        {pdfDoc && (
          <div className="bg-white/95 backdrop-blur-xl border border-zinc-200 p-2 rounded-2xl flex flex-col gap-1.5 shadow-sm items-center">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className={`p-2.5 rounded-xl transition-all duration-200 ${
                currentPage === 1
                  ? "text-zinc-300 cursor-not-allowed"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 active:scale-95"
              }`}
              title="Previous Page (Arrow Up)"
            >
              <ChevronUp size={20} />
            </button>
            <div className="h-px w-full bg-zinc-200 my-0.5" />
            <button
              onClick={handleNextPage}
              disabled={currentPage === pdfDoc.numPages}
              className={`p-2.5 rounded-xl transition-all duration-200 ${
                currentPage === pdfDoc.numPages
                  ? "text-zinc-300 cursor-not-allowed"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 active:scale-95"
              }`}
              title="Next Page (Arrow Down)"
            >
              <ChevronDown size={20} />
            </button>
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className="flex-1 w-full h-full relative flex items-center justify-center overflow-hidden p-8"
      >
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 backdrop-blur-sm z-40 transition-opacity duration-300">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 border-[3px] border-zinc-200 rounded-full"></div>
              <div className="absolute inset-0 border-[3px] border-t-zinc-500 rounded-full animate-spin"></div>
            </div>
          </div>
        )}

        <div
          className="relative bg-white border border-black/5"
          style={{ width: pageSize.width, height: pageSize.height }}
        >
          <canvas ref={canvasRef} className="block" />
        </div>

        {containerSize.width > 0 && pageSize.width > 0 && (
          <PdfDrawingLayer
            pageNumber={currentPage}
            width={containerSize.width}
            height={containerSize.height}
            pdfWidth={pageSize.width}
            pdfHeight={pageSize.height}
          />
        )}
      </div>

      {showBackModal && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-md transition-all duration-300">
          <div className="bg-white/95 backdrop-blur-3xl p-8 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] border border-white/60 w-full max-w-lg flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <ShieldAlert size={32} className="text-rose-500" />
            </div>

            <Typography
              variant="pageTitle"
              as="h2"
              className="text-zinc-900 mb-2 font-semibold tracking-tight"
            >
              Break Your Focus?
            </Typography>

            <Typography
              variant="body"
              as="p"
              className="text-zinc-500 mb-8 max-w-sm leading-relaxed"
            >
              Going back breaks your flow. If you absolutely must, type the
              following phrase in <strong>ALL CAPITAL LETTERS</strong>:
            </Typography>

            <div className="w-full bg-zinc-100/80 border border-zinc-200 rounded-2xl p-4 mb-6 flex items-center justify-center gap-3 select-none">
              <Lock size={16} className="text-zinc-400" />
              <span className="text-zinc-800 font-mono text-base font-bold tracking-widest">
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
              onKeyDown={(e) => e.key === "Enter" && handleConfirmBack()}
              onPaste={(e) => e.preventDefault()}
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
              autoComplete="off"
              spellCheck="false"
              placeholder="TYPE HERE (UPPERCASE ONLY)"
              className={`w-full px-5 py-4 rounded-xl bg-white border-2 outline-none transition-all text-center text-lg font-mono tracking-widest shadow-sm ${
                confirmError
                  ? "border-rose-400 focus:border-rose-500 text-rose-600 placeholder-rose-300 animate-shake"
                  : "border-zinc-200 focus:border-zinc-800 text-zinc-900 uppercase"
              }`}
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
                className="flex-1 px-4 py-3.5 rounded-xl bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 transition-all font-medium active:scale-[0.98]"
              >
                Keep Focusing
              </button>
              <button
                onClick={handleConfirmBack}
                className="flex-1 px-4 py-3.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 transition-all font-medium shadow-md active:scale-[0.98]"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
