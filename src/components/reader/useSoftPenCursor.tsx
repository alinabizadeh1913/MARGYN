"use client";

import React, { useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";

/**
 * State shared (through `canvas.__penCursor`) between the software cursor and
 * the ink engine of the SAME canvas.
 *
 * Why: the DOM sprite is composited by the compositor one or two frames AFTER
 * the (desynchronized) canvas shows the ink, and the ink head is additionally
 * drawn with predicted samples. While the pen is touching the surface the
 * sprite therefore trailed visibly behind the ink tip. During a pen stroke the
 * ink engine now draws the cursor artwork into the very same canvas, in the
 * very same draw call as the ink head, so icon and ink can never disagree.
 */
export interface PenCursorState {
  url: string;
  hx: number;
  hy: number;
  img: HTMLImageElement | null;
  /** true while the engine paints the cursor itself (DOM sprite hidden) */
  inStroke: boolean;
  /** set by the ink engine: is a pen stroke still really in progress? */
  active: (() => boolean) | null;
  setStroke: (v: boolean) => void;
  /** pre-rasterised cursor at the given device pixel ratio (cached) */
  getBitmap: (dpr: number) => HTMLCanvasElement | null;
  /** internal bitmap cache (reset whenever the artwork changes) */
  _bmp: HTMLCanvasElement | null;
  _bmpD: number;
}

const SIZE = 32;

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

  const stateRef = useRef<PenCursorState | null>(null);
  if (!stateRef.current) {
    const st: PenCursorState = {
      _bmp: null,
      _bmpD: 0,
      url: "",
      hx: 0,
      hy: 0,
      img: null,
      inStroke: false,
      active: null,
      setStroke: () => {},
      getBitmap: (d: number) => {
        const img = st.img;
        if (!img || !img.complete || !img.naturalWidth) return null;
        if (st._bmp && st._bmpD === d) return st._bmp;
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(SIZE * d));
        c.height = Math.max(1, Math.round(SIZE * d));
        const cx = c.getContext("2d");
        if (!cx) return null;
        cx.drawImage(img, 0, 0, c.width, c.height);
        st._bmp = c;
        st._bmpD = d;
        return c;
      },
    };
    stateRef.current = st;
  }

  useEffect(() => {
    parsedRef.current = parsed;
    const st = stateRef.current!;
    const el = softRef.current;
    if (el && parsed) el.style.backgroundImage = `url("${parsed.url}")`;
    if (parsed) {
      st.hx = parsed.hx;
      st.hy = parsed.hy;
      if (st.url !== parsed.url) {
        st.url = parsed.url;
        const img = new Image();
        img.src = parsed.url;
        st.img = img;
        st._bmp = null; // new colour / tool -> re-rasterise
      }
    }
  }, [parsed]);

  useEffect(() => {
    const canvas = dynamicRef.current;
    const sprite = softRef.current;
    const st = stateRef.current!;
    if (!canvas || !sprite) return;
    let raf = 0;
    let x = 0;
    let y = 0;
    let shown = false;
    let displayed = false;
    let stroke = false;

    const showSprite = (v: boolean) => {
      if (displayed === v) return;
      displayed = v;
      sprite.style.display = v ? "block" : "none";
    };

    const hide = () => {
      if (!shown) return;
      shown = false;
      showSprite(false);
      canvas.classList.remove("soft-cursor");
    };
    const paint = () => {
      raf = 0;
      const p = parsedRef.current;
      if (!p || stroke) return;
      sprite.style.transform = `translate3d(${x - p.hx}px, ${y - p.hy}px, 0)`;
    };

    st.setStroke = (v: boolean) => {
      stroke = v;
      st.inStroke = v;
      if (v) {
        showSprite(false); // the engine draws the icon inside the canvas now
      } else if (shown) {
        const p = parsedRef.current;
        if (p) {
          sprite.style.transform = `translate3d(${x - p.hx}px, ${y - p.hy}px, 0)`;
          showSprite(true);
        }
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "pen" || !parsedRef.current) {
        hide();
        return;
      }
      // self-heal: a stroke that ended without a clean pointerup
      if (stroke && st.active && !st.active()) {
        stroke = false;
        st.inStroke = false;
      }
      const r = canvas.getBoundingClientRect();
      x = e.clientX - r.left;
      y = e.clientY - r.top;
      if (!shown) {
        shown = true;
        sprite.style.backgroundImage = `url("${parsedRef.current.url}")`;
        canvas.classList.add("soft-cursor");
      }
      showSprite(!stroke);
      if (!stroke && !raf) raf = requestAnimationFrame(paint);
    };

    (canvas as any).__penCursor = st;

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
      if ((canvas as any).__penCursor === st) delete (canvas as any).__penCursor;
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
        width: SIZE,
        height: SIZE,
        backgroundRepeat: "no-repeat",
        willChange: "transform",
      }}
    />
  );
}
