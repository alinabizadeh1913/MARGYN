"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTool } from "@/providers/ToolProvider";
import { saveDrawing, loadDrawing } from "@/db";

export interface Stroke {
  points: number[][];
  color: string;
  size: number;
  isEraser: boolean;
}

type Kind = "margin" | "pdf";
type Mapper = (x: number, y: number) => [number, number];

interface Options {
  kind: Kind;
  filePath: string;
  page: number;
  toStored: Mapper;
  toScreen: Mapper;
}

const SAVE_DELAY_MS = 350;
const MIN_DIST_SQ = 0.4 * 0.4;
const SMOOTHING = 0.6;
const MAX_PREDICTED = 3;

function flatten(points: number[][], map: Mapper): number[] {
  const out = new Array<number>(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    const [x, y] = map(points[i][0], points[i][1]);
    out[i * 2] = x;
    out[i * 2 + 1] = y;
  }
  return out;
}

function paint(
  ctx: CanvasRenderingContext2D,
  p: number[],
  size: number,
  color: string,
  eraser: boolean,
) {
  const n = p.length >> 1;
  if (n === 0) return;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = size;
  ctx.globalCompositeOperation = eraser ? "destination-out" : "source-over";
  ctx.strokeStyle = eraser ? "#000" : color;

  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);

  if (n === 1) {
    ctx.lineTo(p[0] + 0.01, p[1]);
  } else if (eraser || n === 2) {
    for (let i = 1; i < n; i++) ctx.lineTo(p[i * 2], p[i * 2 + 1]);
  } else {
    for (let i = 1; i < n - 1; i++) {
      const cx = p[i * 2];
      const cy = p[i * 2 + 1];
      ctx.quadraticCurveTo(
        cx,
        cy,
        (cx + p[i * 2 + 2]) / 2,
        (cy + p[i * 2 + 3]) / 2,
      );
    }
    ctx.lineTo(p[(n - 1) * 2], p[(n - 1) * 2 + 1]);
  }
  ctx.stroke();
}

function eraseTail(
  ctx: CanvasRenderingContext2D,
  p: number[],
  from: number,
  size: number,
): number {
  const n = p.length >> 1;
  if (from >= n) return n;
  const s = Math.max(from - 1, 0);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = size;
  ctx.globalCompositeOperation = "destination-out";
  ctx.strokeStyle = "#000";
  ctx.beginPath();
  ctx.moveTo(p[s * 2], p[s * 2 + 1]);
  if (n - s === 1) ctx.lineTo(p[s * 2] + 0.01, p[s * 2 + 1]);
  else for (let i = s + 1; i < n; i++) ctx.lineTo(p[i * 2], p[i * 2 + 1]);
  ctx.stroke();
  return n;
}

