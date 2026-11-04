"use client";

import React, { useLayoutEffect, useRef } from "react";
import { useSession } from "@/providers/SessionProvider";
import { useTool } from "@/providers/ToolProvider";
import { useInkCanvas } from "./useInkCanvas";

const identity = (x: number, y: number): [number, number] => [x, y];

export default function MarginCanvas({ filePath }: { filePath?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { currentPage } = useSession();
  const { tool } = useTool();

  const { staticRef, dynamicRef, resize, handlers } = useInkCanvas({
    kind: "margin",
    filePath: filePath || "",
    page: currentPage,
    toStored: identity,
    toScreen: identity,
  });

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

  const cursorClass = tool === "eraser" ? "cursor-eraser" : "cursor-pen";

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
        style={{ touchAction: "none" }}
        className={`absolute inset-0 touch-none ${cursorClass}`}
      />
    </div>
  );
}
