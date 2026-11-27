"use client";

import React, { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";

/**
 * Software cursor for PEN input.
 * Windows hides the system cursor while a pen hovers/draws (Windows Ink), so
 * the CSS tool cursor is never visible with a stylus. For pointerType "pen"
 * we hide the system cursor and move a lightweight DOM sprite (same artwork,
 * same hot-spot) with transform only: no React renders, no canvas redraws.
 */
export function useSoftPenCursor(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  cursor: string,
) {
  const dynamicRef = canvasRef;
  const softRef = useRef<HTMLDivElement>(null);
  const parsed = useMemo(() => {
    const m = /^url\("([^"]+)"\)\s+(\d+)\s+(\d+)/.exec(cursor);
    return m ? { url: m[1], hx: +m[2], hy: +m[3] } : null;
  }, [cursor]);
  const parsedRef = useRef(parsed);
  useEffect(() => {
    parsedRef.current = parsed;
    const el = softRef.current;
    if (el && parsed) el.style.backgroundImage = `url("${parsed.url}")`;
  }, [parsed]);

  useEffect(() => {
    const canvas = dynamicRef.current;
    const sprite = softRef.current;
    if (!canvas || !sprite) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    let shown = false;

    const hide = () => {
      if (!shown) return;
      shown = false;
      sprite.style.display = "none";
      canvas.classList.remove("soft-cursor");
    };
    const paint = () => {
      raf = 0;
      const p = parsedRef.current;
      if (!p) return;
      sprite.style.transform = `translate3d(${x - p.hx}px, ${y - p.hy}px, 0)`;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "pen" || !parsedRef.current) {
        hide();
        return;
      }
      const r = canvas.getBoundingClientRect();
      x = e.clientX - r.left;
      y = e.clientY - r.top;
      if (!shown) {
        shown = true;
        sprite.style.display = "block";
        sprite.style.backgroundImage = `url("${parsedRef.current.url}")`;
        canvas.classList.add("soft-cursor");
      }
      if (!raf) raf = requestAnimationFrame(paint);
    };

    canvas.addEventListener("pointerenter", onMove);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onMove);
    canvas.addEventListener("pointerleave", hide);
    canvas.addEventListener("pointercancel", hide);
    return () => {
      canvas.removeEventListener("pointerenter", onMove);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onMove);
      canvas.removeEventListener("pointerleave", hide);
      canvas.removeEventListener("pointercancel", hide);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [dynamicRef]);

  return softRef;
}

export function SoftPenCursor({
  spriteRef,
}: {
  spriteRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={spriteRef}
      aria-hidden
      className="absolute left-0 top-0 pointer-events-none"
      style={{
        display: "none",
        width: 32,
        height: 32,
        backgroundRepeat: "no-repeat",
        willChange: "transform",
      }}
    />
  );
}