export function useInkCanvas({
  kind,
  filePath,
  page,
  toStored,
  toScreen,
}: Options) {
  const staticRef = useRef<HTMLCanvasElement>(null);
  const dynamicRef = useRef<HTMLCanvasElement>(null);
  const staticCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const dynamicCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const { tool, color, size } = useTool();

  const cfg = useRef({
    tool,
    color,
    size,
    kind,
    filePath,
    page,
    toStored,
    toScreen,
  });
  cfg.current = { tool, color, size, kind, filePath, page, toStored, toScreen };

  const linesRef = useRef<Stroke[]>([]);
  const loadedRef = useRef(false);

  const strokeRef = useRef<Stroke | null>(null);
  const livePts = useRef<number[]>([]);
  const predRef = useRef<number[]>([]);
  const erasedRef = useRef(0);
  const activeId = useRef<number | null>(null);
  const rectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef(0);
  const penUntil = useRef(0);

  const pendingRef = useRef<{
    page: number;
    kind: Kind;
    filePath: string;
    lines: Stroke[];
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dpr = () => window.devicePixelRatio || 1;

  const getStaticCtx = useCallback(() => {
    if (!staticCtxRef.current)
      staticCtxRef.current = staticRef.current?.getContext("2d") ?? null;
    return staticCtxRef.current;
  }, []);
  const getDynamicCtx = useCallback(() => {
    if (!dynamicCtxRef.current)
      dynamicCtxRef.current =
        dynamicRef.current?.getContext("2d", { desynchronized: true }) ?? null;
    return dynamicCtxRef.current;
  }, []);

  const clearDynamic = useCallback(() => {
    const c = dynamicRef.current;
    const ctx = getDynamicCtx();
    if (!c || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
  }, [getDynamicCtx]);

  const redraw = useCallback(() => {
    const c = staticRef.current;
    const ctx = getStaticCtx();
    if (!c || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const d = dpr();
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const { toScreen } = cfg.current;
    for (const s of linesRef.current) {
      paint(ctx, flatten(s.points, toScreen), s.size, s.color, s.isEraser);
    }
  }, [getStaticCtx]);

  const resize = useCallback(
    (w: number, h: number, force = false) => {
      const s = staticRef.current;
      const d = dynamicRef.current;
      if (!s || !d) return;
      const r = dpr();
      const pw = Math.max(1, Math.round(w * r));
      const ph = Math.max(1, Math.round(h * r));
      let changed = force;
      for (const c of [s, d]) {
        if (c.width !== pw || c.height !== ph) {
          c.width = pw;
          c.height = ph;
          changed = true;
        }
        const sw = `${w}px`;
        const sh = `${h}px`;
        if (c.style.width !== sw) c.style.width = sw;
        if (c.style.height !== sh) c.style.height = sh;
      }
      if (changed) redraw();
    },
    [redraw],
  );

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const p = pendingRef.current;
    pendingRef.current = null;
    if (!p) return;
    Promise.resolve(saveDrawing(p.filePath, p.page, p.kind, p.lines))
      .then(() => window.dispatchEvent(new Event("margyn-data-changed")))
      .catch((err) => console.error("saveDrawing failed:", err));
  }, []);

  const scheduleSave = useCallback(() => {
    const { page, kind, filePath } = cfg.current;
    if (!filePath) return;
    pendingRef.current = {
      page,
      kind,
      filePath,
      lines: linesRef.current.slice(),
    };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, SAVE_DELAY_MS);
  }, [flush]);

  const dropPendingSave = useCallback(() => {
    pendingRef.current = null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    loadedRef.current = false;
    activeId.current = null;
    strokeRef.current = null;
    livePts.current = [];
    linesRef.current = [];
    clearDynamic();
    redraw();

    Promise.resolve(loadDrawing(filePath, page, kind))
      .then((saved) => {
        if (!alive) return;
        linesRef.current = Array.isArray(saved) ? saved : [];
        loadedRef.current = true;
        redraw();
      })
      .catch((err) => {
        console.error("loadDrawing failed:", err);
        if (alive) loadedRef.current = true;
      });

    return () => {
      alive = false;
      flush();
    };
  }, [filePath, page, kind, redraw, clearDynamic, flush]);

  useEffect(() => {
    const handleClear = () => {
      dropPendingSave();
      linesRef.current = [];
      redraw();
      clearDynamic();
    };
    const handleReload = () => {
      dropPendingSave();
      Promise.resolve(loadDrawing(filePath, page, kind))
        .then((saved) => {
          linesRef.current = Array.isArray(saved) ? saved : [];
          redraw();
        })
        .catch(console.error);
    };
    const handleHide = () => {
      if (document.visibilityState === "hidden") flush();
    };

    window.addEventListener("margyn-clear-all", handleClear);
    window.addEventListener(`margyn-clear-page-${page}`, handleClear);
    window.addEventListener("margyn-reload-all", handleReload);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", handleHide);
    return () => {
      window.removeEventListener("margyn-clear-all", handleClear);
      window.removeEventListener(`margyn-clear-page-${page}`, handleClear);
      window.removeEventListener("margyn-reload-all", handleReload);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", handleHide);
    };
  }, [page, kind, filePath, redraw, clearDynamic, flush, dropPendingSave]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const addPoint = useCallback((x: number, y: number, smooth = true) => {
    const p = livePts.current;
    const n = p.length;
    if (n) {
      const dx = x - p[n - 2];
      const dy = y - p[n - 1];
      const d2 = dx * dx + dy * dy;
      if (smooth ? d2 < MIN_DIST_SQ : d2 === 0) return;
      if (smooth) {
        x = p[n - 2] + dx * SMOOTHING;
        y = p[n - 1] + dy * SMOOTHING;
      }
    }
    p.push(x, y);
    strokeRef.current!.points.push(cfg.current.toStored(x, y));
  }, []);

  const frame = useCallback(() => {
    rafRef.current = 0;
    const s = strokeRef.current;
    if (!s) return;
    const p = livePts.current;
    const d = dpr();

    if (s.isEraser) {
      const ctx = getStaticCtx();
      if (!ctx) return;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      erasedRef.current = eraseTail(ctx, p, erasedRef.current, s.size);
      return;
    }

    const c = dynamicRef.current;
    const ctx = getDynamicCtx();
    if (!c || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(d, 0, 0, d, 0, 0);

    const base = p.length;
    const pr = predRef.current;
    for (let i = 0; i < pr.length; i++) p.push(pr[i]);
    paint(ctx, p, s.size, s.color, false);
    p.length = base;
  }, [getStaticCtx, getDynamicCtx]);

  const schedule = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(frame);
  }, [frame]);

  const finish = useCallback(() => {
    const s = strokeRef.current;
    if (!s || activeId.current === null) return;
    activeId.current = null;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }

    if (s.points.length) {
      const d = dpr();
      const sctx = getStaticCtx();
      if (sctx) {
        sctx.setTransform(d, 0, 0, d, 0, 0);
        if (s.isEraser)
          eraseTail(sctx, livePts.current, erasedRef.current, s.size);
        else paint(sctx, livePts.current, s.size, s.color, false);
      }
      linesRef.current.push(s);
      scheduleSave();
    }
    clearDynamic();

    strokeRef.current = null;
    livePts.current = [];
    predRef.current = [];
  }, [getStaticCtx, clearDynamic, scheduleSave]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!loadedRef.current || activeId.current !== null) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.pointerType === "touch" && performance.now() < penUntil.current)
        return;
      const c = dynamicRef.current;
      if (!c) return;

      c.setPointerCapture(e.pointerId);
      activeId.current = e.pointerId;
      if (e.pointerType === "pen") penUntil.current = Infinity;

      rectRef.current = c.getBoundingClientRect();
      const { tool, color, size } = cfg.current;
      const isEraser = tool === "eraser";
      strokeRef.current = {
        points: [],
        color: isEraser ? "transparent" : color,
        size: isEraser ? size * 3 : size,
        isEraser,
      };
      livePts.current = [];
      predRef.current = [];
      erasedRef.current = 0;

      addPoint(
        e.clientX - rectRef.current.left,
        e.clientY - rectRef.current.top,
        false,
      );
      schedule();
    },
    [addPoint, schedule],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerId !== activeId.current) return;
      const r = rectRef.current;
      if (!r) return;
      const ne = e.nativeEvent as PointerEvent & {
        getPredictedEvents?: () => PointerEvent[];
      };

      const co = ne.getCoalescedEvents?.();
      const list = co && co.length ? co : [ne];
      for (const ev of list) addPoint(ev.clientX - r.left, ev.clientY - r.top);

      const pr: number[] = [];
      if (!strokeRef.current?.isEraser) {
        const pe = ne.getPredictedEvents?.();
        if (pe) {
          for (let i = 0; i < pe.length && i < MAX_PREDICTED; i++) {
            pr.push(pe[i].clientX - r.left, pe[i].clientY - r.top);
          }
        }
      }
      predRef.current = pr;
      schedule();
    },
    [addPoint, schedule],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerId !== activeId.current) return;
      const r = rectRef.current;
      if (r) addPoint(e.clientX - r.left, e.clientY - r.top, false);
      if (e.pointerType === "pen") penUntil.current = performance.now() + 600;
      finish();
    },
    [addPoint, finish],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerId !== activeId.current) return;
      if (e.pointerType === "pen") penUntil.current = performance.now() + 600;
      finish();
    },
    [finish],
  );

  const onContextMenu = useCallback(
    (e: React.SyntheticEvent) => e.preventDefault(),
    [],
  );

  return {
    staticRef,
    dynamicRef,
    resize,
    redraw,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture: onPointerCancel,
      onContextMenu,
    },
  };
}
