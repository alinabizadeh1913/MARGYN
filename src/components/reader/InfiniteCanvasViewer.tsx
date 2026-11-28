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
import { usePanInput } from "./usePanInput";
import { usePaneFocused } from "./PaneContext";
import CanvasPatternPicker from "./CanvasPatternPicker";
import {
  DEFAULT_PATTERN,
  drawPattern,
  loadPattern,
  savePattern,
  type CanvasPatternState,
} from "./canvasPattern";

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
  const paneFocused = usePaneFocused();

  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [scale, setScale] = useState(initialScale);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const [pattern, setPattern] = useState<CanvasPatternState>(DEFAULT_PATTERN);
  const patternLoadedRef = useRef(false);
  const patternCanvasRef = useRef<HTMLCanvasElement>(null);

  const viewerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // بارگذاری / ذخیره‌ی استایل صفحه به ازای هر کنواس
  useEffect(() => {
    patternLoadedRef.current = false;
    setPattern(loadPattern(filePath));
    patternLoadedRef.current = true;
  }, [filePath]);

  const handlePatternChange = useCallback(
    (next: CanvasPatternState) => {
      setPattern(next);
      if (patternLoadedRef.current) savePattern(filePath, next);
    },
    [filePath],
  );

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
      } else {
        e.preventDefault();
        const dx = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY;
        setPanX((p) => p - dx);
        setPanY((p) => p - dy);
      }
    },
    [scale, panX, panY, onScaleChange],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Pen-first pan input (Space-hold, pen barrel, middle button, Hand tool).
  const { drag, isPanning, panMode } = usePanInput({
    containerRef,
    tool,
    setTool,
    enabled: paneFocused,
    onCommit: (dx, dy) => {
      setPanX((p) => p + dx);
      setPanY((p) => p + dy);
    },
  });

  // رسم الگوی پس‌زمینه (هنگام کشیدن/پن هم با drag همگام می‌شود)
  useEffect(() => {
    const c = patternCanvasRef.current;
    if (!c || containerSize.width <= 0 || containerSize.height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    const w = containerSize.width;
    const h = containerSize.height;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    drawPattern(
      c,
      w,
      h,
      dpr,
      pattern,
      panX + (isPanning ? drag.x : 0),
      panY + (isPanning ? drag.y : 0),
      scale,
      canvasBg,
    );
  }, [
    pattern,
    panX,
    panY,
    scale,
    containerSize,
    canvasBg,
    isPanning,
    drag.x,
    drag.y,
  ]);

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
        transform: `translate(${drag.x}px, ${drag.y}px)`,
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
        <div className="bg-nm-panel border border-nm-edge p-2 rounded-2xl flex flex-col gap-1.5 shadow-nm-raised transition-all duration-300 hover:bg-nm-raise group/panel">
          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl text-white/70 group-hover/panel:text-nm-text hover:bg-nm-raise transition-all"
            title="Fullscreen"
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <div className="h-px w-full bg-white/20 group-hover/panel:bg-nm-line my-0.5" />

          <button
            onClick={() => setTool("pan")}
            className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center ${
              tool === "pan"
                ? "text-nm-accent bg-nm-raise shadow-nm-glow"
                : "text-white/70 group-hover/panel:text-nm-text hover:bg-nm-raise"
            }`}
            title="Pan Tool (G)"
          >
            <Hand size={18} />
          </button>

          <div className="h-px w-full bg-white/20 group-hover/panel:bg-nm-line my-0.5" />
          <ColorPicker
            color={canvasBg || "#ffffff"}
            onChange={onCanvasBgChange}
            trigger={
              <div className="p-2.5 rounded-xl text-white/70 group-hover/panel:text-nm-text hover:bg-nm-raise transition-all flex items-center justify-center">
                <Palette size={18} />
              </div>
            }
          />
          <div className="h-px w-full bg-white/20 group-hover/panel:bg-nm-line my-0.5" />
          <button
            onClick={() => changeScale(scale + 0.2)}
            className="p-2.5 rounded-xl text-white/70 group-hover/panel:text-nm-text hover:bg-nm-raise transition-all"
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={() => changeScale(scale - 0.2)}
            className="p-2.5 rounded-xl text-white/70 group-hover/panel:text-nm-text hover:bg-nm-raise transition-all"
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>
          <button
            onClick={resetZoom}
            className="p-2.5 rounded-xl text-white/70 group-hover/panel:text-nm-text hover:bg-nm-raise transition-all"
            title="Reset Zoom"
          >
            <RotateCcw size={18} />
          </button>
          <div className="h-px w-full bg-white/20 group-hover/panel:bg-nm-line my-0.5" />
          <CanvasPatternPicker value={pattern} onChange={handlePatternChange} />
        </div>
      </div>

      {/* راهنمای pan */}
      {(panMode || isPanning) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-black/40 px-4 py-2 rounded-full border border-nm-edge text-white/90 text-xs font-medium flex items-center gap-2 pointer-events-none">
          <Hand size={14} />
          Drag to pan · Scroll to pan · Ctrl+Scroll to zoom · Space / pen button to hold-pan
        </div>
      )}

      {/* ✅ اضافه شدن هندلرهای غلطک ماوس به کانتینر اصلی */}
      <div
        ref={containerRef}
        className="flex-1 w-full h-full relative overflow-hidden"
        style={{ cursor: isPanning ? "grabbing" : undefined, touchAction: "none" }}
      >
        <canvas
          ref={patternCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ width: "100%", height: "100%" }}
        />
        <div
          style={{
            ...dragStyle,
            // ✅ وقتی با غلطک در حال جابه‌جایی هستیم، لایه رسم نباید کلیک دریافت کند
            pointerEvents: isPanning ? "none" : "auto",
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

        {panMode && (
          <div
            className="absolute inset-0 z-30"
            style={{
              cursor: isPanning ? "grabbing" : "grab",
              touchAction: "none",
            }}
          />
        )}
      </div>
    </div>
  );
}
