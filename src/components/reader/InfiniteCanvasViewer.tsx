"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
} from "react";
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

const DEFAULT_ZOOM = 1;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

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
  const { tool, setTool } = useTool();

  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [scale, setScale] = useState(initialScale);

  // استیت‌های مربوط به درگ کردن صفحه
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);

  // ✅ استیت جدید برای تشخیص پن با غلطک ماوس
  const [isMiddlePanning, setIsMiddlePanning] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const viewerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const initializedRef = useRef(false);

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

  useEffect(() => {
    setScale(initialScale);
  }, [initialScale]);

  useLayoutEffect(() => {
    if (initializedRef.current) return;
    if (containerSize.width <= 0 || containerSize.height <= 0) return;
    initializedRef.current = true;
    setPanX(containerSize.width / 2);
    setPanY(containerSize.height / 2);
  }, [containerSize]);

  const toStored = useCallback(
    (x: number, y: number): [number, number] => [
      (x - panX) / scale,
      (y - panY) / scale,
    ],
    [panX, panY, scale],
  );

  const toScreen = useCallback(
    (x: number, y: number): [number, number] => [
      x * scale + panX,
      y * scale + panY,
    ],
    [panX, panY, scale],
  );

  const invalidateKey = `${panX}:${panY}:${scale}`;

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale + delta));
        if (newScale === scale) return;

        const wx = (mx - panX) / scale;
        const wy = (my - panY) / scale;
        setScale(newScale);
        setPanX(mx - wx * newScale);
        setPanY(my - wy * newScale);
        if (onScaleChange) onScaleChange(newScale);
      } else if (tool === "pan") {
        e.preventDefault();
        setPanX((p) => p - e.deltaX);
        setPanY((p) => p - e.deltaY);
      }
    },
    [scale, panX, panY, tool, onScaleChange],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // ✅ هندلرهای مربوط به غلطک ماوس (Middle Mouse Button)
  const handleContainerPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    // دکمه وسط ماوس (غلطک)
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation(); // جلوگیری از رسیدن به لایه رسم
      setIsMiddlePanning(true);
      setIsPanning(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      panStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleContainerPointerMove = (
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (isMiddlePanning && panStartRef.current) {
      setDragX(e.clientX - panStartRef.current.x);
      setDragY(e.clientY - panStartRef.current.y);
    }
  };

  const handleContainerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 1 && isMiddlePanning) {
      const dx = e.clientX - (panStartRef.current?.x ?? e.clientX);
      const dy = e.clientY - (panStartRef.current?.y ?? e.clientY);

      // کامیت کردن موقعیت جدید
      setPanX((prev) => prev + dx);
      setPanY((prev) => prev + dy);

      panStartRef.current = null;
      setDragX(0);
      setDragY(0);
      setIsPanning(false);
      setIsMiddlePanning(false);

      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleContainerPointerCancel = (
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (e.button === 1 && isMiddlePanning) {
      // کنسل کردن پن بدون کامیت
      panStartRef.current = null;
      setDragX(0);
      setDragY(0);
      setIsPanning(false);
      setIsMiddlePanning(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // هندلرهای مربوط به ابزار دستی (Hand Tool) - کلیک چپ
  const handlePanDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    panStartRef.current = { x: e.clientX, y: e.clientY };
    setIsPanning(true);
  };

  const handlePanMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panStartRef.current) return;
    setDragX(e.clientX - panStartRef.current.x);
    setDragY(e.clientY - panStartRef.current.y);
  };

  const handlePanUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPanX((prev) => prev + dx);
    setPanY((prev) => prev + dy);
    panStartRef.current = null;
    setDragX(0);
    setDragY(0);
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

  const changeScale = (target: number) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, target));
    if (clamped === scale) return;
    const cx = containerSize.width / 2;
    const cy = containerSize.height / 2;
    const wx = (cx - panX) / scale;
    const wy = (cy - panY) / scale;
    setScale(clamped);
    setPanX(cx - wx * clamped);
    setPanY(cy - wy * clamped);
    if (onScaleChange) onScaleChange(clamped);
  };

  const resetZoom = () => {
    const cx = containerSize.width / 2;
    const cy = containerSize.height / 2;
    const wx = (cx - panX) / scale;
    const wy = (cy - panY) / scale;
    setScale(DEFAULT_ZOOM);
    setPanX(cx - wx * DEFAULT_ZOOM);
    setPanY(cy - wy * DEFAULT_ZOOM);
    if (onScaleChange) onScaleChange(DEFAULT_ZOOM);
  };

  const dragStyle: React.CSSProperties = isPanning
    ? {
        transform: `translate(${dragX}px, ${dragY}px)`,
        willChange: "transform",
      }
    : {};

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

          <button
            onClick={() => setTool("pan")}
            className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center ${
              tool === "pan"
                ? "text-[#38bdf8] bg-zinc-100 shadow-[0_0_10px_rgba(56,189,248,0.3)]"
                : "text-white/70 group-hover/panel:text-zinc-800 hover:bg-zinc-100"
            }`}
            title="Pan Tool (G)"
          >
            <Hand size={18} />
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
            onClick={resetZoom}
            className="p-2.5 rounded-xl text-white/70 group-hover/panel:text-zinc-800 hover:bg-zinc-100 transition-all"
            title="Reset Zoom"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* راهنمای pan */}
      {(tool === "pan" || isMiddlePanning) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-black/40 backdrop-blur-xl px-4 py-2 rounded-full border border-white/20 text-white/90 text-xs font-medium flex items-center gap-2 pointer-events-none">
          <Hand size={14} />
          Drag to pan · Scroll to pan · Ctrl+Scroll to zoom
        </div>
      )}

      {/* ✅ اضافه شدن هندلرهای غلطک ماوس به کانتینر اصلی */}
      <div
        ref={containerRef}
        className="flex-1 w-full h-full relative overflow-hidden"
        style={{ cursor: isMiddlePanning ? "grabbing" : undefined }}
        onPointerDownCapture={handleContainerPointerDown}
        onPointerMoveCapture={handleContainerPointerMove}
        onPointerUpCapture={handleContainerPointerUp}
        onPointerCancelCapture={handleContainerPointerCancel}
        onAuxClick={(e) => {
          // جلوگیری از رفتار پیش‌فرض کلیک وسط (مثل Auto-scroll مرورگر)
          if (e.button === 1) e.preventDefault();
        }}
      >
        <div
          style={{
            ...dragStyle,
            // ✅ وقتی با غلطک در حال جابه‌جایی هستیم، لایه رسم نباید کلیک دریافت کند
            pointerEvents: isMiddlePanning ? "none" : "auto",
          }}
          className="absolute inset-0"
        >
          {containerSize.width > 0 && (
            <PdfDrawingLayer
              filePath={filePath}
              pageNumber={1}
              width={containerSize.width}
              height={containerSize.height}
              pdfWidth={containerSize.width}
              pdfHeight={containerSize.height}
              textLines={[]}
              toStored={toStored}
              toScreen={toScreen}
              invalidateKey={invalidateKey}
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
