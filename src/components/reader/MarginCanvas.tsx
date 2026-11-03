"use client";

import React, { useRef, useState, useEffect } from "react";
import { getStroke } from "perfect-freehand";
import { useSession } from "@/providers/SessionProvider";
import { useTool } from "@/providers/ToolProvider";
import Typography from "@/typography";
import { saveDrawingForPage, loadDrawingForPage } from "@/db";

export default function MarginCanvas({ externalClearRef }: { externalClearRef?: React.MutableRefObject<(() => void) | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isActive, currentPage } = useSession();
  const { tool, color, size } = useTool();
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [lines, setLines] = useState<any[]>([]);
  const [currentLine, setCurrentLine] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // =========================================================
  // Load Drawings when Page Changes
  // =========================================================
  useEffect(() => {
    let isMounted = true;
    const fetchLines = async () => {
      setIsLoading(true);
      const savedLines = await loadDrawingForPage(currentPage);
      if (isMounted) {
        setLines(savedLines);
        setIsLoading(false);
      }
    };
    fetchLines();
    
    return () => { isMounted = false; };
  }, [currentPage]);

  // Expose clear function
  useEffect(() => {
    if (externalClearRef) {
      externalClearRef.current = () => {
        setLines([]);
        setCurrentLine(null);
        saveDrawingForPage(currentPage, []);
      };
    }
  }, [externalClearRef, currentPage]);

  // Resize handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        redrawCanvas();
      }
    };

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [lines]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const allLines = currentLine ? [...lines, currentLine] : lines;

    allLines.forEach((line) => {
      const stroke = getStroke(line.points, {
        size: line.size,
        thinning: 0.5,
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
    });
  };

  useEffect(() => {
    redrawCanvas();
  }, [lines, currentLine]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isActive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    
    const isEraser = tool === "eraser";
    
    setCurrentLine({
      points: [[e.nativeEvent.offsetX, e.nativeEvent.offsetY, e.pressure || 0.5]],
      color: isEraser ? "transparent" : color,
      size: isEraser ? size * 3 : size,
      isEraser,
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentLine) return;
    setCurrentLine({
      ...currentLine,
      points: [...currentLine.points, [e.nativeEvent.offsetX, e.nativeEvent.offsetY, e.pressure || 0.5]],
    });
  };

  const handlePointerUp = async () => {
    if (currentLine) {
      const newLines = [...lines, currentLine];
      setLines(newLines);
      // Save to DB for the current page
      await saveDrawingForPage(currentPage, newLines);
    }
    setIsDrawing(false);
    setCurrentLine(null);
  };

  return (
    <div className="flex-1 w-full h-full relative cursor-crosshair">
      {!isActive && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#121214]/60 backdrop-blur-sm pointer-events-none">
          <Typography variant="microLabel" className="text-[#52525b]">
            Start session to write
          </Typography>
        </div>
      )}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#121214]/60 backdrop-blur-sm pointer-events-none">
          <Typography variant="microLabel" className="text-[#52525b]">
            Loading Margin...
          </Typography>
        </div>
      )}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-full h-full touch-none"
      />
    </div>
  );
}