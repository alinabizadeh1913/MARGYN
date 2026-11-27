"use client";

import { getKeyCode } from "@/lib/keys";
import { subscribeDpr } from "@/lib/dpr";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTool } from "@/providers/ToolProvider";
import { useContextMenu } from "@/providers/ContextMenuProvider";
import { saveDrawing, loadDrawing } from "@/db";
import {
  undoMarks,
  redoMarks,
  undoClearGroup,
  redoClearGroup,
  getActiveClearGroup,
  newGroupId,
} from "@/lib/clearHistory";
import {
  Undo2,
  Redo2,
  Trash2,
  Copy,
  LayoutPanelLeft,
  Eraser,
} from "lucide-react";
import {
  anchorPoint,
  cornerBox,
  elementBounds,
  eraseGeometry,
  findNearestAnchor,
  flatten,
  getHandles,
  HANDLE_CURSOR,
  hitStroke,
  inflate,
  isBindable,
  kindOf,
  resizeFn,
  rnd,
  snap45,
  strokeInRect,
  uid,
  unionBoxes,
  type Mapper,
} from "./inkGeometry";
import {
  ACCENT,
  drawAnchorHints,
  drawEraserRing,
  drawMarquee,
  drawSelectionUI,
  paintStroke,
  type SelInfo,
} from "./inkRender";
import { highlightRects } from "./inkText";
import type { PenCursorState } from "./useSoftPenCursor";
import type {
  Anchor,
  Binding,
  Box,
  HandleId,
  Stroke,
  TextLine,
} from "./inkTypes";

export type { Stroke } from "./inkTypes";

type Kind = "margin" | "pdf";

interface Options {
  kind: Kind;
  filePath: string;
  page: number;
  toStored: Mapper;
  toScreen: Mapper;
  textLines?: TextLine[];
  onDeletePage?: () => void;
}

/**
 * Persisting = JSON.stringify of the page + SQLite UPDATE + whole-DB export + IPC.
 * That is a synchronous hitch on the UI thread, so it must never land right
 * when the user resumes writing (Persian handwriting pauses ~0.5-1 s between
 * words/dots). Wait for a REAL idle gap instead.
 */
const SAVE_DELAY_MS = 1500;
/** How long after the last ink input the app still counts as "inking". */
const INK_IDLE_MS = 1500;
const MIN_DIST2 = 0.3 * 0.3;
/** Low-latency presentation for the ink canvases (set false if tearing is ever seen). */
const LOW_LATENCY_CANVAS = true;
/**
 * `pointerrawupdate` fires at the device rate (200-1000 Hz) and, as soon as a
 * listener exists, wakes the main thread for EVERY mouse/pen move even while
 * merely hovering. `getCoalescedEvents()` on the frame-aligned pointermove
 * already carries exactly the same samples, so drawing once per frame gives the
 * same ink with 3-5x fewer canvas flushes and no idle wake-ups.
 * Flip to true only to experiment.
 */
const USE_RAW_PEN = false;
const RAW_SUPPORTED =
  USE_RAW_PEN && typeof window !== "undefined" && "onpointerrawupdate" in window;
/** Timestamp of the last ink input; background saves are deferred while inking. */
function markInking() {
  if (typeof window !== "undefined")
    (window as any).__margynInkTs = performance.now();
}
const isInkingNow = () =>
  typeof window !== "undefined" &&
  performance.now() - ((window as any).__margynInkTs ?? -1e9) < INK_IDLE_MS;
const MAX_HISTORY = 100;
const MAX_PREDICTED = 3;
const PREDICT_TTL_MS = 40;

/** Tools that need continuous hover feedback (cursor updates / overlay rings / anchor hints). */
const HOVER_TOOLS = new Set(["select", "arrow", "eraser"]);

/** history-cache keys of canvases that are currently mounted */
const mountedHistoryKeys = new Set<string>();

const globalHistoryCache = new Map<
  string,
  { past: Stroke[][]; future: Stroke[][] }
>();

interface PenState {
  kind: "pen";
  pts: number[];
  done: number;
  curX: number;
  curY: number;
  headBox: Box | null;
  predTimer: ReturnType<typeof setTimeout> | null;
  color: string;
  size: number;
  pid: number;
  cx: number;
  cy: number;
  /** true once raw (unaligned) pen samples are being received */
  rawSeen?: boolean;
}

interface ShapeState {
  kind: "shape";
  tool: "rectangle" | "circle" | "line" | "arrow";
  sx: number;
  sy: number;
  cx: number;
  cy: number;
  startB: Binding | null;
  startHint: { box: Box; anchor: Anchor } | null;
  previewBox: Box | null;
  color: string;
  size: number;
  pid: number;
}

interface HlState {
  kind: "hl";
  ax: number;
  ay: number;
  cx: number;
  cy: number;
  previewBox: Box | null;
  pid: number;
}

interface EraseState {
  kind: "erase";
  R: number;
  lx: number;
  ly: number;
  snap: Stroke[];
  changed: boolean;
  pid: number;
  cx: number;
  cy: number;
  /** PERF: last drawn eraser-ring rect (so we clear only that, not the whole canvas). */
  ringBox: Box | null;
  /** PERF: set when strokes changed; the repaint happens once per pointer event. */
  dirty: boolean;
}

interface TransformState {
  kind: "move" | "resize";
  sx: number;
  sy: number;
  cx: number;
  cy: number;
  movers: Stroke[];
  deps: Stroke[];
  ids: Set<string>;
  box: Box | null;
  handle: HandleId | null;
  previewBox: Box | null;
  pid: number;
}

interface EndpointState {
  kind: "endpoint";
  stroke: Stroke;
  which: 0 | 2;
  cx: number;
  cy: number;
  previewBox: Box | null;
  pid: number;
}

interface MarqueeState {
  kind: "marquee";
  ax: number;
  ay: number;
  cx: number;
  cy: number;
  base: Set<string>;
  previewBox: Box | null;
  pid: number;
}

type DrawState =
  | PenState
  | ShapeState
  | HlState
  | EraseState
  | TransformState
  | EndpointState
  | MarqueeState;

interface BindHit {
  id: string;
  anchor: Anchor;
  box: Box;
}

let activeInk: { token: object; clearSelection: () => void } | null = null;

