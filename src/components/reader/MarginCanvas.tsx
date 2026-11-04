"use client";

import React, { useRef, useState, useEffect } from "react";
import { getStroke } from "perfect-freehand";
import { useSession } from "@/providers/SessionProvider";
import { useTool } from "@/providers/ToolProvider";
import Typography from "@/typography";
import { saveDrawing, loadDrawing } from "@/db";

export default function MarginCanvas() {
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const dynamicCanvasRef = useRef<HTMLCanvasElement>(null);
  const { isActive, currentPage } = useSession();
  const { tool, color, size } = useTool();

  const [lines, setLines] = useState<any[]>([]);
  const currentLineRef = useRef<any>(null);
  const isDrawingRef = useRef(false);
  const reqAnimationRef = useRef<number | null>(null);

  // Load existing lines
  useEffect(() => {
    let isMounted = true;
    loadDrawing(currentPage, "margin").then((savedLines) => {
      if (isMounted) {
        setLines(savedLines);
        redrawStaticCanvas(savedLines);
        clearDynamicCanvas();
      }
    });
    return () => {
      isMounted = false;
    };
  }, [currentPage]);

  // Listen for Custom Clear Events
  useEffect(() => {
    const handleClear = () => {
      setLines([]);
      redrawStaticCanvas([]);
      clearDynamicCanvas();
    };
    window.addEventListener("margyn-clear-all", handleClear);
    window.addEventListener(`margyn-clear-page-${currentPage}`, handleClear);
    return () => {
      window.removeEventListener("margyn-clear-all", handleClear);
      window.removeEventListener(
        `margyn-clear-page-${currentPage}`,
        handleClear,
      );
    };
  }, [currentPage]);

  // Resize handling
  useEffect(() => {
    const handleResize = () => {
      const parent = staticCanvasRef.current?.parentElement;
      if (parent && staticCanvasRef.current && dynamicCanvasRef.current) {
        staticCanvasRef.current.width = parent.clientWidth;
        staticCanvasRef.current.height = parent.clientHeight;
        dynamicCanvasRef.current.width = parent.clientWidth;
        dynamicCanvasRef.current.height = parent.clientHeight;
        redrawStaticCanvas(lines);
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [lines]);

  const drawLineOnCtx = (ctx: CanvasRenderingContext2D, line: any) => {
    const stroke = getStroke(line.points, {
      size: line.size,
      thinning: 0,
      simulatePressure: false,
      smoothing: 0.5,
      streamline: 0.5,
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    allLines.forEach((line) => drawLineOnCtx(ctx, line));
  };

  const clearDynamicCanvas = () => {
    const canvas = dynamicCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isActive) return;
    const canvas = dynamicCanvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;

    const isEraser = tool === "eraser";
    currentLineRef.current = {
      points: [[e.nativeEvent.offsetX, e.nativeEvent.offsetY]],
      color: isEraser ? "transparent" : color,
      size: isEraser ? size * 3 : size,
      isEraser,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentLineRef.current) return;
    currentLineRef.current.points.push([
      e.nativeEvent.offsetX,
      e.nativeEvent.offsetY,
    ]);

    if (reqAnimationRef.current) cancelAnimationFrame(reqAnimationRef.current);
    reqAnimationRef.current = requestAnimationFrame(() => {
      clearDynamicCanvas();
      const ctx = dynamicCanvasRef.current?.getContext("2d");
      if (ctx) drawLineOnCtx(ctx, currentLineRef.current);
    });
  };

  const handlePointerUp = async () => {
    if (!isDrawingRef.current || !currentLineRef.current) return;

    const newLines = [...lines, currentLineRef.current];
    setLines(newLines);
    clearDynamicCanvas();
    redrawStaticCanvas(newLines); // Push current line to static canvas permanently
    await saveDrawing(currentPage, "margin", newLines);

    isDrawingRef.current = false;
    currentLineRef.current = null;
    if (reqAnimationRef.current) cancelAnimationFrame(reqAnimationRef.current);
  };

  const cursorClass = !isActive
    ? "cursor-default"
    : tool === "eraser"
      ? "cursor-eraser"
      : "cursor-pen";

  return (
    <div className="flex-1 w-full h-full relative">
      {!isActive && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#121214]/60 backdrop-blur-sm pointer-events-none">
          <Typography variant="microLabel" className="text-[#52525b]">
            Start session to write
          </Typography>
        </div>
      )}
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
