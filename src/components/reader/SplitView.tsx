"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

/** Narrowest a pane may become while dragging (CSS px). */
const MIN_PANE_PX = 260;
/** Width of the draggable divider (CSS px). */
const DIVIDER_PX = 6;

export interface SplitPaneDef {
  id: string;
  node: React.ReactNode;
}

interface SplitViewProps {
  panes: SplitPaneDef[];
  /** relative widths (any positive numbers, normally summing to 1) */
  sizes: number[];
  activeId: string | null;
  onSizesChange: (sizes: number[]) => void;
  onFocusPane: (id: string) => void;
}

const equalSizes = (n: number) => Array.from({ length: n }, () => 1 / n);

/**
 * Resizable side-by-side panes (VS Code style editor groups).
 *
 * Smoothness: while a divider is dragged NOTHING in React re-renders. The two
 * neighbouring panes get their `flex-grow` written straight to the DOM once per
 * animation frame (pointer capture keeps the drag alive outside the divider);
 * the final sizes are committed to React state a single time on pointer-up.
 */
export default function SplitView({
  panes,
  sizes,
  activeId,
  onSizesChange,
  onFocusPane,
}: SplitViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const paneEls = useRef<(HTMLDivElement | null)[]>([]);
  const valid = sizes.length === panes.length ? sizes : equalSizes(panes.length);
  const live = useRef<number[]>(valid);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const drag = useRef<{
    i: number;
    x0: number;
    x: number;
    s0: number[];
    perPx: number;
    raf: number;
  } | null>(null);

  useEffect(() => {
    live.current = valid;
    // keep the DOM in sync when sizes are changed from outside (reset, new pane)
    valid.forEach((s, i) => {
      const el = paneEls.current[i];
      if (el) el.style.flexGrow = String(s);
    });
  }, [valid.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const restoreBody = useCallback(() => {
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);
  useEffect(() => restoreBody, [restoreBody]);

  const apply = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    d.raf = 0;
    const pair = d.s0[d.i] + d.s0[d.i + 1];
    const minF = Math.min(MIN_PANE_PX * d.perPx, pair / 2);
    const a = Math.max(
      minF,
      Math.min(pair - minF, d.s0[d.i] + (d.x - d.x0) * d.perPx),
    );
    const next = d.s0.slice();
    next[d.i] = a;
    next[d.i + 1] = pair - a;
    live.current = next;
    const l = paneEls.current[d.i];
    const r = paneEls.current[d.i + 1];
    if (l) l.style.flexGrow = String(a);
    if (r) r.style.flexGrow = String(pair - a);
  }, []);

  const onDown = (e: React.PointerEvent<HTMLDivElement>, i: number) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const W = Math.max(1, wrap.clientWidth - DIVIDER_PX * (panes.length - 1));
    const S = live.current.reduce((a, b) => a + b, 0) || 1;
    drag.current = {
      i,
      x0: e.clientX,
      x: e.clientX,
      s0: live.current.slice(),
      perPx: S / W,
      raf: 0,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    setDragIdx(i);
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.x = e.clientX;
    if (!d.raf) d.raf = requestAnimationFrame(apply);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.raf) {
      cancelAnimationFrame(d.raf);
      d.x = e.clientX;
      apply();
    }
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    restoreBody();
    setDragIdx(null);
    onSizesChange(live.current.slice());
  };

  const dragging = dragIdx !== null;

  return (
    <div ref={wrapRef} className="flex w-full h-full min-w-0 overflow-hidden">
      {panes.map((p, i) => {
        const focused = p.id === activeId;
        return (
          <React.Fragment key={p.id}>
            <div
              ref={(el) => {
                paneEls.current[i] = el;
              }}
              onPointerDownCapture={() => onFocusPane(p.id)}
              onWheelCapture={() => onFocusPane(p.id)}
              className="relative h-full min-w-0 overflow-hidden"
              style={{
                flex: `${valid[i]} 1 0%`,
                contain: "layout paint",
              }}
            >
              <div
                className={`w-full h-full flex items-center justify-center ${
                  dragging ? "pointer-events-none" : ""
                }`}
              >
                {p.node}
              </div>
              <div
                className={`absolute top-0 left-0 right-0 h-[2px] z-[70] pointer-events-none transition-opacity duration-150 ${
                  focused ? "bg-nm-accent opacity-90" : "opacity-0"
                }`}
              />
            </div>
            {i < panes.length - 1 && (
              <div
                role="separator"
                aria-orientation="vertical"
                title="Drag to resize · double-click to reset"
                onPointerDown={(e) => onDown(e, i)}
                onPointerMove={onMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onLostPointerCapture={endDrag}
                onDoubleClick={() => onSizesChange(equalSizes(panes.length))}
                className="relative shrink-0 h-full cursor-col-resize z-[80] bg-nm-edge"
                style={{ width: DIVIDER_PX, touchAction: "none" }}
              >
                <div className="absolute inset-y-0 -left-1 -right-1" />
                <div
                  className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-px transition-colors ${
                    dragIdx === i ? "bg-nm-accent" : "bg-white/15 hover:bg-nm-accent/70"
                  }`}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
