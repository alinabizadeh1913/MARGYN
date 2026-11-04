"use client";

import React, { useRef, useState, useEffect } from "react";
import { getStroke } from "perfect-freehand";
import { useTool } from "@/providers/ToolProvider";
import { saveDrawing, loadDrawing } from "@/db";

interface PdfDrawingLayerProps {
  pageNumber: number;
  width: number;
  height: number;
}

export default function PdfDrawingLayer({
  pageNumber,
  width,
  height,
}: PdfDrawingLayerProps) {
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const dynamicCanvasRef = useRef<HTMLCanvasElement>(null);
  const { tool, color, size } = useTool();

  const [lines, setLines] = useState<any[]>([]);
  const currentLineRef = useRef<any>(null);
  const isDrawingRef = useRef(false);
  const reqAnimationRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    loadDrawing(pageNumber, "pdf").then((saved) => {
      if (isMounted) {
        setLines(saved);
        redrawStaticCanvas(saved);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [pageNumber]);

  useEffect(() => {
    const handleClear = () => {
      setLines([]);
      redrawStaticCanvas([]);
      clearDynamicCanvas();
    };
    window.addEventListener(`margyn-clear-page-${pageNumber}`, handleClear);
    window.addEventListener("margyn-clear-all", handleClear);
    return () => {
      window.removeEventListener(
        `margyn-clear-page-${pageNumber}`,
        handleClear,
      );
      window.removeEventListener("margyn-clear-all", handleClear);
    };
  }, [pageNumber]);

  useEffect(() => {
    redrawStaticCanvas(lines);
  }, [width, height]);

  const drawLineOnCtx = (ctx: CanvasRenderingContext2D, line: any) => {
    const scaledPoints = line.points.map((p: number[]) => [
      p[0] * width,
      p[1] * height,
    ]);
    const stroke = getStroke(scaledPoints, {
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
    const canvas = dynamicCanvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;

    const isEraser = tool === "eraser";
    const rect = canvas.getBoundingClientRect();

    currentLineRef.current = {
      points: [
        [
          (e.clientX - rect.left) / rect.width,
          (e.clientY - rect.top) / rect.height,
        ],
      ],
      color: isEraser ? "transparent" : color,
      size: isEraser ? size * 3 : size,
      isEraser,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentLineRef.current) return;
    const rect = dynamicCanvasRef.current!.getBoundingClientRect();
    currentLineRef.current.points.push([
      (e.clientX - rect.left) / rect.width,
      (e.clientY - rect.top) / rect.height,
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
    redrawStaticCanvas(newLines);
    await saveDrawing(pageNumber, "pdf", newLines);

    isDrawingRef.current = false;
    currentLineRef.current = null;
    if (reqAnimationRef.current) cancelAnimationFrame(reqAnimationRef.current);
  };

  const cursorClass =
    tool === "eraser"
      ? "cursor-eraser pointer-events-auto"
      : "cursor-pen pointer-events-auto";

  return (
    <div className="absolute inset-0 z-10">
      <canvas
        ref={staticCanvasRef}
        width={width}
        height={height}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
      <canvas
        ref={dynamicCanvasRef}
        width={width}
        height={height}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={`absolute inset-0 w-full h-full touch-none ${cursorClass}`}
      />
    </div>
  );
}
