"use client";

import React, { useEffect, useRef, useState, memo } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { useSession } from "@/providers/SessionProvider";
import {
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize,
  Minimize,
  LayoutTemplate,
  Rows,
} from "lucide-react";
import Typography from "@/typography";
import PdfDrawingLayer from "./PdfDrawingLayer";

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

// =========================================================
// Lazy Rendered Pdf Page with Skeleton Loading
// =========================================================
const PdfPage = memo(
  ({
    pdfDoc,
    pageNumber,
    scale,
    viewMode,
  }: {
    pdfDoc: pdfjsLib.PDFDocumentProxy;
    pageNumber: number;
    scale: number;
    viewMode: "continuous" | "single";
  }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [isVisible, setIsVisible] = useState(false);
    const [hasRendered, setHasRendered] = useState(false);

    // Intersection Observer for Lazy Rendering
    useEffect(() => {
      if (!containerRef.current) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setIsVisible(true);
        },
        { rootMargin: "400px 0px" },
      );
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      if (!isVisible && hasRendered) return;
      let isCancelled = false;

      const renderPage = async () => {
        try {
          // Force loading state to true when scale or page changes
          setHasRendered(false);

          const page = await pdfDoc.getPage(pageNumber);
          if (isCancelled) return;
          const viewport = page.getViewport({ scale });
          setSize({ width: viewport.width, height: viewport.height });

          const canvas = canvasRef.current;
          const context = canvas?.getContext("2d", { alpha: false });
          if (canvas && context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport }).promise;

            if (!isCancelled) setHasRendered(true);
          }
        } catch (error) {}
      };

      if (isVisible || !hasRendered) renderPage();
      return () => {
        isCancelled = true;
      };
    }, [pdfDoc, pageNumber, scale, isVisible, hasRendered]);

    const wrapperClass =
      viewMode === "single"
        ? "w-full h-full flex flex-col items-center justify-center p-4"
        : "mb-12";

    return (
      <div
        ref={containerRef}
        className={`shrink-0 flex justify-center transition-all duration-300 ${wrapperClass}`}
        data-page={pageNumber.toString()}
      >
        <div
          className="relative shadow-2xl rounded-sm overflow-hidden bg-white"
          style={{
            width: size.width || 700,
            height: size.height || 990,
            minWidth: 700,
          }}
        >
          {/* Always render the canvas, but cover it with loading skeleton when needed */}
          <canvas ref={canvasRef} className="block w-full h-full" />

          {/* Skeleton Loading Overlay */}
          {!hasRendered && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white">
              <div className="w-8 h-8 border-[3px] border-zinc-200 border-t-zinc-500 rounded-full animate-spin"></div>
              <Typography variant="microLabel" className="mt-4 text-zinc-400">
                Rendering...
              </Typography>
            </div>
          )}

          {/* Drawing Layer (Only render when page size is known) */}
          {size.width > 0 && (
            <PdfDrawingLayer
              pageNumber={pageNumber}
              width={size.width}
              height={size.height}
            />
          )}
        </div>
      </div>
    );
  },
);
PdfPage.displayName = "PdfPage";

