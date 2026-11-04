"use client";

import React, { useLayoutEffect, useMemo } from "react";
import { useTool } from "@/providers/ToolProvider";
import { useInkCanvas } from "./useInkCanvas";
import type { TextLine } from "./inkTypes";

interface PdfDrawingLayerProps {
  filePath: string;
  pageNumber: number;
  width: number;
  height: number;
  pdfWidth: number;
  pdfHeight: number;
  /** text lines in PDF-page px (see pdfText.ts) – empty for scanned PDFs */
  textLines?: TextLine[];
}

export default function PdfDrawingLayer({
  filePath,
  pageNumber,
  width,
  height,
  pdfWidth,
  pdfHeight,
  textLines,
}: PdfDrawingLayerProps) {
  const { tool } = useTool();

  const pdfLeft = (width - pdfWidth) / 2;
  const pdfTop = (height - pdfHeight) / 2;

  // move text lines from page space into layer space (once per page / resize)
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

  const { staticRef, dynamicRef, resize, handlers } = useInkCanvas({
    kind: "pdf",
    filePath,
    page: pageNumber,
    toStored: (x, y) => [(x - pdfLeft) / pdfWidth, (y - pdfTop) / pdfHeight],
    toScreen: (x, y) => [x * pdfWidth + pdfLeft, y * pdfHeight + pdfTop],
    textLines: screenLines,
  });

  useLayoutEffect(() => {
    resize(width, height, true);
  }, [width, height, pdfWidth, pdfHeight, resize]);

  const cursorClass =
    tool === "eraser"
      ? "cursor-eraser"
      : tool === "highlighter"
        ? "cursor-text"
        : tool === "select"
          ? "cursor-default"
          : "cursor-pen";

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