export function useInkCanvas({
  kind,
  filePath,
  page,
  toStored,
  toScreen,
  textLines,
  onDeletePage,
}: Options) {
  const staticRef = useRef<HTMLCanvasElement>(null);
  const dynamicRef = useRef<HTMLCanvasElement>(null);
  const staticCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const dynamicCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const { tool, color, size } = useTool();
  const { openMenu } = useContextMenu();

  const cfg = useRef({
    tool,
    color,
    size,
    kind,
    filePath,
    page,
    toStored,
    toScreen,
    textLines,
    onDeletePage,
  });
  cfg.current = {
    tool,
    color,
    size,
    kind,
    filePath,
    page,
    toStored,
    toScreen,
    textLines,
    onDeletePage,
  };

  const linesRef = useRef<Stroke[]>([]);
  const loadedRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const selRef = useRef<Set<string>>(new Set());
  const hiddenRef = useRef<Set<string> | null>(null);
  const hist = useRef<{ past: Stroke[][]; future: Stroke[][] }>({
    past: [],
    future: [],
  });
  // PERF: besides pts/box we lazily memoise the corner-box and kind per stroke,
  // so arrow-hover (findBind) no longer allocates + recomputes them for every
  // stroke on every frame. Entries are keyed by the (immutable) Stroke object
  // and invalidated by mapVer exactly like before.
  const geomCache = useRef(
    new WeakMap<
      Stroke,
      {
        v: number;
        pts: number[];
        box: Box;
        cb?: Box;
        k?: ReturnType<typeof kindOf>;
      }
    >(),
  );
  const mapVer = useRef(0);

  const ix = useRef<DrawState | null>(null);
  const hover = useRef<{ x: number; y: number } | null>(null);
  const mods = useRef({ shift: false, alt: false });
  const rectRef = useRef<DOMRect | null>(null);
  const rectScaleRef = useRef(1);

  // ============================================================
  // PERF: rAF-throttled hover processing refs
  // ============================================================
  const hoverRafRef = useRef(0);
  const hoverRectCacheRef = useRef<{
    rect: DOMRect;
    scale: number;
    time: number;
  } | null>(null);
  const lastHitPosRef = useRef<{ x: number; y: number } | null>(null);
  // PERF: raw client coords of the latest hover event; converted to canvas
  // coords (and the layout rect read) at most once per animation frame.
  const hoverRawRef = useRef<{ x: number; y: number } | null>(null);

  // ============================================================
  // PERF: rAF-batched previews for shape / highlight / move / resize /
  // endpoint / marquee, plus duplicate-position skipping.
  // ============================================================
  const previewRafRef = useRef(0);
  const lastPrevRef = useRef({ x: NaN, y: NaN, m: -1 });

  // ============================================================
  // PERF: selection memo (strokes + bounds), keyed on the identity of the
  // lines array, the selection Set and the coordinate-mapping version.
  // ============================================================
  const selCacheRef = useRef<{
    lines: Stroke[];
    sel: Set<string>;
    strokes: Stroke[];
    info: SelInfo | null;
    infoVer: number;
  } | null>(null);

  // ============================================================
  // PERF: idle-frame bounds tracking + signature skip
  // ============================================================
  const lastIdleBoundsRef = useRef<Box | null>(null);
  const lastIdleSigRef = useRef<string>("");

  // ============================================================
  // PERF: cursor React-state bailout
  // ============================================================
  const cursorRef = useRef<string>("default");

  const rafRef = useRef(0);
  const penUntil = useRef(0);
  const [hoverCursor, setHoverCursor] = useState("default");

  const pendingRef = useRef<{
    page: number;
    kind: Kind;
    filePath: string;
    lines: Stroke[];
  } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const api = useRef<any>(null);
  const me = useRef({
    token: {} as object,
    clearSelection: () => api.current?.clearSelection(),
  });

  const getCacheKey = useCallback(
    () => `${kind}:${filePath}:${page}`,
    [kind, filePath, page],
  );

  const MAX_HISTORY_CACHE_ENTRIES = 40;

  const saveHistoryToCache = useCallback(() => {
    const key = getCacheKey();
    globalHistoryCache.delete(key);
    globalHistoryCache.set(key, hist.current);

    if (globalHistoryCache.size > MAX_HISTORY_CACHE_ENTRIES) {
      const excess = globalHistoryCache.size - MAX_HISTORY_CACHE_ENTRIES;
      let removed = 0;
      for (const k of globalHistoryCache.keys()) {
        if (removed >= excess) break;
        if (k === key) continue;
        globalHistoryCache.delete(k);
        removed++;
      }
    }
  }, [getCacheKey]);

  const dpr = () => window.devicePixelRatio || 1;

  const computeRectScale = (c: HTMLCanvasElement, rect: DOMRect): number => {
    const cssW = c.offsetWidth;
    if (cssW > 0 && rect.width > 0) return rect.width / cssW;
    return 1;
  };

  const toCanvasCoords = (
    clientX: number,
    clientY: number,
    rect: DOMRect,
    scale = rectScaleRef.current,
  ) => {
    return [
      (clientX - rect.left) / scale,
      (clientY - rect.top) / scale,
    ] as const;
  };

  /**
   * PERF: cache the bounding rect for ~16ms so we do at most 1 layout read per
   * frame instead of one per pointermove. This alone cuts hover CPU by ~90% on
   * high-polling-rate mice / trackpads.
   */
  const getHoverRect = (c: HTMLCanvasElement) => {
    const now = performance.now();
    const cached = hoverRectCacheRef.current;
    if (cached && now - cached.time < 16) return cached;
    const rect = c.getBoundingClientRect();
    const scale = computeRectScale(c, rect);
    const entry = { rect, scale, time: now };
    hoverRectCacheRef.current = entry;
    return entry;
  };

  function setLiveTransform(ctx: CanvasRenderingContext2D) {
    const d = dpr();
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }

  function setStaticTransform(ctx: CanvasRenderingContext2D) {
    const d = dpr();
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }

  const getStaticCtx = () => {
    if (!staticCtxRef.current)
      staticCtxRef.current =
        staticRef.current?.getContext("2d", {
          desynchronized: LOW_LATENCY_CANVAS,
        }) ?? null;
    return staticCtxRef.current;
  };
  const getDynamicCtx = () => {
    if (!dynamicCtxRef.current)
      dynamicCtxRef.current =
        dynamicRef.current?.getContext("2d", {
          desynchronized: LOW_LATENCY_CANVAS,
        }) ?? null;
    return dynamicCtxRef.current;
  };

  const flush = useCallback((): Promise<void> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const p = pendingRef.current;
    pendingRef.current = null;
    if (!p) return Promise.resolve();
    return Promise.resolve(saveDrawing(p.filePath, p.page, p.kind, p.lines))
      .then((ok) => {
        if (ok === false) {
          window.dispatchEvent(
            new CustomEvent("margyn-save-error", {
              detail: "Failed to save drawing. Please try again.",
            }),
          );
        } else {
          window.dispatchEvent(new Event("margyn-data-changed"));
        }
      })
      .catch(() => {
        window.dispatchEvent(
          new CustomEvent("margyn-save-error", {
            detail: "Failed to save drawing. Please try again.",
          }),
        );
      });
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
    // PERF: never serialise/encrypt/export while the pen is moving -> no hitches.
    const run = () => {
      if (isInkingNow()) {
        timerRef.current = setTimeout(run, 400);
        return;
      }
      timerRef.current = null;
      const ric = (window as any).requestIdleCallback as
        | ((cb: () => void, o?: { timeout: number }) => number)
        | undefined;
      // Run inside a real idle period (falls back to a plain call).
      if (ric) ric(() => (isInkingNow() ? scheduleSaveRetry() : void flush()), { timeout: 2000 });
      else void flush();
    };
    const scheduleSaveRetry = () => {
      timerRef.current = setTimeout(run, 400);
    };
    timerRef.current = setTimeout(run, SAVE_DELAY_MS);

    window.dispatchEvent(new Event("margyn-data-changed"));
  }, [flush]);

  const dropPendingSave = useCallback(() => {
    pendingRef.current = null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const evt = e as CustomEvent<{ register: (p: Promise<void>) => void }>;
      const promise = flush();
      if (evt.detail && typeof evt.detail.register === "function") {
        evt.detail.register(promise);
      }
    };
    window.addEventListener("margyn-flush-ink", handler);
    return () => window.removeEventListener("margyn-flush-ink", handler);
  }, [flush]);

  function geom(s: Stroke) {
    let g = geomCache.current.get(s);
    if (!g || g.v !== mapVer.current) {
      const pts = flatten(s.points, cfg.current.toScreen);
      g = { v: mapVer.current, pts, box: elementBounds(s, pts) };
      geomCache.current.set(s, g);
    }
    return g;
  }

  const store = (x: number, y: number): number[] => {
    const [a, b] = cfg.current.toStored(x, y);
    return [rnd(a), rnd(b)];
  };
  const toStoredPts = (q: number[]): number[][] => {
    const out: number[][] = new Array(q.length >> 1);
    for (let i = 0; i < out.length; i++) out[i] = store(q[i * 2], q[i * 2 + 1]);
    return out;
  };

  function redrawStatic() {
    const c = staticRef.current;
    const ctx = getStaticCtx();
    if (!c || !ctx) return;

    const d = dpr();
    const cw = c.width / d;
    const ch = c.height / d;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    setStaticTransform(ctx);

    const hide = hiddenRef.current;
    const M = 80;

    for (const s of linesRef.current) {
      if (hide && s.id && hide.has(s.id)) continue;

      const g = geom(s);
      const b = g.box;

      if (b.x + b.w + M < 0 || b.x - M > cw) continue;
      if (b.y + b.h + M < 0 || b.y - M > ch) continue;

      paintStroke(ctx, s, g.pts);
    }
  }

  function clearLive(b: Box | null) {
    if (!b) return;
    const ctx = getDynamicCtx();
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const d = dpr();
    ctx.clearRect(
      Math.floor(b.x * d),
      Math.floor(b.y * d),
      Math.ceil(b.w * d),
      Math.ceil(b.h * d),
    );
  }

  function clearLiveAll() {
    const c = dynamicRef.current;
    const ctx = getDynamicCtx();
    if (!c || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    // Reset idle tracking so the next idle frame redraws correctly.
    lastIdleBoundsRef.current = null;
    lastIdleSigRef.current = "";
  }

  const resize = useCallback((w: number, h: number, force = false) => {
    hoverRectCacheRef.current = null;
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
    if (changed) {
      mapVer.current++;
      ix.current = null;
      redrawStatic();
      clearLiveAll();
    }
  }, []);

  function pushHistory(prev: Stroke[]) {
    const h = hist.current;
    h.past.push(prev);
    if (h.past.length > MAX_HISTORY) h.past.shift();
    h.future = [];
    saveHistoryToCache();
  }

  function commitLines(next: Stroke[]) {
    pushHistory(linesRef.current);
    linesRef.current = next;
    scheduleSave();
  }

  function sanitize(lines: Stroke[]): Stroke[] {
    const ids = new Set(lines.map((s) => s.id));
    return lines.map((s) => {
      const a = s.start && !ids.has(s.start.id);
      const b = s.end && !ids.has(s.end.id);
      return a || b
        ? { ...s, start: a ? null : s.start, end: b ? null : s.end }
        : s;
    });
  }

  function afterHistoryChange() {
    const ids = new Set(linesRef.current.map((s) => s.id!));
    // PERF: never mutate the selection Set in place (the selection memo is
    // keyed on its identity) - replace it only when something was dropped.
    const keep: string[] = [];
    selRef.current.forEach((id) => {
      if (ids.has(id)) keep.push(id);
    });
    if (keep.length !== selRef.current.size) selRef.current = new Set(keep);
    hiddenRef.current = null;
    scheduleSave();
    redrawStatic();
    clearLiveAll();
    scheduleIdle();
  }

  function undo(silent = false) {
    const h = hist.current;
    if (!loadedRef.current || ix.current || !h.past.length) return;
    const gid = undoMarks.get(h.past[h.past.length - 1]);
    if (gid) redoMarks.set(linesRef.current, gid);
    h.future.push(linesRef.current);
    linesRef.current = h.past.pop()!;
    saveHistoryToCache();
    afterHistoryChange();
    if (gid && silent !== true) void undoClearGroup(gid, me.current.token);
  }

  function redo(silent = false) {
    const h = hist.current;
    if (!loadedRef.current || ix.current || !h.future.length) return;
    const gid = redoMarks.get(h.future[h.future.length - 1]);
    h.past.push(linesRef.current);
    linesRef.current = h.future.pop()!;
    saveHistoryToCache();
    afterHistoryChange();
    if (gid && silent !== true) void redoClearGroup(gid, me.current.token);
  }

  function findBind(x: number, y: number, excludeId?: string): BindHit | null {
    const lines = linesRef.current;
    for (let i = lines.length - 1; i >= 0; i--) {
      const s = lines[i];
      if (s.id === excludeId) continue;
      const g = geom(s);
      const k = g.k ?? (g.k = kindOf(s));
      if (!isBindable(k)) continue;
      const b = g.cb ?? (g.cb = cornerBox(g.pts));
      const inside = x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
      let d: number;
      if (inside) d = Math.min(x - b.x, b.x + b.w - x, y - b.y, b.y + b.h - y);
      else {
        const dx = Math.max(b.x - x, 0, x - (b.x + b.w));
        const dy = Math.max(b.y - y, 0, y - (b.y + b.h));
        d = Math.hypot(dx, dy);
      }
      const near = findNearestAnchor(b, x, y);
      if (d <= 18 || near.dist <= 30)
        return { id: s.id!, anchor: near.anchor, box: b };
    }
    return null;
  }

  function hitTop(x: number, y: number): Stroke | null {
    const lines = linesRef.current;
    for (let i = lines.length - 1; i >= 0; i--) {
      const s = lines[i];
      const g = geom(s);
      // PERF: cheap bounding-box reject before the (expensive) exact hit test.
      // The pad is deliberately generous (hit tolerance 6 + stroke size).
      const b = g.box;
      const pad = 8 + (s.size || 0);
      if (
        x < b.x - pad ||
        x > b.x + b.w + pad ||
        y < b.y - pad ||
        y > b.y + b.h + pad
      )
        continue;
      if (hitStroke(s, g.pts, x, y, 6)) return s;
    }
    return null;
  }

  function selected(): Stroke[] {
    const sel = selRef.current;
    if (!sel.size) return [];
    const lines = linesRef.current;
    const c = selCacheRef.current;
    if (c && c.lines === lines && c.sel === sel) return c.strokes;
    const strokes = lines.filter((s) => s.id && sel.has(s.id));
    selCacheRef.current = { lines, sel, strokes, info: null, infoVer: -1 };
    return strokes;
  }

  function computeSelectionInfo(over?: Map<string, number[]>): SelInfo | null {
    const sel = selected();
    if (!sel.length) return null;
    const pts = (s: Stroke) => over?.get(s.id!) ?? geom(s).pts;
    const boxes = sel.map((s) => elementBounds(s, pts(s)));
    if (sel.length === 1) {
      const k = kindOf(sel[0]);
      if (k === "line" || k === "arrow") {
        const p = pts(sel[0]);
        return {
          boxes,
          bbox: null,
          endpoints: [
            [p[0], p[1]],
            [p[2], p[3]],
          ],
        };
      }
    }
    return { boxes, bbox: unionBoxes(boxes), endpoints: null };
  }

  function selectionInfo(over?: Map<string, number[]>): SelInfo | null {
    // Live drag previews pass overridden points: always compute those fresh.
    if (over) return computeSelectionInfo(over);
    const sel = selected();
    if (!sel.length) return null;
    const c = selCacheRef.current!;
    if (c.infoVer !== mapVer.current) {
      c.info = computeSelectionInfo();
      c.infoVer = mapVer.current;
    }
    return c.info;
  }

  type HandleHit =
    | { type: "handle"; id: HandleId }
    | { type: "end"; which: 0 | 2 }
    | null;

  function hitHandle(x: number, y: number): HandleHit {
    const info = selectionInfo();
    if (!info) return null;
    if (info.endpoints) {
      for (let i = 0; i < 2; i++)
        if (Math.hypot(x - info.endpoints[i][0], y - info.endpoints[i][1]) <= 9)
          return { type: "end", which: (i * 2) as 0 | 2 };
      return null;
    }
    if (info.bbox)
      for (const h of getHandles(info.bbox))
        if (Math.abs(x - h.x) <= 8 && Math.abs(y - h.y) <= 8)
          return { type: "handle", id: h.id };
    return null;
  }

  function findDeps(ids: Set<string>): Stroke[] {
    return linesRef.current.filter(
      (s) =>
        s.tool === "arrow" &&
        !ids.has(s.id!) &&
        ((s.start && ids.has(s.start.id)) || (s.end && ids.has(s.end.id))),
    );
  }

  function computeTransformed(
    movers: Stroke[],
    deps: Stroke[],
    fn: (x: number, y: number) => [number, number],
  ): Map<string, number[]> {
    const out = new Map<string, number[]>();
    for (const s of movers) {
      const p = geom(s).pts;
      const q = new Array<number>(p.length);
      for (let i = 0; i < p.length; i += 2) {
        const r = fn(p[i], p[i + 1]);
        q[i] = r[0];
        q[i + 1] = r[1];
      }
      out.set(s.id!, q);
    }
    for (const a of movers.concat(deps)) {
      if (a.tool !== "arrow") continue;
      const q = out.get(a.id!) ?? geom(a).pts.slice();
      const ends: [Binding | null | undefined, number][] = [
        [a.start, 0],
        [a.end, 2],
      ];
      for (const [b, idx] of ends) {
        if (!b) continue;
        const sp = out.get(b.id);
        if (!sp) continue;
        const pt = anchorPoint(cornerBox(sp), b.anchor);
        q[idx] = pt[0];
        q[idx + 1] = pt[1];
      }
      out.set(a.id!, q);
    }
    return out;
  }

  function transformLines(
    ids: Set<string>,
    fn: (x: number, y: number) => [number, number],
  ): Stroke[] {
    const movers = linesRef.current.filter((s) => ids.has(s.id!));
    const deps = findDeps(ids);
    const out = computeTransformed(movers, deps, fn);
    return linesRef.current.map((s) => {
      const q = out.get(s.id!);
      if (!q) return s;
      const ns: Stroke = { ...s, points: toStoredPts(q) };
      if (ids.has(s.id!) && s.tool === "arrow") {
        if (s.start && !out.has(s.start.id)) ns.start = null;
        if (s.end && !out.has(s.end.id)) ns.end = null;
      }
      return ns;
    });
  }

  function transformFn(
    X: TransformState,
  ): (x: number, y: number) => [number, number] {
    if (X.kind === "move") {
      let dx = X.cx - X.sx,
        dy = X.cy - X.sy;
      if (mods.current.shift) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      return (x, y) => [x + dx, y + dy];
    }
    return resizeFn(
      X.box!,
      X.handle!,
      X.cx,
      X.cy,
      mods.current.shift,
      mods.current.alt,
    );
  }

  function eraseSegment(
    X: EraseState,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ) {
    const R = X.R;
    const bx0 = Math.min(x0, x1) - R,
      by0 = Math.min(y0, y1) - R,
      bx1 = Math.max(x0, x1) + R,
      by1 = Math.max(y0, y1) + R;
    const lines = linesRef.current;
    let next: Stroke[] | null = null;
    let anyChange = false;
    for (let i = 0; i < lines.length; i++) {
      const s = lines[i];
      const g = geom(s);
      const b = g.box;
      if (b.x > bx1 || b.x + b.w < bx0 || b.y > by1 || b.y + b.h < by0) {
        if (next) next.push(s);
        continue;
      }
      const res = eraseGeometry(s, g.pts, x0, y0, x1, y1, R);
      if (res === null) {
        if (next) next.push(s);
        continue;
      }
      anyChange = true;
      if (!next) next = lines.slice(0, i);
      if (res === "remove") continue;
      const k = kindOf(s);
      if (k === "highlight-rect") {
        next.push({ ...s, points: toStoredPts(res[0]) });
      } else {
        res.forEach((part: number[], j: number) =>
          next!.push({
            ...s,
            id: j === 0 ? s.id : uid(),
            points: toStoredPts(part),
          }),
        );
      }
    }
    if (anyChange) {
      linesRef.current = next!;
      X.changed = true;
      X.dirty = true;
      // The repaint itself is done once per pointer event by flushEraseDirty()
      // (previously a FULL redrawStatic() ran for every coalesced sample).
    }
  }

  function flushEraseDirty(X: EraseState) {
    if (!X.dirty) return;
    X.dirty = false;
    redrawStatic();
  }

  function eraserRingBox(x: number, y: number, R: number): Box {
    const p = R + 6;
    return { x: x - p, y: y - p, w: p * 2, h: p * 2 };
  }

  function shapeGeom(X: ShapeState) {
    const { tool: t, sx, sy, cx, cy, startB } = X;
    const { shift, alt } = mods.current;
    if (t === "line" || t === "arrow") {
      let ex = cx,
        ey = cy;
      let endB: Binding | null = null;
      let hint: BindHit | null = null;
      if (t === "arrow") {
        const b = findBind(cx, cy, startB?.id);
        if (b) {
          hint = b;
          endB = { id: b.id, anchor: b.anchor };
          [ex, ey] = anchorPoint(b.box, b.anchor);
        }
      }
      if (!endB && shift) {
        const [dx, dy] = snap45(cx - sx, cy - sy);
        ex = sx + dx;
        ey = sy + dy;
      }
      return { p: [sx, sy, ex, ey], endB, hint };
    }
    let dx = cx - sx,
      dy = cy - sy;
    if (shift) {
      const m = Math.max(Math.abs(dx), Math.abs(dy));
      dx = dx < 0 ? -m : m;
      dy = dy < 0 ? -m : m;
    }
    const p = alt
      ? [sx - dx, sy - dy, sx + dx, sy + dy]
      : [sx, sy, sx + dx, sy + dy];
    return { p, endB: null as Binding | null, hint: null as BindHit | null };
  }

  function penCommit(X: PenState) {
    const p = X.pts;
    const n = p.length >> 1;
    if (X.done > n - 2) return;
    const ctx = getStaticCtx();
    if (!ctx) return;
    setStaticTransform(ctx);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = X.size;
    ctx.strokeStyle = X.color;
    ctx.beginPath();
    ctx.moveTo(X.curX, X.curY);
    let i = X.done;
    for (; i <= n - 2; i++) {
      const mx = (p[i * 2] + p[i * 2 + 2]) / 2;
      const my = (p[i * 2 + 1] + p[i * 2 + 3]) / 2;
      ctx.quadraticCurveTo(p[i * 2], p[i * 2 + 1], mx, my);
      X.curX = mx;
      X.curY = my;
    }
    ctx.stroke();
    X.done = i;
  }

  function drawPenHead(X: PenState, pred: number[]) {
    const ctx = getDynamicCtx();
    if (!ctx) return;
    if (X.headBox) clearLive(X.headBox);

    const p = X.pts;
    const n = p.length >> 1;
    const lx = p[(n - 1) * 2];
    const ly = p[(n - 1) * 2 + 1];

    setLiveTransform(ctx);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = X.size;
    ctx.strokeStyle = X.color;
    ctx.fillStyle = X.color;

    let x0 = Math.min(X.curX, lx),
      x1 = Math.max(X.curX, lx),
      y0 = Math.min(X.curY, ly),
      y1 = Math.max(X.curY, ly);

    if (n === 1 && !pred.length) {
      ctx.beginPath();
      ctx.arc(lx, ly, X.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(X.curX, X.curY);
      let ax = lx,
        ay = ly;
      for (let i = 0; i < pred.length; i += 2) {
        const bx = pred[i],
          by = pred[i + 1];
        ctx.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2);
        if (bx < x0) x0 = bx;
        if (bx > x1) x1 = bx;
        if (by < y0) y0 = by;
        if (by > y1) y1 = by;
        ax = bx;
        ay = by;
      }
      ctx.lineTo(ax, ay);
      ctx.stroke();
    }

    const pad = X.size / 2 + 3;
    let bx0 = Math.floor(x0 - pad);
    let by0 = Math.floor(y0 - pad);
    let bx1 = bx0 + Math.ceil(x1 - x0 + pad * 2) + 1;
    let by1 = by0 + Math.ceil(y1 - y0 + pad * 2) + 1;

    // Paint the pen icon INTO the canvas, hot-spot exactly on the ink tip (the
    // predicted tip when there is one), in the same draw call as the ink.
    const pc = (dynamicRef.current as unknown as {
      __penCursor?: PenCursorState;
    } | null)?.__penCursor;
    if (pc && pc.inStroke) {
      const bmp = pc.getBitmap(dpr());
      if (bmp) {
        const tipX = pred.length ? pred[pred.length - 2] : lx;
        const tipY = pred.length ? pred[pred.length - 1] : ly;
        // snap to whole device pixels so the bitmap stays razor sharp
        const dd = dpr();
        const ox = Math.round((tipX - pc.hx) * dd) / dd;
        const oy = Math.round((tipY - pc.hy) * dd) / dd;
        ctx.drawImage(bmp, ox, oy, 32, 32);
        bx0 = Math.min(bx0, Math.floor(ox) - 1);
        by0 = Math.min(by0, Math.floor(oy) - 1);
        bx1 = Math.max(bx1, Math.ceil(ox + 32) + 1);
        by1 = Math.max(by1, Math.ceil(oy + 32) + 1);
      }
    }

    X.headBox = { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 };
  }

  function drawShapePreview(X: ShapeState) {
    const ctx = getDynamicCtx();
    if (!ctx) return;
    if (X.previewBox) clearLive(X.previewBox);
    setLiveTransform(ctx);

    const g = shapeGeom(X);
    const stroke: Stroke = {
      points: [],
      color: X.color,
      size: X.size,
      tool: X.tool,
      start: X.startB,
      end: g.endB,
    };
    paintStroke(ctx, stroke, g.p);
    if (X.startHint)
      drawAnchorHints(ctx, X.startHint.box, X.startB?.anchor ?? null);
    if (g.hint) drawAnchorHints(ctx, g.hint.box, g.endB?.anchor ?? null);

    const b = elementBounds(stroke, g.p);
    X.previewBox = inflate(b, 6);
  }

  function drawHlPreview(X: HlState) {
    const ctx = getDynamicCtx();
    if (!ctx) return;
    if (X.previewBox) clearLive(X.previewBox);
    setLiveTransform(ctx);

    const rects = highlightRects(
      cfg.current.textLines || [],
      X.ax,
      X.ay,
      X.cx,
      X.cy,
      cfg.current.size,
    );
    if (!rects.length) {
      X.previewBox = null;
      return;
    }
    const flat: number[] = [];
    for (const r of rects) flat.push(r[0], r[1], r[2], r[3]);
    paintStroke(
      ctx,
      { points: [], color: cfg.current.color, size: 1, tool: "highlight-rect" },
      flat,
    );
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const r of rects) {
      if (r[0] < x0) x0 = r[0];
      if (r[1] < y0) y0 = r[1];
      if (r[2] > x1) x1 = r[2];
      if (r[3] > y1) y1 = r[3];
    }
    X.previewBox = { x: x0 - 3, y: y0 - 3, w: x1 - x0 + 6, h: y1 - y0 + 6 };
  }

  function drawTransformPreview(X: TransformState) {
    const ctx = getDynamicCtx();
    if (!ctx) return;
    if (X.previewBox) clearLive(X.previewBox);
    setLiveTransform(ctx);

    const fn = transformFn(X);
    const out = computeTransformed(X.movers, X.deps, fn);
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const s of X.movers.concat(X.deps)) {
      const q = out.get(s.id!);
      if (q) {
        paintStroke(ctx, s, q);
        const b = elementBounds(s, q);
        if (b.x < x0) x0 = b.x;
        if (b.y < y0) y0 = b.y;
        if (b.x + b.w > x1) x1 = b.x + b.w;
        if (b.y + b.h > y1) y1 = b.y + b.h;
      }
    }
    const info = selectionInfo(out);
    if (info) drawSelectionUI(ctx, info);
    if (x0 === Infinity) {
      X.previewBox = null;
      return;
    }
    X.previewBox = { x: x0 - 20, y: y0 - 20, w: x1 - x0 + 40, h: y1 - y0 + 40 };
  }

  function drawEndpointPreview(X: EndpointState) {
    const ctx = getDynamicCtx();
    if (!ctx) return;
    if (X.previewBox) clearLive(X.previewBox);
    setLiveTransform(ctx);

    const s = X.stroke;
    const base = geom(s).pts;
    const q = base.slice();
    let nx = X.cx,
      ny = X.cy;
    let bind: Binding | null = null;
    let hint: BindHit | null = null;
    if (kindOf(s) === "arrow") {
      const b = findBind(nx, ny);
      if (b) {
        hint = b;
        bind = { id: b.id, anchor: b.anchor };
        [nx, ny] = anchorPoint(b.box, b.anchor);
      }
    }
    if (!bind && mods.current.shift) {
      const o = X.which === 0 ? 2 : 0;
      const [dx, dy] = snap45(nx - q[o], ny - q[o + 1]);
      nx = q[o] + dx;
      ny = q[o + 1] + dy;
    }
    q[X.which] = nx;
    q[X.which + 1] = ny;
    const ns: Stroke = {
      ...s,
      start: X.which === 0 ? bind : s.start,
      end: X.which === 2 ? bind : s.end,
    };
    paintStroke(ctx, ns, q);
    if (hint) drawAnchorHints(ctx, hint.box, bind?.anchor ?? null);
    const info = selectionInfo(new Map([[s.id!, q]]));
    if (info) drawSelectionUI(ctx, info);
    const b = elementBounds(ns, q);
    X.previewBox = inflate(b, 12);
  }

  function scheduleIdle() {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(idleFrame);
  }

  /**
   * PERF: fully rewritten idle frame.
   *
   * Old behaviour: on EVERY hover pointermove we cleared the ENTIRE dynamic
   * canvas (potentially millions of pixels at devicePixelRatio 2×) and
   * redrew the whole overlay. On systems with high-polling-rate mice / large
   * canvases this was the dominant CPU cost of the whole app.
   *
   * New behaviour:
   *   • We compute a cheap signature of what should be on screen.
   *   • If the signature is unchanged since the last frame → do nothing.
   *   • Otherwise clear ONLY the previous bounds and redraw the new overlay.
   *
   * Visual result: identical. CPU cost: typically 0 (no-op) or a tiny
   * (~40×40 px) clear+draw for the eraser ring.
   */
  function idleFrame() {
    rafRef.current = 0;
    if (ix.current) return;
    const ctx = getDynamicCtx();
    if (!ctx) return;

    const t = cfg.current.tool;
    let sig = "";
    let drawFn: (() => Box | null) | null = null;

    if (t === "select") {
      const info = selectionInfo();
      if (!info) {
        sig = "";
      } else if (info.bbox) {
        const b = info.bbox;
        // Cheap content hash — no JSON.stringify per frame
        let hash = 0;
        for (const bx of info.boxes) {
          hash = (hash * 31 + bx.x + bx.y + bx.w + bx.h) | 0;
        }
        sig = `s:${info.boxes.length}:${hash}`;
        drawFn = () => {
          drawSelectionUI(ctx, info);
          const pad = 10;
          return {
            x: b.x - pad,
            y: b.y - pad,
            w: b.w + pad * 2,
            h: b.h + pad * 2,
          };
        };
      } else if (info.endpoints) {
        let hash = 0;
        let x0 = Infinity,
          y0 = Infinity,
          x1 = -Infinity,
          y1 = -Infinity;
        for (const [ex, ey] of info.endpoints) {
          hash = (hash * 31 + ex + ey) | 0;
          if (ex < x0) x0 = ex;
          if (ex > x1) x1 = ex;
          if (ey < y0) y0 = ey;
          if (ey > y1) y1 = ey;
        }
        sig = `e:${hash}`;
        drawFn = () => {
          drawSelectionUI(ctx, info);
          return { x: x0 - 10, y: y0 - 10, w: x1 - x0 + 20, h: y1 - y0 + 20 };
        };
      }
    } else if (t === "arrow" && hover.current) {
      const b = findBind(hover.current.x, hover.current.y);
      if (b) {
        sig = `a:${b.id}:${b.anchor}`;
        const hb = b.box;
        drawFn = () => {
          drawAnchorHints(ctx, hb, b.anchor);
          const pad = 10;
          return {
            x: hb.x - pad,
            y: hb.y - pad,
            w: hb.w + pad * 2,
            h: hb.h + pad * 2,
          };
        };
      }
    } else if (t === "eraser" && hover.current) {
      const h = hover.current;
      const r = (cfg.current.size * 3) / 2;
      sig = `r:${h.x.toFixed(1)}:${h.y.toFixed(1)}:${r}`;
      drawFn = () => {
        drawEraserRing(ctx, h.x, h.y, r);
        return { x: h.x - r - 2, y: h.y - r - 2, w: r * 2 + 4, h: r * 2 + 4 };
      };
    }

    if (sig === lastIdleSigRef.current) return; // Nothing changed — zero cost.

    if (lastIdleBoundsRef.current) clearLive(lastIdleBoundsRef.current);
    lastIdleBoundsRef.current = null;
    lastIdleSigRef.current = sig;

    if (drawFn) {
      setLiveTransform(ctx);
      lastIdleBoundsRef.current = drawFn();
    }
  }

  /**
   * PERF: setCursor now uses a ref to bail out BEFORE calling React's
   * setState. This prevents React from scheduling a re-render check on every
   * single mouse move (which was a non-trivial cost on 120–1000 Hz devices).
   */
  const setCursor = (v: string) => {
    if (v !== cursorRef.current) {
      cursorRef.current = v;
      setHoverCursor(v);
    }
  };

  function setActive() {
    const m = me.current;
    if (activeInk && activeInk.token !== m.token) activeInk.clearSelection();
    activeInk = m;
  }

  function addPenPoint(X: PenState, x: number, y: number): boolean {
    const p = X.pts;
    const n = p.length;
    if (n) {
      const dx = x - p[n - 2];
      const dy = y - p[n - 1];
      if (dx * dx + dy * dy < MIN_DIST2) return false;
    }
    p.push(x, y);
    return true;
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (ix.current) {
      // A pointerdown while a stroke is "active" means its pointerup/cancel was
      // lost (driver glitch, focus change, pen leaving the digitiser range...).
      // Never let that freeze writing: commit what we have and start fresh.
      const old = ix.current as unknown as {
        pid: number;
        cx?: number;
        cy?: number;
      };
      if (old.pid === e.pointerId || e.pointerType === "pen") {
        const r0 = rectRef.current;
        const sc = rectScaleRef.current || 1;
        finish(
          {
            pointerId: old.pid,
            clientX: r0 ? r0.left + (old.cx ?? 0) * sc : 0,
            clientY: r0 ? r0.top + (old.cy ?? 0) * sc : 0,
            shiftKey: false,
            altKey: false,
            pointerType: e.pointerType,
            nativeEvent: {},
            preventDefault: () => {},
            stopPropagation: () => {},
          } as unknown as React.PointerEvent<HTMLCanvasElement>,
          true,
        );
        if (ix.current) ix.current = null;
      } else {
        return;
      }
    }
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.pointerType === "touch" && performance.now() < penUntil.current)
      return;
    const c = dynamicRef.current;
    if (!c) return;

    hasDrawnRef.current = true;
    markInking();

    const t = cfg.current.tool;
    const rect = c.getBoundingClientRect();
    rectRef.current = rect;
    rectScaleRef.current = computeRectScale(c, rect);
    hoverRectCacheRef.current = {
      rect,
      scale: rectScaleRef.current,
      time: performance.now(),
    };
    const [x, y] = toCanvasCoords(e.clientX, e.clientY, rect);
    mods.current = { shift: e.shiftKey, alt: e.altKey };
    setActive();
    try {
      c.setPointerCapture(e.pointerId);
    } catch {}
    if (e.pointerType === "pen") penUntil.current = Infinity;
    hover.current = null;
    hoverRawRef.current = null;
    lastPrevRef.current.x = NaN;
    lastPrevRef.current.y = NaN;
    lastPrevRef.current.m = -1;
    clearLiveAll();

    const { color, size } = cfg.current;

    switch (t) {
      case "pen": {
        const X: PenState = {
          kind: "pen",
          pts: [x, y],
          done: 1,
          curX: x,
          curY: y,
          headBox: null,
          predTimer: null,
          color,
          size,
          pid: e.pointerId,
          cx: x,
          cy: y,
        };
        ix.current = X;
        if (e.pointerType === "pen") {
          const pc = (c as unknown as { __penCursor?: PenCursorState })
            .__penCursor;
          if (pc && pc.img) {
            pc.active = () => ix.current?.kind === "pen";
            pc.setStroke(true);
          }
        }
        drawPenHead(X, []);
        break;
      }

      case "eraser": {
        const X: EraseState = {
          kind: "erase",
          R: (size * 3) / 2,
          lx: x,
          ly: y,
          snap: linesRef.current,
          changed: false,
          pid: e.pointerId,
          cx: x,
          cy: y,
          ringBox: null,
          dirty: false,
        };
        ix.current = X;
        eraseSegment(X, x, y, x, y);
        flushEraseDirty(X);
        const ctx = getDynamicCtx()!;
        setLiveTransform(ctx);
        drawEraserRing(ctx, x, y, X.R);
        X.ringBox = eraserRingBox(x, y, X.R);
        break;
      }

      case "highlighter": {
        const X: HlState = {
          kind: "hl",
          ax: x,
          ay: y,
          cx: x,
          cy: y,
          previewBox: null,
          pid: e.pointerId,
        };
        ix.current = X;
        drawHlPreview(X);
        break;
      }

      case "rectangle":
      case "circle":
      case "line":
      case "arrow": {
        let sx = x,
          sy = y;
        let startB: Binding | null = null;
        let startHint: BindHit | null = null;
        if (t === "arrow") {
          const b = findBind(x, y);
          if (b) {
            startHint = b;
            startB = { id: b.id, anchor: b.anchor };
            [sx, sy] = anchorPoint(b.box, b.anchor);
          }
        }
        const X: ShapeState = {
          kind: "shape",
          tool: t,
          sx,
          sy,
          cx: x,
          cy: y,
          startB,
          startHint,
          previewBox: null,
          color,
          size,
          pid: e.pointerId,
        };
        ix.current = X;
        break;
      }

      case "select": {
        const h = hitHandle(x, y);
        if (h && h.type === "end") {
          const s = selected()[0];
          hiddenRef.current = new Set([s.id!]);
          redrawStatic();
          const X: EndpointState = {
            kind: "endpoint",
            stroke: s,
            which: h.which,
            cx: x,
            cy: y,
            previewBox: null,
            pid: e.pointerId,
          };
          ix.current = X;
        } else if (h && h.type === "handle") {
          const info = selectionInfo()!;
          startTransform("resize", x, y, info.bbox!, h.id, e.pointerId);
        } else {
          const hit = hitTop(x, y);
          if (hit) {
            const id = hit.id!;
            if (e.shiftKey) {
              if (selRef.current.has(id)) {
                {
                  const ns = new Set(selRef.current);
                  ns.delete(id);
                  selRef.current = ns;
                }
                try {
                  c.releasePointerCapture(e.pointerId);
                } catch {}
                scheduleIdle();
                if (e.pointerType === "pen")
                  penUntil.current = performance.now() + 600;
                return;
              }
              selRef.current = new Set(selRef.current).add(id);
            } else if (!selRef.current.has(id)) {
              selRef.current = new Set([id]);
            }
            startTransform("move", x, y, null, null, e.pointerId);
          } else {
            const keep = e.shiftKey
              ? new Set(selRef.current)
              : new Set<string>();
            selRef.current = new Set(keep);
            const X: MarqueeState = {
              kind: "marquee",
              ax: x,
              ay: y,
              cx: x,
              cy: y,
              base: keep,
              previewBox: null,
              pid: e.pointerId,
            };
            ix.current = X;
          }
        }
        break;
      }
    }
  }

  function startTransform(
    k: "move" | "resize",
    x: number,
    y: number,
    box: Box | null,
    handle: HandleId | null,
    pid: number,
  ) {
    const movers = selected();
    const ids = new Set(movers.map((s) => s.id!));
    const deps = findDeps(ids);
    hiddenRef.current = new Set([...ids, ...deps.map((s) => s.id!)]);
    redrawStatic();
    const X: TransformState = {
      kind: k,
      sx: x,
      sy: y,
      cx: x,
      cy: y,
      movers,
      deps,
      ids,
      box,
      handle,
      previewBox: null,
      pid,
    };
    ix.current = X;
  }

  function updateHoverCursor(x: number, y: number) {
    const t = cfg.current.tool;
    if (t !== "select") return;

    // PERF: skip hit-testing if the pointer is at the exact same position
    // (common on some OSes that emit redundant pointermove events).
    const last = lastHitPosRef.current;
    if (last && last.x === x && last.y === y) return;
    lastHitPosRef.current = { x, y };

    // Nothing selected -> no handle and no "move" cursor is possible, so the
    // O(n) hit test over every stroke can be skipped entirely.
    if (!selRef.current.size) {
      setCursor("default");
      return;
    }

    const h = hitHandle(x, y);
    if (h) {
      setCursor(h.type === "end" ? "crosshair" : HANDLE_CURSOR[h.id]);
      return;
    }

    // The "move" cursor only appears when the TOP-most hit stroke is selected,
    // so if the pointer is nowhere near any selected stroke the answer is
    // "default" without scanning the whole page.
    let nearSelected = false;
    for (const s of selected()) {
      const b = geom(s).box;
      const pad = 8 + (s.size || 0);
      if (
        x >= b.x - pad &&
        x <= b.x + b.w + pad &&
        y >= b.y - pad &&
        y <= b.y + b.h + pad
      ) {
        nearSelected = true;
        break;
      }
    }
    if (!nearSelected) {
      setCursor("default");
      return;
    }

    const hit = hitTop(x, y);
    setCursor(hit && selRef.current.has(hit.id!) ? "move" : "default");
  }

  /**
   * PERF: hover handling for select/arrow/eraser is rAF-throttled so we do at
   * most ONE layout read, ONE hit-test and ONE overlay redraw per animation
   * frame no matter how many pointermove events the OS fires. The pointermove
   * handler itself now only stores the raw client coordinates.
   */
  function processHover() {
    hoverRafRef.current = 0;
    if (ix.current) return;
    const raw = hoverRawRef.current;
    if (!raw) return;
    const c = dynamicRef.current;
    if (!c) return;
    const t = cfg.current.tool;
    if (!HOVER_TOOLS.has(t)) return;

    const { rect, scale } = getHoverRect(c);
    const x = (raw.x - rect.left) / scale;
    const y = (raw.y - rect.top) / scale;
    hover.current = { x, y };
    rectRef.current = rect;
    rectScaleRef.current = scale;

    if (t === "select") updateHoverCursor(x, y);
    scheduleIdle();
  }

  function scheduleHover() {
    if (!hoverRafRef.current) {
      hoverRafRef.current = requestAnimationFrame(processHover);
    }
  }

  function drawMarqueePreview(X: MarqueeState) {
    const ctx = getDynamicCtx();
    if (!ctx) return;
    if (X.previewBox) clearLive(X.previewBox);
    setLiveTransform(ctx);

    const r: Box = {
      x: Math.min(X.ax, X.cx),
      y: Math.min(X.ay, X.cy),
      w: Math.abs(X.ax - X.cx),
      h: Math.abs(X.ay - X.cy),
    };
    const hits = new Set<string>(X.base);
    for (const s of linesRef.current)
      if (strokeInRect(s, geom(s).pts, r)) hits.add(s.id!);
    selRef.current = hits;
    drawMarquee(ctx, r);
    const info = selectionInfo();
    if (info) {
      ctx.save();
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;
      for (const b of info.boxes)
        ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h);
      ctx.restore();
    }
    X.previewBox = inflate(r, 20);
  }

  /** Draws the latest state of the active (non-pen, non-eraser) interaction. */
  function runPreview() {
    previewRafRef.current = 0;
    const X = ix.current;
    if (!X) return;
    switch (X.kind) {
      case "shape":
        drawShapePreview(X);
        break;
      case "hl":
        drawHlPreview(X);
        break;
      case "move":
      case "resize":
        drawTransformPreview(X);
        break;
      case "endpoint":
        drawEndpointPreview(X);
        break;
      case "marquee":
        drawMarqueePreview(X);
        break;
    }
  }

  function schedulePreview() {
    if (!previewRafRef.current)
      previewRafRef.current = requestAnimationFrame(runPreview);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const X = ix.current;
    const c = dynamicRef.current;
    if (!c) return;
    mods.current = { shift: e.shiftKey, alt: e.altKey };

    if (!X) {
      if (e.pointerType === "touch") return;
      const t = cfg.current.tool;
      // PERF: tools that don't produce hover feedback exit immediately,
      // skipping getBoundingClientRect() entirely on every pointermove.
      if (!HOVER_TOOLS.has(t)) return;

      // PERF: just remember the raw position; all real work happens once per
      // frame inside processHover().
      const raw = hoverRawRef.current;
      if (raw) {
        raw.x = e.clientX;
        raw.y = e.clientY;
      } else {
        hoverRawRef.current = { x: e.clientX, y: e.clientY };
      }
      scheduleHover();
      return;
    }

    if (e.pointerId !== X.pid) return;
    const r = rectRef.current;
    if (!r) return;
    const [cxScaled, cyScaled] = toCanvasCoords(e.clientX, e.clientY, r);

    const ne = e.nativeEvent as PointerEvent & {
      getPredictedEvents?: () => PointerEvent[];
      getCoalescedEvents?: () => PointerEvent[];
    };
    X.cx = cxScaled;
    X.cy = cyScaled;

    if (X.kind === "pen") {
      markInking();
      if (!(RAW_SUPPORTED && X.rawSeen)) {
        const co = ne.getCoalescedEvents?.();
        const list = co && co.length ? co : [ne];
        let added = false;
        for (const ev of list) {
          const [ex, ey] = toCanvasCoords(ev.clientX, ev.clientY, r);
          if (addPenPoint(X, ex, ey)) added = true;
        }
        if (!added) return;

        penCommit(X);
      }
      // (when raw samples are flowing, points were already committed by
      //  rawPen(); this frame-aligned event only refreshes the prediction)

      const pred: number[] = [];
      const pe = ne.getPredictedEvents?.();
      if (pe && pe.length) {
        const n = X.pts.length;
        let lx = X.pts[n - 2],
          ly = X.pts[n - 1];
        for (let i = 0; i < pe.length && i < MAX_PREDICTED; i++) {
          const [qx, qy] = toCanvasCoords(pe[i].clientX, pe[i].clientY, r);
          if ((qx - lx) ** 2 + (qy - ly) ** 2 < 0.25) continue;
          pred.push(qx, qy);
          lx = qx;
          ly = qy;
        }
      }
      drawPenHead(X, pred);

      if (X.predTimer) clearTimeout(X.predTimer);
      X.predTimer = pred.length
        ? setTimeout(() => {
            X.predTimer = null;
            if (ix.current === X) drawPenHead(X, []);
          }, PREDICT_TTL_MS)
        : null;
      return;
    }

    if (X.kind === "erase") {
      const co = ne.getCoalescedEvents?.();
      const list = co && co.length ? co : [ne];
      for (const ev of list) {
        const [px, py] = toCanvasCoords(ev.clientX, ev.clientY, r);
        eraseSegment(X, X.lx, X.ly, px, py);
        X.lx = px;
        X.ly = py;
      }
      // PERF: ONE repaint per event (not one per coalesced sample) and clear
      // only the old ring rect, not the whole overlay canvas.
      flushEraseDirty(X);
      const ctx = getDynamicCtx()!;
      if (X.ringBox) clearLive(X.ringBox);
      setLiveTransform(ctx);
      drawEraserRing(ctx, X.cx, X.cy, X.R);
      X.ringBox = eraserRingBox(X.cx, X.cy, X.R);
      return;
    }

    // shape / hl / move / resize / endpoint / marquee:
    // PERF: skip if nothing changed, otherwise coalesce into one draw per frame.
    const mk = (e.shiftKey ? 1 : 0) | (e.altKey ? 2 : 0);
    const lp = lastPrevRef.current;
    if (lp.x === cxScaled && lp.y === cyScaled && lp.m === mk) return;
    lp.x = cxScaled;
    lp.y = cyScaled;
    lp.m = mk;
    schedulePreview();
  }

  /**
   * Native `pointerrawupdate` handler: commits pen samples immediately at the
   * device rate instead of waiting for the next frame-aligned `pointermove`.
   */
  function rawPen(ev: PointerEvent) {
    const X = ix.current;
    if (!X || X.kind !== "pen" || ev.pointerId !== X.pid) return;
    const r = rectRef.current;
    if (!r) return;
    markInking();
    X.rawSeen = true;
    const co = (ev as any).getCoalescedEvents?.() as PointerEvent[] | undefined;
    const list = co && co.length ? co : [ev];
    let added = false;
    for (const s of list) {
      const [sx, sy] = toCanvasCoords(s.clientX, s.clientY, r);
      if (addPenPoint(X, sx, sy)) added = true;
    }
    if (!added) return;
    penCommit(X);
    drawPenHead(X, []);
  }

  function finish(e: React.PointerEvent<HTMLCanvasElement>, ok: boolean) {
    const X = ix.current;
    if (!X || e.pointerId !== X.pid) return;
    const r = rectRef.current;
    if (r) {
      const [cxScaled, cyScaled] = toCanvasCoords(e.clientX, e.clientY, r);
      X.cx = cxScaled;
      X.cy = cyScaled;
    }
    mods.current = { shift: e.shiftKey, alt: e.altKey };
    if (e.pointerType === "pen") penUntil.current = performance.now() + 600;

    // A preview may still be waiting for the next frame. The result is about to
    // be committed/cleared, so drop it - except the marquee, whose selection is
    // computed by the preview pass and must reflect the final pointer position.
    if (previewRafRef.current) {
      cancelAnimationFrame(previewRafRef.current);
      previewRafRef.current = 0;
      if (X.kind === "marquee") drawMarqueePreview(X);
    }

    switch (X.kind) {
      case "pen": {
        ix.current = null;
        if (X.predTimer) {
          clearTimeout(X.predTimer);
          X.predTimer = null;
        }
        (
          dynamicRef.current as unknown as { __penCursor?: PenCursorState } | null
        )?.__penCursor?.setStroke(false);
        const native = e.nativeEvent as PointerEvent & {
          getCoalescedEvents?: () => PointerEvent[];
        };
        const finalSamples = native.getCoalescedEvents?.();
        if (ok && finalSamples && r) {
          for (const sample of finalSamples) {
            const [sx, sy] = toCanvasCoords(sample.clientX, sample.clientY, r);
            addPenPoint(X, sx, sy);
          }
        }
        if (ok) addPenPoint(X, X.cx, X.cy);

        penCommit(X);

        const ctx = getStaticCtx()!;
        const n = X.pts.length >> 1;
        if (n >= 1) {
          setStaticTransform(ctx);
          ctx.strokeStyle = X.color;
          ctx.fillStyle = X.color;
          ctx.lineWidth = X.size;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          if (n === 1) {
            ctx.beginPath();
            ctx.arc(X.pts[0], X.pts[1], X.size / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.moveTo(X.curX, X.curY);
            ctx.lineTo(X.pts[(n - 1) * 2], X.pts[(n - 1) * 2 + 1]);
            ctx.stroke();
          }
          if (X.headBox) clearLive(X.headBox);
          X.headBox = null;

          const stroke: Stroke = {
            id: uid(),
            points: toStoredPts(X.pts),
            color: X.color,
            size: X.size,
            tool: "pen",
          };
          commitLines(linesRef.current.concat(stroke));
        } else if (X.headBox) {
          clearLive(X.headBox);
        }
        break;
      }

      case "erase": {
        ix.current = null;
        clearLiveAll();
        if (X.changed) {
          const cleaned = sanitize(linesRef.current);
          pushHistory(X.snap);
          linesRef.current = cleaned;
          scheduleSave();
          redrawStatic();
        }
        break;
      }

      case "shape": {
        ix.current = null;
        if (!ok) {
          clearLiveAll();
          break;
        }
        const g = shapeGeom(X);
        const dist = Math.hypot(g.p[2] - g.p[0], g.p[3] - g.p[1]);
        if (dist >= 3) {
          const stroke: Stroke = {
            id: uid(),
            points: toStoredPts(g.p),
            color: X.color,
            size: X.size,
            tool: X.tool,
            start: X.startB,
            end: g.endB,
          };
          const ctx = getStaticCtx()!;
          setStaticTransform(ctx);
          paintStroke(ctx, stroke, g.p);
          clearLiveAll();
          commitLines(linesRef.current.concat(stroke));
        } else {
          clearLiveAll();
        }
        break;
      }

      case "hl": {
        ix.current = null;
        if (!ok) {
          clearLiveAll();
          break;
        }
        const rects = highlightRects(
          cfg.current.textLines || [],
          X.ax,
          X.ay,
          X.cx,
          X.cy,
          cfg.current.size,
        );
        clearLiveAll();
        if (rects.length) {
          const pts: number[][] = [];
          for (const q of rects) pts.push(store(q[0], q[1]), store(q[2], q[3]));
          const stroke: Stroke = {
            id: uid(),
            points: pts,
            color: cfg.current.color,
            size: 1,
            tool: "highlight-rect",
          };
          const ctx = getStaticCtx()!;
          setStaticTransform(ctx);
          paintStroke(
            ctx,
            stroke,
            flatten(stroke.points, cfg.current.toScreen),
          );
          commitLines(linesRef.current.concat(stroke));
        }
        break;
      }

      case "move":
      case "resize": {
        ix.current = null;
        const moved = ok && Math.hypot(X.cx - X.sx, X.cy - X.sy) > 2;
        hiddenRef.current = null;
        clearLiveAll();
        if (moved) {
          commitLines(transformLines(X.ids, transformFn(X)));
        }
        redrawStatic();
        break;
      }

      case "endpoint": {
        ix.current = null;
        hiddenRef.current = null;
        clearLiveAll();
        if (ok) {
          const s = X.stroke;
          const base = geom(s).pts;
          const q = base.slice();
          let nx = X.cx,
            ny = X.cy;
          let bind: Binding | null = null;
          if (kindOf(s) === "arrow") {
            const b = findBind(nx, ny);
            if (b) {
              bind = { id: b.id, anchor: b.anchor };
              [nx, ny] = anchorPoint(b.box, b.anchor);
            }
          }
          if (!bind && mods.current.shift) {
            const o = X.which === 0 ? 2 : 0;
            const [dx, dy] = snap45(nx - q[o], ny - q[o + 1]);
            nx = q[o] + dx;
            ny = q[o + 1] + dy;
          }
          q[X.which] = nx;
          q[X.which + 1] = ny;
          const ns: Stroke = {
            ...s,
            points: toStoredPts(q),
            start: X.which === 0 ? bind : s.start,
            end: X.which === 2 ? bind : s.end,
          };
          commitLines(linesRef.current.map((x) => (x.id === ns.id ? ns : x)));
        }
        redrawStatic();
        break;
      }

      case "marquee": {
        ix.current = null;
        clearLiveAll();
        scheduleIdle();
        break;
      }
    }
  }

  function clearSelection() {
    if (!selRef.current.size) return;
    selRef.current = new Set();
    scheduleIdle();
  }

  function deleteSelected() {
    const ids = selRef.current;
    if (!ids.size) return;
    commitLines(sanitize(linesRef.current.filter((s) => !ids.has(s.id!))));
    selRef.current = new Set();
    redrawStatic();
    scheduleIdle();
  }

  function duplicateSelected() {
    const sel = selected();
    if (!sel.length) return;
    const idMap = new Map<string, string>();
    sel.forEach((s) => idMap.set(s.id!, uid()));
    const clones = sel.map((s) => {
      const p = geom(s).pts.map((v) => v + 16);
      return {
        ...s,
        id: idMap.get(s.id!)!,
        points: toStoredPts(p),
        start:
          s.start && idMap.has(s.start.id)
            ? { ...s.start, id: idMap.get(s.start.id)! }
            : null,
        end:
          s.end && idMap.has(s.end.id)
            ? { ...s.end, id: idMap.get(s.end.id)! }
            : null,
      } as Stroke;
    });
    commitLines(linesRef.current.concat(clones));
    selRef.current = new Set(clones.map((s) => s.id!));
    redrawStatic();
    scheduleIdle();
  }

  function nudge(dx: number, dy: number) {
    const ids = selRef.current;
    if (!ids.size) return;
    commitLines(transformLines(ids, (x, y) => [x + dx, y + dy]));
    redrawStatic();
    scheduleIdle();
  }

  function recolor(c: string) {
    const ids = selRef.current;
    if (!ids.size) return;
    commitLines(
      linesRef.current.map((s) => (ids.has(s.id!) ? { ...s, color: c } : s)),
    );
    redrawStatic();
    scheduleIdle();
  }

  function selectAll() {
    selRef.current = new Set(
      linesRef.current.filter((s) => kindOf(s) !== "eraser").map((s) => s.id!),
    );
    scheduleIdle();
  }

  function onKey(e: KeyboardEvent) {
    if (!activeInk || activeInk.token !== me.current.token) return;
    const t = e.target as HTMLElement | null;
    if (
      t &&
      (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
    )
      return;
    const mod = e.ctrlKey || e.metaKey;
    const code = getKeyCode(e);

    if (mod && code === "KeyZ") {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
      return;
    }
    if (mod && code === "KeyY") {
      e.preventDefault();
      redo();
      return;
    }

    if (code === "Delete" || code === "Backspace") {
      if (selRef.current.size > 0 && !mod && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        deleteSelected();
        return;
      }
    }

    if (cfg.current.tool !== "select" || ix.current) return;
    if (mod && code === "KeyA") {
      e.preventDefault();
      selectAll();
      return;
    }
    if (!selRef.current.size) return;
    if (mod && code === "KeyD") {
      e.preventDefault();
      duplicateSelected();
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    switch (code) {
      case "Escape":
        clearSelection();
        break;
      case "ArrowLeft":
        e.preventDefault();
        nudge(-step, 0);
        break;
      case "ArrowRight":
        e.preventDefault();
        nudge(step, 0);
        break;
      case "ArrowUp":
        e.preventDefault();
        nudge(0, -step);
        break;
      case "ArrowDown":
        e.preventDefault();
        nudge(0, step);
        break;
    }
  }

  function onModKey(e: KeyboardEvent) {
    if (mods.current.shift === e.shiftKey && mods.current.alt === e.altKey)
      return;
    mods.current = { shift: e.shiftKey, alt: e.altKey };
    const X = ix.current;
    if (X && (X.kind === "shape" || X.kind === "endpoint")) {
      if (X.kind === "shape") drawShapePreview(X);
      else drawEndpointPreview(X);
    }
  }

  api.current = {
    redraw: redrawStatic,
    clearSelection,
    undo,
    redo,
    recolor,
    onKey,
    onModKey,
    down,
    move,
    finish,
    rawPen,
  };

  useEffect(() => {
    const cacheKey = getCacheKey();
    const hadCachedHistory = globalHistoryCache.has(cacheKey);
    hist.current = globalHistoryCache.get(cacheKey) || { past: [], future: [] };
    mountedHistoryKeys.add(cacheKey);

    let alive = true;
    loadedRef.current = false;
    hasDrawnRef.current = false;
    ix.current = null;
    hiddenRef.current = null;
    selRef.current = new Set();
    linesRef.current = [];
    clearLiveAll();
    redrawStatic();

    const loadPromise = Promise.resolve(loadDrawing(filePath, page, kind));
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Load timeout")), 5000),
    );

    Promise.race([loadPromise, timeoutPromise])
      .then((saved: unknown) => {
        if (!alive) return;

        const arr = Array.isArray(saved) ? (saved as Stroke[]) : [];
        for (const s of arr) if (!s.id) s.id = uid();

        if (hasDrawnRef.current && linesRef.current.length > 0) {
          const savedIds = new Set(arr.map((s) => s.id));
          const userStrokes = linesRef.current.filter(
            (s) => !savedIds.has(s.id!),
          );
          linesRef.current = [...arr, ...userStrokes];
        } else {
          linesRef.current = arr;
        }

        loadedRef.current = true;

        // This page was not mounted when "clear all" ran: give it an undo
        // entry so Ctrl+Z works here too and restores the whole document.
        if (!hadCachedHistory && arr.length === 0 && filePath) {
          const g = getActiveClearGroup(filePath);
          if (g && hist.current.past.length === 0) {
            const empty: Stroke[] = [];
            undoMarks.set(empty, g.id);
            hist.current.past.push(empty);
          }
        }
        redrawStatic();
      })
      .catch((err) => {
        console.error("Failed to load drawing or timed out:", err);
        if (alive) {
          loadedRef.current = true;
        }
      });

    return () => {
      alive = false;
      flush();
      mountedHistoryKeys.delete(cacheKey);
      globalHistoryCache.set(cacheKey, hist.current);
    };
  }, [filePath, page, kind, flush, getCacheKey]);

  useEffect(() => {
    if (!activeInk || kind === "pdf") {
      activeInk = me.current;
    }
  }, [kind]);

  useEffect(() => {
    const claimActive = () => {
      if (activeInk && activeInk.token !== me.current.token)
        activeInk.clearSelection();
      activeInk = me.current;
    };

    // Clearing is recorded as a normal history step so it can be undone/redone.
    const clearWithHistory = (gid?: string) => {
      dropPendingSave();
      const prev = linesRef.current;
      if (gid || prev.length > 0) {
        pushHistory(prev);
        if (gid) undoMarks.set(prev, gid);
      }
      // A stroke that is still being drawn (pen on the screen while the pen
      // button triggers "clear") must be cancelled too, otherwise it would be
      // committed again on pen-up and the page would not look cleared.
      if (ix.current) {
        const X = ix.current as { predTimer?: ReturnType<typeof setTimeout> | null };
        if (X.predTimer) clearTimeout(X.predTimer);
        ix.current = null;
      }
      if (previewRafRef.current) {
        cancelAnimationFrame(previewRafRef.current);
        previewRafRef.current = 0;
      }
      linesRef.current = [];
      selRef.current = new Set();
      hiddenRef.current = null;
      redrawStatic();
      clearLiveAll();
      scheduleSave();
    };

    const handleClearPage = (e: Event) => {
      const gid = (e as CustomEvent<{ gid?: string } | undefined>).detail?.gid;
      claimActive();
      clearWithHistory(gid);
    };

    const handleClearAll = (e: Event) => {
      const gid = (e as CustomEvent<{ gid?: string } | undefined>).detail?.gid;
      // Pages that are not mounted can't be undone through their own
      // history any more (their DB rows are gone) -> drop stale history.
      const own = getCacheKey();
      for (const key of Array.from(globalHistoryCache.keys())) {
        if (
          key !== own &&
          key.startsWith(`${kind}:${filePath}:`) &&
          !mountedHistoryKeys.has(key)
        ) {
          globalHistoryCache.delete(key);
        }
      }
      claimActive();
      clearWithHistory(gid);
    };

    const handleGroupUndo = (e: Event) => {
      const d = (e as CustomEvent<{ gid: string; origin: object }>).detail;
      if (!d || d.origin === me.current.token) return;
      const h = hist.current;
      const top = h.past[h.past.length - 1];
      if (top && undoMarks.get(top) === d.gid) undo(true);
    };

    const handleGroupRedo = (e: Event) => {
      const d = (e as CustomEvent<{ gid: string; origin: object }>).detail;
      if (!d || d.origin === me.current.token) return;
      const h = hist.current;
      const top = h.future[h.future.length - 1];
      if (top && redoMarks.get(top) === d.gid) redo(true);
    };

    const handleReload = () => {
      dropPendingSave();
      Promise.resolve(loadDrawing(filePath, page, kind))
        .then((saved: unknown) => {
          const arr = Array.isArray(saved) ? (saved as Stroke[]) : [];
          for (const s of arr) if (!s.id) s.id = uid();
          linesRef.current = arr;
          selRef.current = new Set();
          hist.current = { past: [], future: [] };
          saveHistoryToCache();
          redrawStatic();
          clearLiveAll();
        })
        .catch(console.error);
    };

    const handleDiscard = () => {
      dropPendingSave();
      linesRef.current = [];
      selRef.current = new Set();
      hist.current = { past: [], future: [] };
      hiddenRef.current = null;
      globalHistoryCache.delete(getCacheKey());
      redrawStatic();
      clearLiveAll();
    };

    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (ix.current && ix.current.pid === e.pointerId) {
        const c = dynamicRef.current;
        if (c) {
          const fakeEvent = {
            pointerId: e.pointerId,
            clientX: e.clientX,
            clientY: e.clientY,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            pointerType: e.pointerType,
            nativeEvent: e,
            preventDefault: () => {},
            stopPropagation: () => {},
          };
          finish(fakeEvent as any, true);
        }
      }
    };

    const handleGlobalPointerCancel = (e: PointerEvent) => {
      if (ix.current && ix.current.pid === e.pointerId) {
        const c = dynamicRef.current;
        if (c) {
          const fakeEvent = {
            pointerId: e.pointerId,
            clientX: e.clientX,
            clientY: e.clientY,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
            pointerType: e.pointerType,
            nativeEvent: e,
            preventDefault: () => {},
            stopPropagation: () => {},
          };
          finish(fakeEvent as any, false);
        }
      }
    };

    const handleWindowBlur = () => {
      if (ix.current) {
        ix.current = null;
        clearLiveAll();
        redrawStatic();
      } else if (lastIdleBoundsRef.current) {
        clearLive(lastIdleBoundsRef.current);
        lastIdleBoundsRef.current = null;
        lastIdleSigRef.current = "";
      }
      hover.current = null;
      hoverRawRef.current = null;
      lastHitPosRef.current = null;
      setCursor("default");
    };

    const handleFocus = () => {
      const d = dynamicRef.current;
      const s = staticRef.current;
      if (d && s && d.parentElement) {
        resize(d.parentElement.clientWidth, d.parentElement.clientHeight, true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
        handleWindowBlur();
      } else if (document.visibilityState === "visible") {
        handleFocus();
      }
    };

    const mine = () => activeInk?.token === me.current.token;
    const handleUndo = () => mine() && undo();
    const handleRedo = () => mine() && redo();
    const key = (e: KeyboardEvent) => api.current.onKey(e);
    const mod = (e: KeyboardEvent) => api.current.onModKey(e);

    const handleClearActiveInk = () => {
      if (activeInk?.token === me.current.token) {
        activeInk = null;
        clearSelection();
      }
    };

    const rawCanvas = dynamicRef.current;
    const onRaw = (ev: Event) => api.current.rawPen(ev as PointerEvent);
    if (RAW_SUPPORTED && rawCanvas)
      rawCanvas.addEventListener("pointerrawupdate", onRaw);
    // Moving between laptop panel / monitor changes devicePixelRatio:
    // re-create the backing stores so strokes stay sharp and correctly mapped.
    const unsubDpr = subscribeDpr(handleFocus);

    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", handleGlobalPointerCancel);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    window.addEventListener("margyn-clear-all", handleClearAll);
    window.addEventListener("margyn-group-undo", handleGroupUndo);
    window.addEventListener("margyn-group-redo", handleGroupRedo);
    window.addEventListener(`margyn-clear-page-${page}`, handleClearPage);
    window.addEventListener("margyn-reload-all", handleReload);
    window.addEventListener("margyn-undo", handleUndo);
    window.addEventListener("margyn-redo", handleRedo);
    window.addEventListener("pagehide", flush);
    window.addEventListener("keydown", key, true);
    window.addEventListener("keydown", mod);
    window.addEventListener("keyup", mod);
    window.addEventListener("margyn-clear-active-ink", handleClearActiveInk);

    return () => {
      if (RAW_SUPPORTED && rawCanvas)
        rawCanvas.removeEventListener("pointerrawupdate", onRaw);
      unsubDpr();
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointercancel", handleGlobalPointerCancel);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      window.removeEventListener("margyn-clear-all", handleClearAll);
      window.removeEventListener("margyn-group-undo", handleGroupUndo);
      window.removeEventListener("margyn-group-redo", handleGroupRedo);
      window.removeEventListener(`margyn-clear-page-${page}`, handleClearPage);
      window.removeEventListener("margyn-reload-all", handleReload);
      window.removeEventListener("margyn-undo", handleUndo);
      window.removeEventListener("margyn-redo", handleRedo);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("keydown", mod);
      window.removeEventListener("keyup", mod);
      window.removeEventListener(
        "margyn-clear-active-ink",
        handleClearActiveInk,
      );
      if (activeInk === me.current) activeInk = null;
    };
  }, [
    page,
    kind,
    filePath,
    flush,
    dropPendingSave,
    getCacheKey,
    saveHistoryToCache,
    resize,
  ]);

  useEffect(() => {
    if (tool !== "select") selRef.current = new Set();
    hover.current = null;
    hoverRawRef.current = null;
    lastHitPosRef.current = null;
    setCursor("default");
    if (ix.current) {
      ix.current = null;
      clearLiveAll();
      redrawStatic();
    }
    scheduleIdle();
  }, [tool]);

  const prevColor = useRef(color);
  useEffect(() => {
    if (prevColor.current === color) return;
    prevColor.current = color;
    if (cfg.current.tool === "select" && selRef.current.size) recolor(color);
  }, [color]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
      if (previewRafRef.current) cancelAnimationFrame(previewRafRef.current);
    },
    [],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => api.current.down(e),
    [],
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => api.current.move(e),
    [],
  );
  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => api.current.finish(e, true),
    [],
  );
  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => api.current.finish(e, false),
    [],
  );
  const onPointerEnter = useCallback(() => {
    setActive();
  }, []);
  const onPointerLeave = useCallback(() => {
    hover.current = null;
    hoverRawRef.current = null;
    lastHitPosRef.current = null;
    hoverRectCacheRef.current = null;
    if (!ix.current) {
      setCursor("default");
      // Clear only the idle overlay bounds, not the entire canvas.
      if (lastIdleBoundsRef.current) {
        clearLive(lastIdleBoundsRef.current);
        lastIdleBoundsRef.current = null;
        lastIdleSigRef.current = "";
      }
    }
  }, []);

  const onContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const hasSelection = selRef.current.size > 0;

      const menuItems: any[] = [
        {
          label: "Undo",
          icon: Undo2,
          shortcut: "Ctrl+Z",
          onClick: () => undo(),
          disabled: !hist.current.past.length,
        },
        {
          label: "Redo",
          icon: Redo2,
          shortcut: "Ctrl+Shift+Z",
          onClick: () => redo(),
          disabled: !hist.current.future.length,
        },
        { separator: true },
        {
          label: "Duplicate Selected",
          icon: Copy,
          shortcut: "Ctrl+D",
          onClick: () => duplicateSelected(),
          disabled: !hasSelection,
        },
        {
          label: "Delete Selected",
          icon: Trash2,
          danger: true,
          shortcut: "Del",
          onClick: () => deleteSelected(),
          disabled: !hasSelection,
        },
        { separator: true },
        {
          label: "Clear Current Page",
          icon: Eraser,
          onClick: () =>
            window.dispatchEvent(
              new CustomEvent(`margyn-clear-page-${cfg.current.page}`, {
                detail: { gid: newGroupId() },
              }),
            ),
        },
        {
          label: "Toggle Margin",
          icon: LayoutPanelLeft,
          shortcut: "Ctrl+B",
          onClick: () =>
            window.dispatchEvent(
              new CustomEvent("margyn-shortcut", { detail: "ctrl+b" }),
            ),
        },
      ];

      if (cfg.current.onDeletePage) {
        menuItems.push({ separator: true });
        menuItems.push({
          label: "Delete This Page",
          icon: Trash2,
          danger: true,
          onClick: cfg.current.onDeletePage,
        });
      }

      openMenu(e.clientX, e.clientY, menuItems);
    },
    [openMenu, undo, redo, duplicateSelected, deleteSelected],
  );

  return {
    staticRef,
    dynamicRef,
    resize,
    redraw: redrawStatic,
    hoverCursor,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture: onPointerCancel,
      onPointerEnter,
      onPointerLeave,
      onContextMenu,
    },
  };
}
