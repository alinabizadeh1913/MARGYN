"use client";

import React, { useLayoutEffect, useMemo, useCallback } from "react";
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
  // ✅ NEW: optional custom mappers for infinite canvas
  toStored?: (x: number, y: number) => [number, number];
  toScreen?: (x: number, y: number) => [number, number];
  invalidateKey?: string | number;
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
  toStored,
  toScreen,
  invalidateKey,
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

  const defaultToStored = useCallback(
    (x: number, y: number): [number, number] => [
      (x - pdfLeft) / pdfWidth,
      (y - pdfTop) / pdfHeight,
    ],
    [pdfLeft, pdfTop, pdfWidth, pdfHeight],
  );

  const defaultToScreen = useCallback(
    (x: number, y: number): [number, number] => [
      x * pdfWidth + pdfLeft,
      y * pdfHeight + pdfTop,
    ],
    [pdfLeft, pdfTop, pdfWidth, pdfHeight],
  );

  const storedMapper = toStored ?? defaultToStored;
  const screenMapper = toScreen ?? defaultToScreen;

  const { staticRef, dynamicRef, resize, handlers, hoverCursor } = useInkCanvas(
    {
      kind: "pdf",
      filePath,
      page: pageNumber,
      toStored: storedMapper,
      toScreen: screenMapper,
      textLines: screenLines,
      onDeletePage,
    },
  );

  useLayoutEffect(() => {
    resize(width, height, true);
    // invalidateKey در deps → با تغییر pan/zoom، cache هندسه باطل و redraw انجام میشود
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, pdfWidth, pdfHeight, resize, invalidateKey]);

  const toolCursor = useMemo(() => getToolCursor(tool, color), [tool, color]);
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