"use client";

import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useSession } from "@/providers/SessionProvider";
import { useTool } from "@/providers/ToolProvider";
import { useInkCanvas } from "./useInkCanvas";
import { getToolCursor } from "./inkGeometry";

const identity = (x: number, y: number): [number, number] => [x, y];

export default function MarginCanvas({ filePath }: { filePath?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { currentPage } = useSession();
  const { tool, color } = useTool();

  const { staticRef, dynamicRef, resize, handlers, hoverCursor } = useInkCanvas(
    {
      kind: "margin",
      filePath: filePath || "",
      page: currentPage,
      toStored: identity,
      toScreen: identity,
    },
  );

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    resize(el.clientWidth, el.clientHeight);
    const ro = new ResizeObserver(([entry]) => {
      resize(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [resize]);

  // Declarative cursor: pen + shapes → coloured pen, eraser → eraser cursor.
  const toolCursor = useMemo(() => getToolCursor(tool, color), [tool, color]);
  // Select tool: "default", plus move/resize feedback coming from the hook's state.
  const cursor = tool === "select" ? hoverCursor : toolCursor;

  return (
    <div
      ref={wrapRef}
      className="flex-1 w-full h-full relative overflow-hidden select-none"
    >
      <canvas
        ref={staticRef}
        className="absolute inset-0 pointer-events-none"
      />
      <canvas
        ref={dynamicRef}
        {...handlers}
        style={{ touchAction: "none", cursor }}
        className="absolute inset-0 touch-none"
      />
    </div>
  );
}
