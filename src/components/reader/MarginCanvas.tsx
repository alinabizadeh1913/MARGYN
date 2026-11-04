"use client";

import React, { useRef, useState, useEffect } from "react";
import { getStroke } from "perfect-freehand";
import { useSession } from "@/providers/SessionProvider";
import { useTool } from "@/providers/ToolProvider";
import { saveDrawing, loadDrawing } from "@/db";

export default function MarginCanvas() {
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const dynamicCanvasRef = useRef<HTMLCanvasElement>(null);
  const { currentPage } = useSession();
  const { tool, color, size } = useTool();

  const [lines, setLines] = useState<any[]>([]);
  const currentLineRef = useRef<any>(null);
  const isDrawingRef = useRef(false);
  const reqAnimationRef = useRef<number | null>(null);

  const setupCanvas = (canvas: HTMLCanvasElement) => {
    const parent = canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const width = parent.clientWidth;
    const height = parent.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  };

  useEffect(() => {
    let isMounted = true;
    loadDrawing(currentPage, "margin").then((savedLines) => {
      if (isMounted) {
        setLines(savedLines);
        setupCanvas(staticCanvasRef.current!);
        setupCanvas(dynamicCanvasRef.current!);
        redrawStaticCanvas(savedLines);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [currentPage]);

  useEffect(() => {
    const handleClear = () => {
      setLines([]);
      redrawStaticCanvas([]);
      const canvas = dynamicCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.restore();
        }
      }
    };

    const handleReload = () => {
      loadDrawing(currentPage, "margin").then((savedLines) => {
        setLines(savedLines);
        redrawStaticCanvas(savedLines);
      });
    };

    window.addEventListener("margyn-clear-all", handleClear);
    window.addEventListener(`margyn-clear-page-${currentPage}`, handleClear);
    window.addEventListener("margyn-reload-all", handleReload);

    return () => {
      window.removeEventListener("margyn-clear-all", handleClear);
      window.removeEventListener(
        `margyn-clear-page-${currentPage}`,
        handleClear,
      );
      window.removeEventListener("margyn-reload-all", handleReload);
    };
  }, [currentPage]);

  useEffect(() => {
    const parent = staticCanvasRef.current?.parentElement;
    if (!parent) return;

    const handleResize = () => {
      setupCanvas(staticCanvasRef.current!);
      setupCanvas(dynamicCanvasRef.current!);
      redrawStaticCanvas(lines);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(parent);
    handleResize();

    return () => resizeObserver.disconnect();
  }, [lines]);

  const drawLineOnCtx = (ctx: CanvasRenderingContext2D, line: any) => {
    const stroke = getStroke(line.points, {
      size: line.size,
      thinning: 0,
      simulatePressure: false,
      smoothing: 0.6, // تنظیم برای نرمی فوق‌العاده
      streamline: 0.6, // تنظیم برای روانی حرکت
    });
    if (stroke.length < 2) return;

    ctx.beginPath();
    if (line.isEraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = line.color;
    }

    const p0 = stroke[0];
    ctx.moveTo(p0[0], p0[1]);
    for (let i = 1; i < stroke.length; i++) {
      const [x0, y0] = stroke[i - 1];
      const [x1, y1] = stroke[i];
      ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
    }
    ctx.fill();
  };

  const redrawStaticCanvas = (allLines: any[]) => {
    const canvas = staticCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    allLines.forEach((line) => drawLineOnCtx(ctx, line));
    ctx.restore();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = dynamicCanvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const isEraser = tool === "eraser";
    currentLineRef.current = {
      points: [[x, y]],
      color: isEraser ? "transparent" : color,
      size: isEraser ? size * 3 : size,
      isEraser,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentLineRef.current) return;

    const canvas = dynamicCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    const events = e.nativeEvent.getCoalescedEvents
      ? e.nativeEvent.getCoalescedEvents()
      : [e.nativeEvent];

    events.forEach((ev) => {
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      currentLineRef.current.points.push([x, y]);
    });

    if (!reqAnimationRef.current) {
      reqAnimationRef.current = requestAnimationFrame(() => {
        const ctx = canvas.getContext("2d", { desynchronized: true });
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);

        drawLineOnCtx(ctx, currentLineRef.current);

        ctx.restore();
        reqAnimationRef.current = null;
      });
    }
  };

  const handlePointerUp = async () => {
    if (!isDrawingRef.current || !currentLineRef.current) return;

    const newLine = currentLineRef.current;
    const newLines = [...lines, newLine];
    setLines(newLines);

    const staticCtx = staticCanvasRef.current?.getContext("2d", {
      desynchronized: true,
    });
    if (staticCtx) {
      const dpr = window.devicePixelRatio || 1;
      staticCtx.save();
      staticCtx.scale(dpr, dpr);
      drawLineOnCtx(staticCtx, newLine);
      staticCtx.restore();
    }

    const dynamicCanvas = dynamicCanvasRef.current;
    if (dynamicCanvas) {
      const ctx = dynamicCanvas.getContext("2d");
      if (ctx) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, dynamicCanvas.width, dynamicCanvas.height);
        ctx.restore();
      }
    }

    await saveDrawing(currentPage, "margin", newLines);

    isDrawingRef.current = false;
    currentLineRef.current = null;
    if (reqAnimationRef.current) {
      cancelAnimationFrame(reqAnimationRef.current);
      reqAnimationRef.current = null;
    }
  };

  const cursorClass = tool === "eraser" ? "cursor-eraser" : "cursor-pen";

  return (
    <div className="flex-1 w-full h-full relative overflow-hidden">
      <canvas
        ref={staticCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
      <canvas
        ref={dynamicCanvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={`absolute inset-0 w-full h-full touch-none ${cursorClass}`}
      />
    </div>
  );
}