// =========================================================
// PdfViewer Component
// =========================================================
export default function PdfViewer({
  fileData,
}: {
  fileData: Uint8Array | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const { setCurrentPage } = useSession();

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState(1.5);
  const [viewMode, setViewMode] = useState<"continuous" | "single">(
    "continuous",
  );
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    if (!fileData) {
      setPdfDoc(null);
      return;
    }
    const loadPdf = async () => {
      try {
        const safeData = new Uint8Array(fileData);
        const loadingTask = pdfjsLib.getDocument({ data: safeData });
        setPdfDoc(await loadingTask.promise);
      } catch (error) {
        console.error("Failed to load PDF:", error);
      }
    };
    loadPdf();
  }, [fileData]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const pages = container.querySelectorAll("[data-page]");
      let currentVisiblePage = 1;
      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.top + containerRect.height / 2;
      pages.forEach((page) => {
        const rect = page.getBoundingClientRect();
        if (rect.top <= containerCenter && rect.bottom >= containerCenter) {
          currentVisiblePage = parseInt(
            page.getAttribute("data-page") || "1",
            10,
          );
        }
      });
      setCurrentPage(currentVisiblePage);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    setTimeout(handleScroll, 100);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [setCurrentPage, pdfDoc, viewMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || viewMode !== "single") return;
    let isScrolling = false;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (isScrolling) return;
      const direction = e.deltaY > 0 ? 1 : -1;
      const pages = Array.from(
        container.querySelectorAll("[data-page]"),
      ) as HTMLElement[];
      if (pages.length === 0) return;
      isScrolling = true;
      let currentIndex = 0,
        minDistance = Infinity;
      pages.forEach((page, index) => {
        const distance = Math.abs(page.offsetTop - container.scrollTop);
        if (distance < minDistance) {
          minDistance = distance;
          currentIndex = index;
        }
      });
      const targetIndex = Math.max(
        0,
        Math.min(pages.length - 1, currentIndex + direction),
      );
      container.scrollTo({
        top: pages[targetIndex].offsetTop,
        behavior: "auto",
      });
      setTimeout(() => {
        isScrolling = false;
      }, 100);
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [viewMode, pdfDoc]);

  if (!fileData) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center px-6 bg-[#18181b]">
        <div className="w-20 h-20 rounded-2xl bg-[#121214] border border-[#27272a] flex items-center justify-center mb-6">
          <Upload size={32} className="text-[#52525b]" />
        </div>
        <Typography variant="pageTitle" as="h1" className="text-[#fafafa] mb-3">
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
      className="w-full h-full flex flex-col bg-[#18181b] relative overflow-hidden"
    >
      <div
        ref={containerRef}
        className={`flex-1 overflow-auto flex flex-col items-center ${viewMode === "single" ? "overflow-hidden" : "p-8 scroll-smooth"}`}
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          scrollBehavior: "auto",
        }}
      >
        {!pdfDoc && (
          <div className="mt-20 flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-[#27272a] border-t-emerald-500 rounded-full animate-spin"></div>
            <Typography variant="microLabel" className="text-[#52525b] mt-4">
              Loading PDF...
            </Typography>
          </div>
        )}

        {pdfDoc &&
          Array.from({ length: pdfDoc.numPages }, (_, i) => (
            <PdfPage
              key={i + 1}
              pdfDoc={pdfDoc}
              pageNumber={i + 1}
              scale={scale}
              viewMode={viewMode}
            />
          ))}
      </div>

      <div className="absolute top-6 right-6 flex flex-col gap-2 z-50">
        <button
          onClick={toggleFullscreen}
          className="p-2 bg-[#18181b]/80 backdrop-blur-md border border-[#27272a] rounded-md text-[#a1a1aa] hover:text-[#fafafa] transition-colors shadow-lg"
        >
          {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
        <button
          onClick={() =>
            setViewMode((prev) =>
              prev === "continuous" ? "single" : "continuous",
            )
          }
          className="p-2 bg-[#18181b]/80 backdrop-blur-md border border-[#27272a] rounded-md text-[#a1a1aa] hover:text-[#fafafa] transition-colors shadow-lg"
        >
          {viewMode === "continuous" ? (
            <LayoutTemplate size={16} />
          ) : (
            <Rows size={16} />
          )}
        </button>
        <div className="h-px w-full bg-[#27272a] my-1" />
        <button
          onClick={() => setScale((prev) => Math.min(3, prev + 0.2))}
          className="p-2 bg-[#18181b]/80 backdrop-blur-md border border-[#27272a] rounded-md text-[#a1a1aa] hover:text-[#fafafa] transition-colors shadow-lg"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={() => setScale((prev) => Math.max(0.8, prev - 0.2))}
          className="p-2 bg-[#18181b]/80 backdrop-blur-md border border-[#27272a] rounded-md text-[#a1a1aa] hover:text-[#fafafa] transition-colors shadow-lg"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={() => setScale(1.5)}
          className="p-2 bg-[#18181b]/80 backdrop-blur-md border border-[#27272a] rounded-md text-[#a1a1aa] hover:text-[#fafafa] transition-colors shadow-lg"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
}
