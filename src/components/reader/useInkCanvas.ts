"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTool } from "@/providers/ToolProvider";
import { useContextMenu } from "@/providers/ContextMenuProvider";
import { saveDrawing, loadDrawing } from "@/db";
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
  onDeletePage?: () => void; // ✅ اضافه شد
}

const SAVE_DELAY_MS = 500;
const MIN_DIST2 = 0.3 * 0.3;
const MAX_HISTORY = 100;
const MAX_PREDICTED = 3;
const PREDICT_TTL_MS = 40;

// ✅ کش سراسری برای نگهداری تاریخچه آندو/ریدو در حافظه (خارج از ری‌اکت)
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
  onDeletePage, // ✅ اضافه شد
}: Options) {
  const staticRef = useRef<HTMLCanvasElement>(null);
  const dynamicRef = useRef<HTMLCanvasElement>(null);
  const staticCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const dynamicCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const { tool, color, size } = useTool();
  const { openMenu } = useContextMenu(); // ✅ اضافه شد

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
    onDeletePage, // ✅ اضافه شد
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
    onDeletePage, // ✅ اضافه شد
  };

  const linesRef = useRef<Stroke[]>([]);
  const loadedRef = useRef(false);
  const selRef = useRef<Set<string>>(new Set());
  const hiddenRef = useRef<Set<string> | null>(null);
  const hist = useRef<{ past: Stroke[][]; future: Stroke[][] }>({
    past: [],
    future: [],
  });
  const geomCache = useRef(
    new WeakMap<Stroke, { v: number; pts: number[]; box: Box }>(),
  );
  const mapVer = useRef(0);

  const ix = useRef<DrawState | null>(null);
  const hover = useRef<{ x: number; y: number } | null>(null);
  const mods = useRef({ shift: false, alt: false });
  const rectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef(0);
  const penUntil = useRef(0);
  const lastCursor = useRef("");

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

  const saveHistoryToCache = useCallback(() => {
    globalHistoryCache.set(getCacheKey(), hist.current);
  }, [getCacheKey]);

  const dpr = () => window.devicePixelRatio || 1;

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
      staticCtxRef.current = staticRef.current?.getContext("2d") ?? null;
    return staticCtxRef.current;
  };
  const getDynamicCtx = () => {
    if (!dynamicCtxRef.current)
      dynamicCtxRef.current = dynamicRef.current?.getContext("2d") ?? null;
    return dynamicCtxRef.current;
  };

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const p = pendingRef.current;
    pendingRef.current = null;
    if (!p) return;
    Promise.resolve(saveDrawing(p.filePath, p.page, p.kind, p.lines))
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
    timerRef.current = setTimeout(flush, SAVE_DELAY_MS);
  }, [flush]);

  const dropPendingSave = useCallback(() => {
    pendingRef.current = null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

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
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    setStaticTransform(ctx);
    const hide = hiddenRef.current;
    for (const s of linesRef.current) {
      if (hide && s.id && hide.has(s.id)) continue;
      paintStroke(ctx, s, geom(s).pts);
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
  }

  const resize = useCallback((w: number, h: number, force = false) => {
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
    selRef.current.forEach((id) => {
      if (!ids.has(id)) selRef.current.delete(id);
    });
    hiddenRef.current = null;
    scheduleSave();
    redrawStatic();
    clearLiveAll();
    scheduleIdle();
  }

  function undo() {
    const h = hist.current;
    if (!loadedRef.current || ix.current || !h.past.length) return;
    h.future.push(linesRef.current);
    linesRef.current = h.past.pop()!;
    saveHistoryToCache();
    afterHistoryChange();
  }

  function redo() {
    const h = hist.current;
    if (!loadedRef.current || ix.current || !h.future.length) return;
    h.past.push(linesRef.current);
    linesRef.current = h.future.pop()!;
    saveHistoryToCache();
    afterHistoryChange();
  }

  function findBind(x: number, y: number, excludeId?: string): BindHit | null {
    const lines = linesRef.current;
    for (let i = lines.length - 1; i >= 0; i--) {
      const s = lines[i];
      if (!isBindable(kindOf(s)) || s.id === excludeId) continue;
      const b = cornerBox(geom(s).pts);
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
      if (hitStroke(s, geom(s).pts, x, y, 6)) return s;
    }
    return null;
  }

  function selected(): Stroke[] {
    const sel = selRef.current;
    if (!sel.size) return [];
    return linesRef.current.filter((s) => s.id && sel.has(s.id));
  }

  function selectionInfo(over?: Map<string, number[]>): SelInfo | null {
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
      redrawStatic();
    }
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
    X.headBox = {
      x: Math.floor(x0 - pad),
      y: Math.floor(y0 - pad),
      w: Math.ceil(x1 - x0 + pad * 2) + 1,
      h: Math.ceil(y1 - y0 + pad * 2) + 1,
    };
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

  function idleFrame() {
    rafRef.current = 0;
    if (ix.current) return;
    const ctx = getDynamicCtx();
    if (!ctx) return;
    clearLiveAll();
    setLiveTransform(ctx);

    const t = cfg.current.tool;
    if (t === "select") {
      const info = selectionInfo();
      if (info) drawSelectionUI(ctx, info);
    } else if (t === "arrow" && hover.current) {
      const b = findBind(hover.current.x, hover.current.y);
      if (b) drawAnchorHints(ctx, b.box, b.anchor);
    } else if (t === "eraser" && hover.current) {
      drawEraserRing(
        ctx,
        hover.current.x,
        hover.current.y,
        (cfg.current.size * 3) / 2,
      );
    }
  }

  const setCursor = (v: string) => {
    const c = dynamicRef.current;
    if (!c || lastCursor.current === v) return;
    lastCursor.current = v;
    c.style.cursor = v;
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
    if (!loadedRef.current || ix.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.pointerType === "touch" && performance.now() < penUntil.current)
      return;
    const c = dynamicRef.current;
    if (!c) return;

    const t = cfg.current.tool;
    const rect = c.getBoundingClientRect();
    rectRef.current = rect;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mods.current = { shift: e.shiftKey, alt: e.altKey };
    setActive();
    try {
      c.setPointerCapture(e.pointerId);
    } catch {}
    if (e.pointerType === "pen") penUntil.current = Infinity;
    hover.current = null;
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
        };
        ix.current = X;
        eraseSegment(X, x, y, x, y);
        const ctx = getDynamicCtx()!;
        setLiveTransform(ctx);
        drawEraserRing(ctx, x, y, X.R);
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
                selRef.current.delete(id);
                try {
                  c.releasePointerCapture(e.pointerId);
                } catch {}
                scheduleIdle();
                if (e.pointerType === "pen")
                  penUntil.current = performance.now() + 600;
                return;
              }
              selRef.current.add(id);
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
    if (t !== "select") {
      setCursor("");
      return;
    }
    const h = hitHandle(x, y);
    if (h) {
      setCursor(h.type === "end" ? "crosshair" : HANDLE_CURSOR[h.id]);
      return;
    }
    const hit = hitTop(x, y);
    setCursor(hit && selRef.current.has(hit.id!) ? "move" : "default");
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const X = ix.current;
    const c = dynamicRef.current;
    if (!c) return;
    mods.current = { shift: e.shiftKey, alt: e.altKey };

    if (!X) {
      if (e.pointerType === "touch") return;
      const r = c.getBoundingClientRect();
      rectRef.current = r;
      const x = e.clientX - r.left,
        y = e.clientY - r.top;
      hover.current = { x, y };
      const t = cfg.current.tool;
      updateHoverCursor(x, y);
      if (t === "arrow" || t === "eraser" || t === "select") scheduleIdle();
      return;
    }

    if (e.pointerId !== X.pid) return;
    const r = rectRef.current;
    if (!r) return;

    const ne = e.nativeEvent as PointerEvent & {
      getPredictedEvents?: () => PointerEvent[];
      getCoalescedEvents?: () => PointerEvent[];
    };
    X.cx = e.clientX - r.left;
    X.cy = e.clientY - r.top;

    if (X.kind === "pen") {
      const co = ne.getCoalescedEvents?.();
      const list = co && co.length ? co : [ne];
      let added = false;
      for (const ev of list) {
        if (addPenPoint(X, ev.clientX - r.left, ev.clientY - r.top))
          added = true;
      }
      if (!added) return;

      penCommit(X);

      const pred: number[] = [];
      const pe = ne.getPredictedEvents?.();
      if (pe && pe.length) {
        const n = X.pts.length;
        let lx = X.pts[n - 2],
          ly = X.pts[n - 1];
        for (let i = 0; i < pe.length && i < MAX_PREDICTED; i++) {
          const qx = pe[i].clientX - r.left,
            qy = pe[i].clientY - r.top;
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
        const px = ev.clientX - r.left,
          py = ev.clientY - r.top;
        eraseSegment(X, X.lx, X.ly, px, py);
        X.lx = px;
        X.ly = py;
      }
      const ctx = getDynamicCtx()!;
      clearLiveAll();
      setLiveTransform(ctx);
      drawEraserRing(ctx, X.cx, X.cy, X.R);
      return;
    }

    if (X.kind === "shape") {
      drawShapePreview(X);
      return;
    }

    if (X.kind === "hl") {
      drawHlPreview(X);
      return;
    }

    if (X.kind === "move" || X.kind === "resize") {
      drawTransformPreview(X);
      return;
    }

    if (X.kind === "endpoint") {
      drawEndpointPreview(X);
      return;
    }

    if (X.kind === "marquee") {
      const ctx = getDynamicCtx()!;
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
      return;
    }
  }

  function finish(e: React.PointerEvent<HTMLCanvasElement>, ok: boolean) {
    const X = ix.current;
    if (!X || e.pointerId !== X.pid) return;
    const r = rectRef.current;
    if (r) {
      X.cx = e.clientX - r.left;
      X.cy = e.clientY - r.top;
    }
    mods.current = { shift: e.shiftKey, alt: e.altKey };
    if (e.pointerType === "pen") penUntil.current = performance.now() + 600;

    switch (X.kind) {
      case "pen": {
        ix.current = null;
        if (X.predTimer) {
          clearTimeout(X.predTimer);
          X.predTimer = null;
        }
        const native = e.nativeEvent as PointerEvent & {
          getCoalescedEvents?: () => PointerEvent[];
        };
        const finalSamples = native.getCoalescedEvents?.();
        if (ok && finalSamples && r) {
          for (const sample of finalSamples)
            addPenPoint(X, sample.clientX - r.left, sample.clientY - r.top);
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

    if (mod && e.code === "KeyZ") {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
      return;
    }
    if (mod && e.code === "KeyY") {
      e.preventDefault();
      redo();
      return;
    }

    // ✅ اصلاح: حتی اگر ابزار Select نباشد، اگر استروکی انتخاب شده باشد با Delete پاک می‌شود
    if (e.code === "Delete" || e.code === "Backspace") {
      if (selRef.current.size > 0) {
        e.preventDefault();
        deleteSelected();
        return;
      }
    }

    if (cfg.current.tool !== "select" || ix.current) return;
    if (mod && e.code === "KeyA") {
      e.preventDefault();
      selectAll();
      return;
    }
    if (!selRef.current.size) return;
    if (mod && e.code === "KeyD") {
      e.preventDefault();
      duplicateSelected();
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    switch (e.code) {
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
  };

  useEffect(() => {
    const cacheKey = getCacheKey();
    hist.current = globalHistoryCache.get(cacheKey) || { past: [], future: [] };

    let alive = true;
    loadedRef.current = false;
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
        linesRef.current = arr;
        loadedRef.current = true;
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
      globalHistoryCache.set(cacheKey, hist.current);
    };
  }, [filePath, page, kind, flush, getCacheKey]);

  useEffect(() => {
    if (!activeInk || kind === "pdf") {
      activeInk = me.current;
    }
  }, [kind]);

  useEffect(() => {
    const handleClearPage = () => {
      dropPendingSave();
      linesRef.current = [];
      selRef.current = new Set();
      hist.current = { past: [], future: [] };
      globalHistoryCache.delete(getCacheKey());
      redrawStatic();
      clearLiveAll();
    };

    const handleClearAll = () => {
      dropPendingSave();
      linesRef.current = [];
      selRef.current = new Set();
      hist.current = { past: [], future: [] };
      for (const key of globalHistoryCache.keys()) {
        if (key.startsWith(`${kind}:${filePath}:`)) {
          globalHistoryCache.delete(key);
        }
      }
      redrawStatic();
      clearLiveAll();
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
      }
      hover.current = null;
      setCursor("");
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

    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", handleGlobalPointerCancel);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    window.addEventListener("margyn-clear-all", handleClearAll);
    window.addEventListener(`margyn-clear-page-${page}`, handleClearPage);
    window.addEventListener("margyn-reload-all", handleReload);
    window.addEventListener("margyn-undo", handleUndo);
    window.addEventListener("margyn-redo", handleRedo);
    window.addEventListener("pagehide", flush);
    window.addEventListener("keydown", key);
    window.addEventListener("keydown", mod);
    window.addEventListener("keyup", mod);
    window.addEventListener("margyn-clear-active-ink", handleClearActiveInk);

    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointercancel", handleGlobalPointerCancel);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      window.removeEventListener("margyn-clear-all", handleClearAll);
      window.removeEventListener(`margyn-clear-page-${page}`, handleClearPage);
      window.removeEventListener("margyn-reload-all", handleReload);
      window.removeEventListener("margyn-undo", handleUndo);
      window.removeEventListener("margyn-redo", handleRedo);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("keydown", key);
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
    setCursor("");
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
    if (!ix.current) scheduleIdle();
  }, []);

  // ✅ هندلر راست کلیک با منوی اختصاصی کانواس
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
              new CustomEvent(`margyn-clear-page-${cfg.current.page}`),
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
