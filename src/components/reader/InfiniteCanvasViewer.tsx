"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import PdfDrawingLayer from "./PdfDrawingLayer";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize,
  Minimize,
  Palette,
  Hand,
} from "lucide-react";
import { useTool } from "@/providers/ToolProvider";
import ColorPicker from "./ColorPicker";

const WORLD_SIZE = 2500;
const DEFAULT_ZOOM = 1;

interface InfiniteCanvasViewerProps {
  filePath: string;
  canvasBg?: string;
  onCanvasBgChange: (color: string) => void;
  initialScale?: number;
  onScaleChange?: (scale: number) => void;
}

export default function InfiniteCanvasViewer({
  filePath,
  canvasBg = "#ffffff",
  onCanvasBgChange,
  initialScale = DEFAULT_ZOOM,
  onScaleChange,
}: InfiniteCanvasViewerProps) {
  const { tool } = useTool();
  const [scale, setScale] = useState(initialScale);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const viewerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const panStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    pointerId: number;
  } | null>(null);

  // اندازه‌ی container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      setContainerSize((prev) =>
        prev.width === w && prev.height === h ? prev : { width: w, height: h },
      );
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // سنتر اولیه
  useEffect(() => {
    if (initializedRef.current) return;
    if (containerSize.width <= 0 || containerSize.height <= 0) return;
    initializedRef.current = true;
    setPanX((containerSize.width - WORLD_SIZE * scale) / 2);
    setPanY((containerSize.height - WORLD_SIZE * scale) / 2);
  }, [containerSize, scale]);

  // زوم با نگه‌داشتن مرکز viewport
  const changeScale = useCallback(
    (newScale: number) => {
      const clamped = Math.max(0.2, Math.min(4, newScale));
      if (clamped === scale) return;
      const cx = containerSize.width / 2;
      const cy = containerSize.height / 2;
      const worldX = (cx - panX) / scale;
      const worldY = (cy - panY) / scale;
      setScale(clamped);
      setPanX(cx - worldX * clamped);
      setPanY(cy - worldY * clamped);
      if (onScaleChange) onScaleChange(clamped);
    },
    [scale, panX, panY, containerSize, onScaleChange],
  );

  // چرخ ماوس
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const step = 0.1;
        if (e.deltaY < 0) changeScale(scale + step);
        else changeScale(scale - step);
      } else if (tool === "pan") {
        e.preventDefault();
        setPanX((p) => p - e.deltaX);
        setPanY((p) => p - e.deltaY);
      }
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [changeScale, scale, tool]);

  // Pan overlay handlers
  const handlePanDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    panStateRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: panX,
      startPanY: panY,
      pointerId: e.pointerId,
    };
    setIsPanning(true);
  };

  const handlePanMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const ps = panStateRef.current;
    if (!ps?.active || ps.pointerId !== e.pointerId) return;
    setPanX(ps.startPanX + (e.clientX - ps.startX));
    setPanY(ps.startPanY + (e.clientY - ps.startY));
  };

  const handlePanUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const ps = panStateRef.current;
    if (!ps || ps.pointerId !== e.pointerId) return;
    ps.active = false;
    setIsPanning(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement)
      viewerRef.current?.requestFullscreen().catch(console.error);
    else document.exitFullscreen();
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const worldStyle: React.CSSProperties = {
    width: WORLD_SIZE,
    height: WORLD_SIZE,
    transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
    transformOrigin: "0 0",
    backgroundColor: canvasBg,
    boxShadow: "0 0 80px rgba(0,0,0,0.35)",
    position: "absolute",
    left: 0,
    top: 0,
  };

  return (
    <div
      ref={viewerRef}
      className="w-full h-full relative flex flex-col overflow-hidden"
      style={{ backgroundColor: canvasBg }}
    >
      {/* کنترل‌های شناور */}
      <div className="absolute top-8 right-8 flex flex-col gap-4 z-50">
        <div className="bg-black/20 backdrop-blur-xl border border-white/20 p-2 rounded-2xl flex flex-col gap-1.5 shadow-xl transition-all duration-300 hover:bg-white hover:border-zinc-300 group/panel">
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl text-white/70 group-hover/panel:text-zinc-800 hover:bg-zinc-100 transition-all"
            title="Fullscreen"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <div className="h-px w-full bg-white/20 group-hover/panel:bg-zinc-200 my-0.5" />
          <ColorPicker
            color={canvasBg || "#ffffff"}
            onChange={onCanvasBgChange}
            trigger={
              <div className="p-2.5 rounded-xl text-white/70 group-hover/panel:text-zinc-800 hover:bg-zinc-100 transition-all flex items-center justify-center">
                <Palette size={18} />
              </div>
            }
          />
          <div className="h-px w-full bg-white/20 group-hover/panel:bg-zinc-200 my-0.5" />
          <button
            onClick={() => changeScale(scale + 0.2)}
            className="p-2.5 rounded-xl text-white/70 group-hover/panel:text-zinc-800 hover:bg-zinc-100 transition-all"
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={() => changeScale(scale - 0.2)}
            className="p-2.5 rounded-xl text-white/70 group-hover/panel:text-zinc-800 hover:bg-zinc-100 transition-all"
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>
          <button
            onClick={() => {
              const cx = containerSize.width / 2;
              const cy = containerSize.height / 2;
              const worldX = (cx - panX) / scale;
              const worldY = (cy - panY) / scale;
              setScale(DEFAULT_ZOOM);
              setPanX(cx - worldX * DEFAULT_ZOOM);
              setPanY(cy - worldY * DEFAULT_ZOOM);
              if (onScaleChange) onScaleChange(DEFAULT_ZOOM);
            }}
            className="p-2.5 rounded-xl text-white/70 group-hover/panel:text-zinc-800 hover:bg-zinc-100 transition-all"
            title="Reset Zoom"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* راهنمای pan */}
      {tool === "pan" && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-full border border-white/20 text-white/90 text-xs font-medium flex items-center gap-2 pointer-events-none">
          <Hand size={14} />
          Drag to pan · Scroll to pan · Ctrl+Scroll to zoom
        </div>
      )}

      {/* Container اصلی */}
      <div
        ref={containerRef}
        className="flex-1 w-full h-full relative overflow-hidden"
      >
        <div style={worldStyle}>
          {containerSize.width > 0 && (
            <PdfDrawingLayer
              filePath={filePath}
              pageNumber={1}
              width={WORLD_SIZE}
              height={WORLD_SIZE}
              pdfWidth={WORLD_SIZE}
              pdfHeight={WORLD_SIZE}
              textLines={[]}
            />
          )}
        </div>

        {tool === "pan" && (
          <div
            className="absolute inset-0 z-30"
            style={{
              cursor: isPanning ? "grabbing" : "grab",
              touchAction: "none",
            }}
            onPointerDown={handlePanDown}
            onPointerMove={handlePanMove}
            onPointerUp={handlePanUp}
            onPointerCancel={handlePanUp}
          />
        )}
      </div>
    </div>
  );
}
