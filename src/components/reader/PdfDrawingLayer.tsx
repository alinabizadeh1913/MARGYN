"use client";

import React, { useLayoutEffect } from "react";
import { useTool } from "@/providers/ToolProvider";
import { useInkCanvas } from "./useInkCanvas";

interface PdfDrawingLayerProps {
  filePath: string;
  pageNumber: number;
  width: number;
  height: number;
  pdfWidth: number;
  pdfHeight: number;
}

export default function PdfDrawingLayer({
  filePath,
  pageNumber,
  width,
  height,
  pdfWidth,
  pdfHeight,
}: PdfDrawingLayerProps) {
  const { tool } = useTool();

  const pdfLeft = (width - pdfWidth) / 2;
  const pdfTop = (height - pdfHeight) / 2;

  const { staticRef, dynamicRef, resize, handlers } = useInkCanvas({
    kind: "pdf",
    filePath,
    page: pageNumber,
    toStored: (x, y) => [(x - pdfLeft) / pdfWidth, (y - pdfTop) / pdfHeight],
    toScreen: (x, y) => [x * pdfWidth + pdfLeft, y * pdfHeight + pdfTop],
  });

  useLayoutEffect(() => {
    resize(width, height, true);
  }, [width, height, pdfWidth, pdfHeight, resize]);

  const cursorClass = tool === "eraser" ? "cursor-eraser" : "cursor-pen";

  return (
    <div className="absolute inset-0 z-10 pointer-events-none select-none">
      <canvas
        ref={staticRef}
        className="absolute inset-0 pointer-events-none"
      />
      <canvas
        ref={dynamicRef}
        {...handlers}
        style={{ touchAction: "none" }}
        className={`absolute inset-0 touch-none pointer-events-auto ${cursorClass}`}
      />
    </div>
  );
}
