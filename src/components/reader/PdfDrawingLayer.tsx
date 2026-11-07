"use client";

import React, { useLayoutEffect, useMemo } from "react";
import { useTool } from "@/providers/ToolProvider";
import { useInkCanvas } from "./useInkCanvas";
import { getToolCursor } from "./inkGeometry";
import type { TextLine } from "./inkTypes";

interface PdfDrawingLayerProps {
  filePath: string;
  pageNumber: number;
  width: number;
  height: number;
  pdfWidth: number;
  pdfHeight: number;
  textLines?: TextLine[];
  onDeletePage?: () => void;
}

export default function PdfDrawingLayer({
  filePath,
  pageNumber,
  width,
  height,
  pdfWidth,
  pdfHeight,
  textLines,
  onDeletePage,
}: PdfDrawingLayerProps) {
  const { tool, color } = useTool();

  const pdfLeft = (width - pdfWidth) / 2;
  const pdfTop = (height - pdfHeight) / 2;

  const screenLines = useMemo(
    () =>
      (textLines || []).map((l) => ({
        ...l,
        top: l.top + pdfTop,
        bottom: l.bottom + pdfTop,
        runs: l.runs.map((r) => ({
          left: r.left + pdfLeft,
          right: r.right + pdfLeft,
          xs: r.xs.map((x) => x + pdfLeft),
        })),
      })),
    [textLines, pdfLeft, pdfTop],
  );

  const { staticRef, dynamicRef, resize, handlers, hoverCursor } = useInkCanvas(
    {
      kind: "pdf",
      filePath,
      page: pageNumber,
      toStored: (x, y) => [(x - pdfLeft) / pdfWidth, (y - pdfTop) / pdfHeight],
      toScreen: (x, y) => [x * pdfWidth + pdfLeft, y * pdfHeight + pdfTop],
      textLines: screenLines,
      onDeletePage,
    },
  );

  useLayoutEffect(() => {
    resize(width, height, true);
  }, [width, height, pdfWidth, pdfHeight, resize]);

  // Declarative cursor: pen + shapes → coloured pen, eraser → eraser cursor.
  const toolCursor = useMemo(() => getToolCursor(tool, color), [tool, color]);
  // Select tool: "default", plus move/resize feedback coming from the hook's state.
  const cursor = tool === "select" ? hoverCursor : toolCursor;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none select-none">
      <canvas
        ref={staticRef}
        className="absolute inset-0 pointer-events-none"
      />
      <canvas
        ref={dynamicRef}
        {...handlers}
        style={{ touchAction: "none", cursor }}
        className="absolute inset-0 touch-none pointer-events-auto"
      />
    </div>
  );
}
