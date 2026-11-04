"use client";

import React, { useRef, useState, useEffect } from "react";
import { getStroke } from "perfect-freehand";
import { useTool } from "@/providers/ToolProvider";
import { saveDrawing, loadDrawing } from "@/db";

interface PdfDrawingLayerProps {
  pageNumber: number;
  width: number;
  height: number;
  pdfWidth: number;
  pdfHeight: number;
}

export default function PdfDrawingLayer({
  pageNumber,
  width,
  height,
  pdfWidth,
  pdfHeight,
}: PdfDrawingLayerProps) {
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const dynamicCanvasRef = useRef<HTMLCanvasElement>(null);
  const { tool, color, size } = useTool();

  const [lines, setLines] = useState<any[]>([]);
  const currentLineRef = useRef<any>(null);
  const isDrawingRef = useRef(false);
  const reqAnimationRef = useRef<number | null>(null);

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

  const pdfLeft = (width - pdfWidth) / 2;
  const pdfTop = (height - pdfHeight) / 2;

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
      loadDrawing(pageNumber, "pdf").then((saved) => {
        setLines(saved);
        redrawStaticCanvas(saved);
      });
    };

    window.addEventListener(`margyn-clear-page-${pageNumber}`, handleClear);
    window.addEventListener("margyn-clear-all", handleClear);
    window.addEventListener("margyn-reload-all", handleReload);

    return () => {
      window.removeEventListener(
        `margyn-clear-page-${pageNumber}`,
        handleClear,
      );
      window.removeEventListener("margyn-clear-all", handleClear);
      window.removeEventListener("margyn-reload-all", handleReload);
    };
  }, [pageNumber]);

  useEffect(() => {
    redrawStaticCanvas(lines);
  }, [width, height, pdfWidth, pdfHeight, lines]);

  const drawLineOnCtx = (ctx: CanvasRenderingContext2D, line: any) => {
    const scaledPoints = line.points.map((p: number[]) => [
      p[0] * pdfWidth + pdfLeft,
      p[1] * pdfHeight + pdfTop,
    ]);
    const stroke = getStroke(scaledPoints, {
      size: line.size,
      thinning: 0,
      simulatePressure: false,
      smoothing: 0.6,
      streamline: 0.6,
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

    const isEraser = tool === "eraser";
    const rect = canvas.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const pdfX = (x - pdfLeft) / pdfWidth;
    const pdfY = (y - pdfTop) / pdfHeight;

    currentLineRef.current = {
      points: [[pdfX, pdfY]],
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

      const pdfX = (x - pdfLeft) / pdfWidth;
      const pdfY = (y - pdfTop) / pdfHeight;

      currentLineRef.current.points.push([pdfX, pdfY]);
    });

    if (!reqAnimationRef.current) {
      reqAnimationRef.current = requestAnimationFrame(() => {
        const ctx = canvas.getContext("2d", { desynchronized: true });
        if (!ctx) return;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);

        const currentLine = currentLineRef.current;
        const screenPoints = currentLine.points.map((p: number[]) => [
          p[0] * pdfWidth + pdfLeft,
          p[1] * pdfHeight + pdfTop,
        ]);

        const stroke = getStroke(screenPoints, {
          size: currentLine.size,
          thinning: 0,
          simulatePressure: false,
          smoothing: 0.6,
          streamline: 0.6,
        });

        if (stroke.length > 1) {
          ctx.beginPath();
          if (currentLine.isEraser) {
            ctx.globalCompositeOperation = "destination-out";
            ctx.fillStyle = "rgba(0,0,0,1)";
          } else {
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = currentLine.color;
          }
          const p0 = stroke[0];
          ctx.moveTo(p0[0], p0[1]);
          for (let i = 1; i < stroke.length; i++) {
            const [x0, y0] = stroke[i - 1];
            const [x1, y1] = stroke[i];
            ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
          }
          ctx.fill();
        }
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

    await saveDrawing(pageNumber, "pdf", newLines);

    isDrawingRef.current = false;
    currentLineRef.current = null;
    if (reqAnimationRef.current) {
      cancelAnimationFrame(reqAnimationRef.current);
      reqAnimationRef.current = null;
    }
  };

  const cursorClass = tool === "eraser" ? "cursor-eraser" : "cursor-pen";

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      <canvas
        ref={staticCanvasRef}
        width={width * dpr}
        height={height * dpr}
        style={{ width: `${width}px`, height: `${height}px` }}
        className="absolute inset-0 pointer-events-none"
      />
      <canvas
        ref={dynamicCanvasRef}
        width={width * dpr}
        height={height * dpr}
        style={{ width: `${width}px`, height: `${height}px` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={`absolute inset-0 touch-none pointer-events-auto ${cursorClass}`}
      />
    </div>
  );
}
