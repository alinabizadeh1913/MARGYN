"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTool } from "@/providers/ToolProvider";
import { saveDrawing, loadDrawing } from "@/db";
import {
  ANCHORS,
  anchorPoint,
  cornerBox,
  elementBounds,
  eraseGeometry,
  findNearestAnchor,
  flatten,
  getHandles,
  HANDLE_CURSOR,
  hitStroke,
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
import { selectionRects } from "./inkText";
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
  /** text lines in the same coordinate space as the canvas (px) */
  textLines?: TextLine[];
}

const SAVE_DELAY_MS = 350;
const MIN_DIST2 = 0.5 * 0.5;
const MAX_PREDICTED = 2;
const MAX_HISTORY = 100;
const SETTLE_FRAMES = 2;

/* The canvas the keyboard (Ctrl+Z, Delete…) currently belongs to. */
let activeInk: { token: object; clearSelection: () => void } | null = null;

interface IX {
  kind:
    | "pen"
    | "shape"
    | "hl"
    | "erase"
    | "move"
    | "resize"
    | "endpoint"
    | "marquee";
  pid: number;
  cx: number;
  cy: number;
  [k: string]: any;
}
interface BindHit {
  id: string;
  anchor: Anchor;
  box: Box;
}

export function useInkCanvas({
  kind,
  filePath,
  page,
  toStored,
  toScreen,
  textLines,
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
    textLines,
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

  const ix = useRef<IX | null>(null);
  const hover = useRef<{ x: number; y: number } | null>(null);
  const mods = useRef({ shift: false, alt: false });
  const rectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef(0);
  const settleRef = useRef(0);
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

  const dpr = () => window.devicePixelRatio || 1;

  /* ───────────── contexts ───────────── */

  const getStaticCtx = () => {
    if (!staticCtxRef.current)
      staticCtxRef.current = staticRef.current?.getContext("2d") ?? null;
    return staticCtxRef.current;
  };
  const getDynamicCtx = () => {
    if (!dynamicCtxRef.current)
      dynamicCtxRef.current =
        dynamicRef.current?.getContext("2d", { desynchronized: true }) ?? null;
    return dynamicCtxRef.current;
  };

  /* ───────────── persistence ───────────── */

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
          console.error("saveDrawing returned false after retries");
          window.dispatchEvent(
            new CustomEvent("margyn-save-error", {
              detail: "Failed to save drawing. Please try again.",
            }),
          );
        } else {
          window.dispatchEvent(new Event("margyn-data-changed"));
        }
      })
      .catch((err) => {
        console.error("saveDrawing failed:", err);
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

  /* ───────────── scheduling ───────────── */

  const schedule = useCallback(() => {
    if (!rafRef.current)
      rafRef.current = requestAnimationFrame(() => api.current?.frame());
  }, []);

  /* ───────────── geometry cache ───────────── */

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

  /* ───────────── rendering ───────────── */

  function redraw() {
    const c = staticRef.current;
    const ctx = getStaticCtx();
    if (!c || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const d = dpr();
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const hide = hiddenRef.current;
    for (const s of linesRef.current) {
      if (hide && s.id && hide.has(s.id)) continue;
      paintStroke(ctx, s, geom(s).pts);
    }
  }

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
      if (changed) {
        mapVer.current++;
        api.current?.redraw();
        schedule();
      }
    },
    [schedule],
  );

  /* ───────────── history / commit ───────────── */

  function pushHistory(prev: Stroke[]) {
    const h = hist.current;
    h.past.push(prev);
    if (h.past.length > MAX_HISTORY) h.past.shift();
    h.future = [];
  }
  function commit(next: Stroke[], added?: Stroke) {
    pushHistory(linesRef.current);
    linesRef.current = next;
    scheduleSave();
    if (added) {
      const ctx = getStaticCtx();
      const d = dpr();
      if (ctx) {
        ctx.setTransform(d, 0, 0, d, 0, 0);
        paintStroke(ctx, added, geom(added).pts);
      }
    } else redraw();
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
    redraw();
    schedule();
  }
  function undo() {
    const h = hist.current;
    if (ix.current || !h.past.length) return;
    h.future.push(linesRef.current);
    linesRef.current = h.past.pop()!;
    afterHistoryChange();
  }
  function redo() {
    const h = hist.current;
    if (ix.current || !h.future.length) return;
    h.past.push(linesRef.current);
    linesRef.current = h.future.pop()!;
    afterHistoryChange();
  }
  const settle = () => {
    settleRef.current = SETTLE_FRAMES;
    schedule();
  };

  /* ───────────── binding / selection helpers ───────────── */

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

  /* ───────────── transform pipeline (move / resize / nudge) ───────────── */

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

  /* ───────────── eraser ───────────── */

  function eraseSegment(X: IX, x0: number, y0: number, x1: number, y1: number) {
    const R: number = X.R;
    const bx0 = Math.min(x0, x1) - R,
      by0 = Math.min(y0, y1) - R,
      bx1 = Math.max(x0, x1) + R,
      by1 = Math.max(y0, y1) + R;
    let changed = false;
    const next: Stroke[] = [];
    for (const s of linesRef.current) {
      const b = geom(s).box;
      if (b.x > bx1 || b.x + b.w < bx0 || b.y > by1 || b.y + b.h < by0) {
        next.push(s);
        continue;
      }
      const res = eraseGeometry(s, geom(s).pts, x0, y0, x1, y1, R);
      if (res === null) {
        next.push(s);
        continue;
      }
      changed = true;
      if (res === "remove") continue;
      const k = kindOf(s);
      if (k === "highlight-rect") {
        next.push({ ...s, points: toStoredPts(res[0]) });
      } else {
        res.forEach((part: number[], i: number) =>
          next.push({
            ...s,
            id: i === 0 ? s.id : uid(),
            points: toStoredPts(part),
          }),
        );
      }
    }
    if (changed) {
      linesRef.current = next;
      X.changed = true;
      X.dirty = true;
      schedule();
    }
  }

  /* ───────────── shapes ───────────── */

  function shapeGeom(X: IX) {
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

  function transformFn(X: IX): (x: number, y: number) => [number, number] {
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
      X.box,
      X.handle,
      X.cx,
      X.cy,
      mods.current.shift,
      mods.current.alt,
    );
  }

  /* ───────────── frame (overlay canvas) ───────────── */

  function idleOverlay(ctx: CanvasRenderingContext2D) {
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

  function renderFrame() {
    const c = dynamicRef.current;
    const ctx = getDynamicCtx();
    if (!c || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const d = dpr();
    ctx.setTransform(d, 0, 0, d, 0, 0);

    const X = ix.current;
    if (!X) {
      idleOverlay(ctx);
      return;
    }

    switch (X.kind) {
      case "pen": {
        paintStroke(ctx, X.style, X.pts);
        const pr: number[] = X.pred;
        if (pr.length) {
          const p: number[] = X.pts;
          ctx.save();
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.lineWidth = X.style.size;
          ctx.strokeStyle = X.style.color;
          ctx.beginPath();
          ctx.moveTo(p[p.length - 2], p[p.length - 1]);
          for (let i = 0; i < pr.length; i += 2) ctx.lineTo(pr[i], pr[i + 1]);
          ctx.stroke();
          ctx.restore();
        }
        break;
      }
      case "erase": {
        if (X.dirty) {
          X.dirty = false;
          redraw();
        }
        drawEraserRing(ctx, X.cx, X.cy, X.R);
        break;
      }
      case "shape": {
        const g = shapeGeom(X);
        X.out = g;
        const s: Stroke = {
          points: [],
          color: cfg.current.color,
          size: cfg.current.size,
          tool: X.tool,
          start: X.startB,
          end: g.endB,
        };
        paintStroke(ctx, s, g.p);
        if (X.startHint)
          drawAnchorHints(ctx, X.startHint.box, X.startB?.anchor ?? null);
        if (g.hint) drawAnchorHints(ctx, g.hint.box, g.endB?.anchor ?? null);
        break;
      }
      case "hl": {
        const rects = selectionRects(
          cfg.current.textLines || [],
          X.ax,
          X.ay,
          X.cx,
          X.cy,
        );
        X.rects = rects;
        const flat: number[] = [];
        for (const r of rects) flat.push(r[0], r[1], r[2], r[3]);
        paintStroke(
          ctx,
          {
            points: [],
            color: cfg.current.color,
            size: 1,
            tool: "highlight-rect",
          },
          flat,
        );
        break;
      }
      case "move":
      case "resize": {
        const fn = transformFn(X);
        const out = computeTransformed(X.movers, X.deps, fn);
        for (const s of X.movers.concat(X.deps) as Stroke[]) {
          const q = out.get(s.id!);
          if (q) paintStroke(ctx, s, q);
        }
        const info = selectionInfo(out);
        if (info) drawSelectionUI(ctx, info);
        break;
      }
      case "endpoint": {
        const s: Stroke = X.stroke;
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
        X.result = { stroke: ns, q };
        paintStroke(ctx, ns, q);
        if (hint) drawAnchorHints(ctx, hint.box, bind?.anchor ?? null);
        const info = selectionInfo(new Map([[s.id!, q]]));
        if (info) drawSelectionUI(ctx, info);
        break;
      }
      case "marquee": {
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
        break;
      }
    }
  }

  function frame() {
    rafRef.current = 0;
    if (settleRef.current > 0) {
      settleRef.current--;
      schedule();
      return;
    }
    renderFrame();
  }

  /* ───────────── pointer logic ───────────── */

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

  function addPenPoint(X: IX, x: number, y: number, force = false) {
    const p: number[] = X.pts;
    const n = p.length;
    if (n) {
      const dx = x - p[n - 2],
        dy = y - p[n - 1];
      const d2 = dx * dx + dy * dy;
      if (force ? d2 === 0 : d2 < MIN_DIST2) return;
    }
    p.push(x, y);
    X.stored.push(store(x, y));
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!loadedRef.current || ix.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.pointerType === "touch" && performance.now() < penUntil.current)
      return;
    const c = dynamicRef.current;
    if (!c) return;
    const t = cfg.current.tool;
    if (
      t === "highlighter" &&
      !(cfg.current.textLines && cfg.current.textLines.length)
    )
      return;

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

    const base = { pid: e.pointerId, cx: x, cy: y };
    const { color, size } = cfg.current;

    switch (t) {
      case "pen": {
        const X: IX = {
          ...base,
          kind: "pen",
          pts: [],
          stored: [],
          pred: [],
          ptype: e.pointerType,
          style: { points: [], color, size, tool: "pen" } as Stroke,
        };
        ix.current = X;
        addPenPoint(X, x, y, true);
        break;
      }
      case "eraser": {
        const X: IX = {
          ...base,
          kind: "erase",
          R: (size * 3) / 2,
          lx: x,
          ly: y,
          snap: linesRef.current,
          changed: false,
          dirty: false,
        };
        ix.current = X;
        eraseSegment(X, x, y, x, y);
        break;
      }
      case "highlighter":
        ix.current = { ...base, kind: "hl", ax: x, ay: y, rects: [] };
        break;
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
        ix.current = {
          ...base,
          kind: "shape",
          tool: t,
          sx,
          sy,
          startB,
          startHint,
          out: null,
        };
        break;
      }
      case "select": {
        const h = hitHandle(x, y);
        if (h && h.type === "end") {
          const s = selected()[0];
          hiddenRef.current = new Set([s.id!]);
          redraw();
          ix.current = {
            ...base,
            kind: "endpoint",
            stroke: s,
            which: h.which,
            result: null,
          };
        } else if (h && h.type === "handle") {
          const info = selectionInfo()!;
          startTransform("resize", base, info.bbox!, h.id);
        } else {
          const hit = hitTop(x, y);
          if (hit) {
            const id = hit.id!;
            if (e.shiftKey) {
              if (selRef.current.has(id)) {
                selRef.current.delete(id);
                // toggled off → no drag
                try {
                  c.releasePointerCapture(e.pointerId);
                } catch {}
                schedule();
                if (e.pointerType === "pen")
                  penUntil.current = performance.now() + 600;
                return;
              }
              selRef.current.add(id);
            } else if (!selRef.current.has(id)) {
              selRef.current = new Set([id]);
            }
            startTransform("move", base, null, null);
          } else {
            const keep = e.shiftKey
              ? new Set(selRef.current)
              : new Set<string>();
            selRef.current = new Set(keep);
            ix.current = { ...base, kind: "marquee", ax: x, ay: y, base: keep };
          }
        }
        break;
      }
    }
    schedule();
  }

  function startTransform(
    k: "move" | "resize",
    base: { pid: number; cx: number; cy: number },
    box: Box | null,
    handle: HandleId | null,
  ) {
    const movers = selected();
    const ids = new Set(movers.map((s) => s.id!));
    const deps = findDeps(ids);
    hiddenRef.current = new Set([...ids, ...deps.map((s) => s.id!)]);
    redraw();
    ix.current = {
      ...base,
      kind: k,
      sx: base.cx,
      sy: base.cy,
      movers,
      deps,
      ids,
      box,
      handle,
    };
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
      if (t === "arrow" || t === "eraser") schedule();
      return;
    }
    if (e.pointerId !== X.pid) return;
    const r = rectRef.current;
    if (!r) return;

    const ne = e.nativeEvent as PointerEvent & {
      getPredictedEvents?: () => PointerEvent[];
    };
    X.cx = e.clientX - r.left;
    X.cy = e.clientY - r.top;

    if (X.kind === "pen") {
      const co = ne.getCoalescedEvents?.();
      const list = co && co.length ? co : [ne];
      for (const ev of list)
        addPenPoint(X, ev.clientX - r.left, ev.clientY - r.top);
      const pr: number[] = [];
      if (X.ptype === "pen") {
        const pe = ne.getPredictedEvents?.();
        if (pe)
          for (let i = 0; i < pe.length && i < MAX_PREDICTED; i++)
            pr.push(pe[i].clientX - r.left, pe[i].clientY - r.top);
      }
      X.pred = pr;
    } else if (X.kind === "erase") {
      const co = ne.getCoalescedEvents?.();
      const list = co && co.length ? co : [ne];
      for (const ev of list) {
        const px = ev.clientX - r.left,
          py = ev.clientY - r.top;
        eraseSegment(X, X.lx, X.ly, px, py);
        X.lx = px;
        X.ly = py;
      }
    }
    schedule();
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
        X.pred = [];
        if (ok) addPenPoint(X, X.cx, X.cy, true);
        renderFrame(); // dynamic == final geometry, byte for byte
        ix.current = null;
        const s: Stroke = {
          id: uid(),
          points: X.stored,
          color: X.style.color,
          size: X.style.size,
          tool: "pen",
        };
        commit(linesRef.current.concat(s), s);
        settle(); // keep dynamic visible until static has been presented → no blink
        return;
      }
      case "erase": {
        ix.current = null;
        if (X.changed) {
          const cleaned = sanitize(linesRef.current);
          pushHistory(X.snap);
          linesRef.current = cleaned;
          scheduleSave();
          redraw();
        }
        break;
      }
      case "shape": {
        if (!ok) {
          ix.current = null;
          break;
        }
        const g = shapeGeom(X);
        ix.current = null;
        if (Math.hypot(g.p[2] - g.p[0], g.p[3] - g.p[1]) >= 3) {
          const s: Stroke = {
            id: uid(),
            points: toStoredPts(g.p),
            color: cfg.current.color,
            size: cfg.current.size,
            tool: X.tool,
            start: X.startB,
            end: g.endB,
          };
          renderFrameWith(X, g);
          commit(linesRef.current.concat(s), s);
          settle();
          return;
        }
        break;
      }
      case "hl": {
        ix.current = null;
        if (!ok) break;
        const rects = selectionRects(
          cfg.current.textLines || [],
          X.ax,
          X.ay,
          X.cx,
          X.cy,
        );
        if (rects.length) {
          const pts: number[][] = [];
          for (const q of rects) {
            pts.push(store(q[0], q[1]), store(q[2], q[3]));
          }
          const s: Stroke = {
            id: uid(),
            points: pts,
            color: cfg.current.color,
            size: 1,
            tool: "highlight-rect",
          };
          commit(linesRef.current.concat(s), s);
          settle();
          return;
        } else {
          // ✅ اگر روی متن نبود، کاربر پیغام ببینه
          window.dispatchEvent(new CustomEvent("margyn-no-text"));
        }
        break;
      }
      case "move":
      case "resize": {
        ix.current = null;
        const moved = ok && Math.hypot(X.cx - X.sx, X.cy - X.sy) > 2;
        hiddenRef.current = null;
        if (moved) {
          commit(transformLines(X.ids, transformFn(X)));
          settle();
        } else {
          redraw();
        }
        break;
      }
      case "endpoint": {
        ix.current = null;
        hiddenRef.current = null;
        if (ok && X.result) {
          const { stroke, q } = X.result as { stroke: Stroke; q: number[] };
          const ns: Stroke = { ...stroke, points: toStoredPts(q) };
          commit(linesRef.current.map((s) => (s.id === ns.id ? ns : s)));
          settle();
        } else redraw();
        break;
      }
      case "marquee":
        ix.current = null;
        break;
    }
    schedule();
  }

  // final preview frame for shapes, using the exact geometry that gets committed
  function renderFrameWith(X: IX, g: { p: number[]; endB: Binding | null }) {
    const c = dynamicRef.current;
    const ctx = getDynamicCtx();
    if (!c || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    const d = dpr();
    ctx.setTransform(d, 0, 0, d, 0, 0);
    paintStroke(
      ctx,
      {
        points: [],
        color: cfg.current.color,
        size: cfg.current.size,
        tool: X.tool,
        start: X.startB,
        end: g.endB,
      },
      g.p,
    );
  }

  /* ───────────── actions ───────────── */

  function clearSelection() {
    if (!selRef.current.size) return;
    selRef.current = new Set();
    schedule();
  }
  function deleteSelected() {
    const ids = selRef.current;
    if (!ids.size) return;
    commit(sanitize(linesRef.current.filter((s) => !ids.has(s.id!))));
    selRef.current = new Set();
    schedule();
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
    commit(linesRef.current.concat(clones));
    selRef.current = new Set(clones.map((s) => s.id!));
    schedule();
  }
  function nudge(dx: number, dy: number) {
    const ids = selRef.current;
    if (!ids.size) return;
    commit(transformLines(ids, (x, y) => [x + dx, y + dy]));
    schedule();
  }
  function recolor(c: string) {
    const ids = selRef.current;
    if (!ids.size) return;
    commit(
      linesRef.current.map((s) => (ids.has(s.id!) ? { ...s, color: c } : s)),
    );
    schedule();
  }
  function selectAll() {
    selRef.current = new Set(
      linesRef.current.filter((s) => kindOf(s) !== "eraser").map((s) => s.id!),
    );
    schedule();
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
      case "Delete":
      case "Backspace":
        e.preventDefault();
        deleteSelected();
        break;
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
    if (ix.current) schedule();
  }

  function clearDynamicNow() {
    const c = dynamicRef.current;
    const ctx = getDynamicCtx();
    if (!c || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
  }

  api.current = {
    frame,
    redraw,
    clearSelection,
    clearDynamicNow,
    undo,
    redo,
    recolor,
    onKey,
    onModKey,
    down,
    move,
    finish,
  };

  /* ───────────── effects ───────────── */

  // load page data
  useEffect(() => {
    let alive = true;
    loadedRef.current = false;
    ix.current = null;
    hiddenRef.current = null;
    selRef.current = new Set();
    hist.current = { past: [], future: [] };
    linesRef.current = [];
    api.current.clearDynamicNow();
    api.current.redraw();

    Promise.resolve(loadDrawing(filePath, page, kind))
      .then((saved: unknown) => {
        if (!alive) return;
        const arr = Array.isArray(saved) ? (saved as Stroke[]) : [];
        for (const s of arr) if (!s.id) s.id = uid();
        linesRef.current = arr;
        loadedRef.current = true;
        api.current.redraw();
      })
      .catch((err) => {
        console.error("loadDrawing failed:", err);
        if (alive) loadedRef.current = true;
      });

    return () => {
      alive = false;
      flush();
    };
  }, [filePath, page, kind, flush]);

  // external events
  useEffect(() => {
    const resetAll = () => {
      dropPendingSave();
      linesRef.current = [];
      selRef.current = new Set();
      hist.current = { past: [], future: [] };
      hiddenRef.current = null;
      api.current.redraw();
      api.current.clearDynamicNow();
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
          api.current.redraw();
        })
        .catch(console.error);
    };
    const handleHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const mine = () => activeInk?.token === me.current.token;
    const handleUndo = () => mine() && api.current.undo();
    const handleRedo = () => mine() && api.current.redo();
    const key = (e: KeyboardEvent) => api.current.onKey(e);
    const mod = (e: KeyboardEvent) => api.current.onModKey(e);

    window.addEventListener("margyn-clear-all", resetAll);
    window.addEventListener(`margyn-clear-page-${page}`, resetAll);
    window.addEventListener("margyn-reload-all", handleReload);
    window.addEventListener("margyn-undo", handleUndo);
    window.addEventListener("margyn-redo", handleRedo);
    window.addEventListener("pagehide", flush);
    window.addEventListener("keydown", key);
    window.addEventListener("keydown", mod);
    window.addEventListener("keyup", mod);
    document.addEventListener("visibilitychange", handleHide);
    if (!activeInk) activeInk = me.current;
    return () => {
      window.removeEventListener("margyn-clear-all", resetAll);
      window.removeEventListener(`margyn-clear-page-${page}`, resetAll);
      window.removeEventListener("margyn-reload-all", handleReload);
      window.removeEventListener("margyn-undo", handleUndo);
      window.removeEventListener("margyn-redo", handleRedo);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("keydown", key);
      window.removeEventListener("keydown", mod);
      window.removeEventListener("keyup", mod);
      document.removeEventListener("visibilitychange", handleHide);
      if (activeInk === me.current) activeInk = null;
    };
  }, [page, kind, filePath, flush, dropPendingSave]);

  // leaving the select tool drops the selection; text lines changes repaint nothing
  useEffect(() => {
    if (tool !== "select") selRef.current = new Set();
    hover.current = null;
    setCursor("");
    schedule();
  }, [tool, schedule]);

  // picking a colour while something is selected recolours it (Figma-style)
  const prevColor = useRef(color);
  useEffect(() => {
    if (prevColor.current === color) return;
    prevColor.current = color;
    if (cfg.current.tool === "select" && selRef.current.size)
      api.current.recolor(color);
  }, [color]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  /* ───────────── handlers ───────────── */

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onPointerLeave = useCallback(() => {
    hover.current = null;
    if (!ix.current) schedule();
  }, [schedule]);
  const onContextMenu = useCallback(
    (e: React.SyntheticEvent) => e.preventDefault(),
    [],
  );

  return {
    staticRef,
    dynamicRef,
    resize,
    redraw: () => api.current?.redraw(),
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
