import type {
  Anchor,
  Binding,
  Box,
  HandleId,
  Stroke,
  StrokeTool,
} from "./inkTypes";

export type Mapper = (x: number, y: number) => [number, number];

export const ANCHORS: Anchor[] = ["top", "right", "bottom", "left"];

export const uid = () =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

export const rnd = (v: number) => Math.round(v * 10000) / 10000;

export function kindOf(s: Stroke): StrokeTool {
  return s.tool || (s.isEraser ? "eraser" : "pen");
}
export const isBindable = (k: StrokeTool) =>
  k === "rectangle" || k === "circle";

export function flatten(points: number[][], map: Mapper): number[] {
  const out = new Array<number>(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    const [x, y] = map(points[i][0], points[i][1]);
    out[i * 2] = x;
    out[i * 2 + 1] = y;
  }
  return out;
}

/* ───────────── boxes ───────────── */

export function cornerBox(p: number[]): Box {
  const x = Math.min(p[0], p[2]);
  const y = Math.min(p[1], p[3]);
  return { x, y, w: Math.abs(p[0] - p[2]), h: Math.abs(p[1] - p[3]) };
}
export function inflate(b: Box, m: number): Box {
  return { x: b.x - m, y: b.y - m, w: b.w + m * 2, h: b.h + m * 2 };
}
export function unionBoxes(bs: Box[]): Box | null {
  if (!bs.length) return null;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const b of bs) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
export function boxesIntersect(a: Box, b: Box) {
  return !(
    a.x > b.x + b.w ||
    a.x + a.w < b.x ||
    a.y > b.y + b.h ||
    a.y + a.h < b.y
  );
}
function pointsBox(p: number[]): Box {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (let i = 0; i < p.length; i += 2) {
    if (p[i] < x0) x0 = p[i];
    if (p[i] > x1) x1 = p[i];
    if (p[i + 1] < y0) y0 = p[i + 1];
    if (p[i + 1] > y1) y1 = p[i + 1];
  }
  if (x0 === Infinity) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/* ───────────── anchors & connectors ───────────── */

export function anchorPoint(b: Box, a: Anchor): [number, number] {
  switch (a) {
    case "top":
      return [b.x + b.w / 2, b.y];
    case "right":
      return [b.x + b.w, b.y + b.h / 2];
    case "bottom":
      return [b.x + b.w / 2, b.y + b.h];
    default:
      return [b.x, b.y + b.h / 2];
  }
}
export function anchorNormal(a: Anchor): [number, number] {
  switch (a) {
    case "top":
      return [0, -1];
    case "right":
      return [1, 0];
    case "bottom":
      return [0, 1];
    default:
      return [-1, 0];
  }
}

export interface Curve {
  p0: [number, number];
  c1: [number, number];
  c2: [number, number];
  p3: [number, number];
  curved: boolean;
}

const unit = (x: number, y: number): [number, number] => {
  const l = Math.hypot(x, y);
  return l < 1e-6 ? [0, 0] : [x / l, y / l];
};

/** Straight when free, smooth Bézier "Figma-style" when glued to shapes. */
export function connector(
  p: number[],
  start?: Binding | null,
  end?: Binding | null,
): Curve {
  const p0: [number, number] = [p[0], p[1]];
  const p3: [number, number] = [p[2], p[3]];
  if (!start && !end) return { p0, c1: p0, c2: p3, p3, curved: false };

  const d = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]);
  const k = Math.min(Math.max(d * 0.45, 28), 220);
  let c1: [number, number];
  let c2: [number, number];

  if (start) {
    const n = anchorNormal(start.anchor);
    c1 = [p0[0] + n[0] * k, p0[1] + n[1] * k];
  } else c1 = [0, 0];
  if (end) {
    const n = anchorNormal(end.anchor);
    c2 = [p3[0] + n[0] * k, p3[1] + n[1] * k];
  } else c2 = [0, 0];

  if (!start) {
    const u = unit(c2[0] - p0[0], c2[1] - p0[1]);
    c1 = [p0[0] + u[0] * k * 0.6, p0[1] + u[1] * k * 0.6];
  }
  if (!end) {
    const u = unit(p3[0] - c1[0], p3[1] - c1[1]);
    c2 = [p3[0] - u[0] * k * 0.6, p3[1] - u[1] * k * 0.6];
  }
  return { p0, c1, c2, p3, curved: true };
}

export function curvePoint(cv: Curve, t: number): [number, number] {
  const u = 1 - t;
  const a = u * u * u,
    b = 3 * u * u * t,
    c = 3 * u * t * t,
    d = t * t * t;
  return [
    a * cv.p0[0] + b * cv.c1[0] + c * cv.c2[0] + d * cv.p3[0],
    a * cv.p0[1] + b * cv.c1[1] + c * cv.c2[1] + d * cv.p3[1],
  ];
}
export function sampleCurve(cv: Curve, n = 24): number[] {
  if (!cv.curved) return [cv.p0[0], cv.p0[1], cv.p3[0], cv.p3[1]];
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const [x, y] = curvePoint(cv, i / n);
    out.push(x, y);
  }
  return out;
}
export function arrowTangent(cv: Curve): [number, number] {
  let t = unit(cv.p3[0] - cv.c2[0], cv.p3[1] - cv.c2[1]);
  if (t[0] === 0 && t[1] === 0)
    t = unit(cv.p3[0] - cv.c1[0], cv.p3[1] - cv.c1[1]);
  if (t[0] === 0 && t[1] === 0)
    t = unit(cv.p3[0] - cv.p0[0], cv.p3[1] - cv.p0[1]);
  if (t[0] === 0 && t[1] === 0) t = [1, 0];
  return t;
}
export const headLen = (size: number) => Math.max(10, size * 3.2);

/* ───────────── distance helpers ───────────── */

export function distPtSeg2(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const dx = bx - ax,
    dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + t * dx - px,
    cy = ay + t * dy - py;
  return cx * cx + cy * cy;
}

function segsCross(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
) {
  const o = (
    px: number,
    py: number,
    qx: number,
    qy: number,
    rx: number,
    ry: number,
  ) => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = o(ax, ay, bx, by, cx, cy);
  const d2 = o(ax, ay, bx, by, dx, dy);
  const d3 = o(cx, cy, dx, dy, ax, ay);
  const d4 = o(cx, cy, dx, dy, bx, by);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

export function segSegDist2(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
) {
  if (segsCross(ax, ay, bx, by, cx, cy, dx, dy)) return 0;
  return Math.min(
    distPtSeg2(ax, ay, cx, cy, dx, dy),
    distPtSeg2(bx, by, cx, cy, dx, dy),
    distPtSeg2(cx, cy, ax, ay, bx, by),
    distPtSeg2(dx, dy, ax, ay, bx, by),
  );
}

/** Liang–Barsky segment/rect intersection (rect given as l,t,r,b). */
export function segIntersectsRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  l: number,
  t: number,
  r: number,
  b: number,
) {
  let t0 = 0,
    t1 = 1;
  const dx = x1 - x0,
    dy = y1 - y0;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - l, r - x0, y0 - t, b - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const u = q[i] / p[i];
      if (p[i] < 0) {
        if (u > t1) return false;
        if (u > t0) t0 = u;
      } else {
        if (u < t0) return false;
        if (u < t1) t1 = u;
      }
    }
  }
  return true;
}

/* ───────────── outlines / bounds / hit-tests ───────────── */

export function outline(
  kind: StrokeTool,
  p: number[],
  start?: Binding | null,
  end?: Binding | null,
): { poly: number[]; closed: boolean } {
  switch (kind) {
    case "rectangle": {
      const b = cornerBox(p);
      return {
        poly: [b.x, b.y, b.x + b.w, b.y, b.x + b.w, b.y + b.h, b.x, b.y + b.h],
        closed: true,
      };
    }
    case "circle": {
      const b = cornerBox(p);
      const cx = b.x + b.w / 2,
        cy = b.y + b.h / 2;
      const poly: number[] = [];
      const N = 48;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        poly.push(cx + (b.w / 2) * Math.cos(a), cy + (b.h / 2) * Math.sin(a));
      }
      return { poly, closed: true };
    }
    case "line":
      return { poly: [p[0], p[1], p[2], p[3]], closed: false };
    case "arrow":
      return { poly: sampleCurve(connector(p, start, end)), closed: false };
    default:
      return { poly: p, closed: false };
  }
}

export function elementBounds(s: Stroke, p: number[]): Box {
  const k = kindOf(s);
  const half = s.size / 2;
  if (k === "highlight-rect") {
    const bs: Box[] = [];
    for (let i = 0; i + 3 < p.length; i += 4)
      bs.push({
        x: p[i],
        y: p[i + 1],
        w: p[i + 2] - p[i],
        h: p[i + 3] - p[i + 1],
      });
    return unionBoxes(bs) || { x: 0, y: 0, w: 0, h: 0 };
  }
  if (k === "rectangle" || k === "circle") return inflate(cornerBox(p), half);
  if (k === "arrow") {
    const o = outline(k, p, s.start, s.end);
    return inflate(pointsBox(o.poly), Math.max(half, headLen(s.size) * 0.45));
  }
  return inflate(pointsBox(p), half);
}

function polyNear2(
  poly: number[],
  closed: boolean,
  x: number,
  y: number,
): number {
  const n = poly.length >> 1;
  if (n === 0) return Infinity;
  if (n === 1) return (poly[0] - x) ** 2 + (poly[1] - y) ** 2;
  let best = Infinity;
  for (let i = 0; i < n - 1; i++) {
    const d = distPtSeg2(
      x,
      y,
      poly[i * 2],
      poly[i * 2 + 1],
      poly[i * 2 + 2],
      poly[i * 2 + 3],
    );
    if (d < best) best = d;
  }
  if (closed) {
    const d = distPtSeg2(
      x,
      y,
      poly[(n - 1) * 2],
      poly[(n - 1) * 2 + 1],
      poly[0],
      poly[1],
    );
    if (d < best) best = d;
  }
  return best;
}

export function hitStroke(
  s: Stroke,
  p: number[],
  x: number,
  y: number,
  tol: number,
): boolean {
  const k = kindOf(s);
  if (k === "eraser") return false;
  if (k === "highlight-rect") {
    for (let i = 0; i + 3 < p.length; i += 4)
      if (
        x >= p[i] - tol &&
        x <= p[i + 2] + tol &&
        y >= p[i + 1] - tol &&
        y <= p[i + 3] + tol
      )
        return true;
    return false;
  }
  const o = outline(k, p, s.start, s.end);
  const r = tol + s.size / 2;
  return polyNear2(o.poly, o.closed, x, y) <= r * r;
}

export function strokeInRect(s: Stroke, p: number[], r: Box): boolean {
  const k = kindOf(s);
  if (k === "eraser") return false;
  const rr = { l: r.x, t: r.y, r: r.x + r.w, b: r.y + r.h };
  if (k === "highlight-rect") {
    for (let i = 0; i + 3 < p.length; i += 4)
      if (
        boxesIntersect(
          { x: p[i], y: p[i + 1], w: p[i + 2] - p[i], h: p[i + 3] - p[i + 1] },
          r,
        )
      )
        return true;
    return false;
  }
  if (k === "rectangle" || k === "circle")
    return boxesIntersect(cornerBox(p), r);
  const o = outline(k, p, s.start, s.end);
  const n = o.poly.length >> 1;
  if (n === 1)
    return (
      o.poly[0] >= rr.l &&
      o.poly[0] <= rr.r &&
      o.poly[1] >= rr.t &&
      o.poly[1] <= rr.b
    );
  for (let i = 0; i < n - 1; i++)
    if (
      segIntersectsRect(
        o.poly[i * 2],
        o.poly[i * 2 + 1],
        o.poly[i * 2 + 2],
        o.poly[i * 2 + 3],
        rr.l,
        rr.t,
        rr.r,
        rr.b,
      )
    )
      return true;
  return false;
}

/* ───────────── vector eraser ───────────── */

/**
 * Returns null (untouched), "remove" (whole element gone) or the surviving
 * parts in SCREEN space (flat arrays) – pen strokes get split, highlight
 * rects are dropped one by one.
 */
export function eraseGeometry(
  s: Stroke,
  p: number[],
  ex0: number,
  ey0: number,
  ex1: number,
  ey1: number,
  R: number,
): null | "remove" | number[][] {
  const k = kindOf(s);
  if (k === "eraser") return null;

  if (k === "highlight-rect") {
    const keep: number[] = [];
    let touched = false;
    for (let i = 0; i + 3 < p.length; i += 4) {
      const hit = segIntersectsRect(
        ex0,
        ey0,
        ex1,
        ey1,
        p[i] - R,
        p[i + 1] - R,
        p[i + 2] + R,
        p[i + 3] + R,
      );
      if (hit) touched = true;
      else keep.push(p[i], p[i + 1], p[i + 2], p[i + 3]);
    }
    if (!touched) return null;
    return keep.length ? [keep] : "remove";
  }

  const reach = R + s.size / 2;
  const reach2 = reach * reach;

  if (k === "pen") {
    const n = p.length >> 1;
    if (n === 0) return null;
    // subdivide so that a fast (sparse) stroke is cut precisely
    const step = Math.max(reach * 0.25, 1.5);
    const sub: number[] = [p[0], p[1]];
    for (let i = 1; i < n; i++) {
      const ax = p[i * 2 - 2],
        ay = p[i * 2 - 1],
        bx = p[i * 2],
        by = p[i * 2 + 1];
      const len = Math.hypot(bx - ax, by - ay);
      if (len > step) {
        const c = Math.ceil(len / step);
        for (let j = 1; j < c; j++)
          sub.push(ax + ((bx - ax) * j) / c, ay + ((by - ay) * j) / c);
      }
      sub.push(bx, by);
    }
    const m = sub.length >> 1;
    const hit = new Uint8Array(m);
    let any = false;
    for (let i = 0; i < m; i++) {
      if (
        distPtSeg2(sub[i * 2], sub[i * 2 + 1], ex0, ey0, ex1, ey1) <= reach2
      ) {
        hit[i] = 1;
        any = true;
      }
    }
    if (!any) return null;
    const parts: number[][] = [];
    let cur: number[] = [];
    for (let i = 0; i < m; i++) {
      if (hit[i]) {
        if (cur.length >= 4) parts.push(cur);
        cur = [];
      } else cur.push(sub[i * 2], sub[i * 2 + 1]);
    }
    if (cur.length >= 4) parts.push(cur);
    return parts.length ? parts : "remove";
  }

  // shapes / lines / arrows: touching the outline deletes the object
  const o = outline(k, p, s.start, s.end);
  const n = o.poly.length >> 1;
  for (let i = 0; i < n - 1; i++)
    if (
      segSegDist2(
        ex0,
        ey0,
        ex1,
        ey1,
        o.poly[i * 2],
        o.poly[i * 2 + 1],
        o.poly[i * 2 + 2],
        o.poly[i * 2 + 3],
      ) <= reach2
    )
      return "remove";
  if (
    o.closed &&
    n > 2 &&
    segSegDist2(
      ex0,
      ey0,
      ex1,
      ey1,
      o.poly[(n - 1) * 2],
      o.poly[(n - 1) * 2 + 1],
      o.poly[0],
      o.poly[1],
    ) <= reach2
  )
    return "remove";
  return null;
}

/* ───────────── selection handles ───────────── */

export function getHandles(b: Box): { id: HandleId; x: number; y: number }[] {
  const l = b.x,
    t = b.y,
    r = b.x + b.w,
    bt = b.y + b.h,
    cx = b.x + b.w / 2,
    cy = b.y + b.h / 2;
  return [
    { id: "nw", x: l, y: t },
    { id: "n", x: cx, y: t },
    { id: "ne", x: r, y: t },
    { id: "e", x: r, y: cy },
    { id: "se", x: r, y: bt },
    { id: "s", x: cx, y: bt },
    { id: "sw", x: l, y: bt },
    { id: "w", x: l, y: cy },
  ];
}
export const HANDLE_CURSOR: Record<HandleId, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
};

/** Build the scaling function for a bbox handle drag (Shift = keep ratio, Alt = from centre). */
export function resizeFn(
  b: Box,
  handle: HandleId,
  px: number,
  py: number,
  shift: boolean,
  alt: boolean,
): (x: number, y: number) => [number, number] {
  const l = b.x,
    t = b.y,
    r = b.x + b.w,
    bt = b.y + b.h,
    cx = (l + r) / 2,
    cy = (t + bt) / 2;
  const hx = handle.includes("w") ? -1 : handle.includes("e") ? 1 : 0;
  const hy = handle.includes("n") ? -1 : handle.includes("s") ? 1 : 0;
  let nl = l,
    nr = r,
    nt = t,
    nb = bt;
  if (hx < 0) nl = px;
  if (hx > 0) nr = px;
  if (hy < 0) nt = py;
  if (hy > 0) nb = py;
  if (alt) {
    if (hx) {
      const d = hx > 0 ? px - cx : cx - px;
      nl = cx - d;
      nr = cx + d;
    }
    if (hy) {
      const d = hy > 0 ? py - cy : cy - py;
      nt = cy - d;
      nb = cy + d;
    }
  }
  if (shift && b.w > 1 && b.h > 1) {
    const fx = hx ? Math.abs(nr - nl) / b.w : 0;
    const fy = hy ? Math.abs(nb - nt) / b.h : 0;
    const s = Math.max(fx, fy, 0.01);
    const w2 = b.w * s,
      h2 = b.h * s;
    if (hx && !alt) {
      if (hx > 0) {
        nl = l;
        nr = l + w2;
      } else {
        nr = r;
        nl = r - w2;
      }
    } else {
      nl = cx - w2 / 2;
      nr = cx + w2 / 2;
    }
    if (hy && !alt) {
      if (hy > 0) {
        nt = t;
        nb = t + h2;
      } else {
        nb = bt;
        nt = bt - h2;
      }
    } else {
      nt = cy - h2 / 2;
      nb = cy + h2 / 2;
    }
  }
  const kx = b.w > 0.5 ? (nr - nl) / b.w : 1;
  const ky = b.h > 0.5 ? (nb - nt) / b.h : 1;
  return (x, y) => [nl + (x - l) * kx, nt + (y - t) * ky];
}

/** 45° snapping table (y-down screen space) */
const S = Math.SQRT1_2;
const DIRS: [number, number][] = [
  [1, 0],
  [S, S],
  [0, 1],
  [-S, S],
  [-1, 0],
  [-S, -S],
  [0, -1],
  [S, -S],
];
export function snap45(dx: number, dy: number): [number, number] {
  const r = Math.hypot(dx, dy);
  if (r === 0) return [0, 0];
  const k =
    (((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8) | 0;
  return [DIRS[k][0] * r, DIRS[k][1] * r];
}

export function findNearestAnchor(
  b: Box,
  x: number,
  y: number,
): { anchor: Anchor; dist: number } {
  let best: Anchor = "top";
  let bd = Infinity;
  for (const a of ANCHORS) {
    const [ax, ay] = anchorPoint(b, a);
    const d = Math.hypot(ax - x, ay - y);
    if (d < bd) {
      bd = d;
      best = a;
    }
  }
  return { anchor: best, dist: bd };
}

/* ───────────── dynamic cursors ───────────── */
/*
 * All cursors are plain CSS `cursor` values built from an inline SVG.
 *  - the SVG is minified and passed through encodeURIComponent, so `#`, `<`,
 *    `>`, quotes, spaces and newlines are always safe (`#` → `%23`);
 *  - the colour is parsed & re-serialised as `#rrggbb`, so a malformed or
 *    hostile value can never break (or inject into) the SVG;
 *  - results are cached per colour, so the string passed to React is stable.
 */

type RGB = [number, number, number];

const DEFAULT_CURSOR_COLOR: RGB = [0x38, 0xbd, 0xf8];
const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

/** Accepts #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba(), "white", "black". */
export function parseColor(input: string): RGB | null {
  if (typeof input !== "string") return null;
  const s = input.trim().toLowerCase();
  if (s === "white") return [255, 255, 255];
  if (s === "black") return [0, 0, 0];

  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4)
      h = h
        .split("")
        .map((ch) => ch + ch)
        .join("");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }

  const fn = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s);
  if (fn) return [clamp255(+fn[1]), clamp255(+fn[2]), clamp255(+fn[3])];

  return null;
}

const toHex = (c: RGB) =>
  "#" + c.map((v) => clamp255(v).toString(16).padStart(2, "0")).join("");

const mixRGB = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Perceived brightness (YIQ), 0‥255. */
const brightness = ([r, g, b]: RGB) => (r * 299 + g * 587 + b * 114) / 1000;

/** Light colours need a black border, dark colours a white one. */
export const isLightColor = (color: string) =>
  brightness(parseColor(color) ?? DEFAULT_CURSOR_COLOR) >= 128;

/** Minify + URL-encode an SVG into a CSS `cursor` value. */
function svgCursor(
  svg: string,
  hotX: number,
  hotY: number,
  fallback: string,
): string {
  const min = svg
    .replace(/\s*\n\s*/g, "")
    .replace(/>\s+</g, "><")
    .trim();
  return `url("data:image/svg+xml,${encodeURIComponent(min)}") ${hotX} ${hotY}, ${fallback}`;
}

const penCache = new Map<string, string>();

/**
 * Professional pen cursor tinted with `color`.
 * Hot-spot = the exact nib tip (bottom-left), so ink lands where you point.
 */
export const getPenCursor = (color: string): string => {
  const rgb = parseColor(color) ?? DEFAULT_CURSOR_COLOR;
  const base = toHex(rgb);
  const hit = penCache.get(base);
  if (hit) return hit;

  const hi = toHex(mixRGB(rgb, [255, 255, 255], 0.38));
  const lo = toHex(mixRGB(rgb, [0, 0, 0], 0.3));
  const cap = toHex(mixRGB(rgb, [0, 0, 0], 0.5));
  const edge = brightness(rgb) >= 128 ? "#000000" : "#ffffff";

  // Pen is drawn horizontally in local space (nib tip at 0,0, body to +x)
  // and rotated -45° so the tip points to the bottom-left.
  const silhouette =
    '<path d="M0 0L8 -2.9V2.9Z"/>' +
    '<rect x="8" y="-3.3" width="2.6" height="6.6"/>' +
    '<rect x="10.6" y="-3.5" width="18.4" height="7" rx="1.8"/>' +
    '<rect x="29" y="-2.8" width="2.6" height="5.6" rx="1.2"/>';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
<defs>
<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".5" stop-color="${base}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
<linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f4f5"/><stop offset=".55" stop-color="#a1a1aa"/><stop offset="1" stop-color="#52525b"/></linearGradient>
<linearGradient id="n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fafafa"/><stop offset="1" stop-color="#b4b4bb"/></linearGradient>
</defs>
<g transform="translate(1.1 1.5) translate(3 29) rotate(-45)" opacity=".3" fill="#000" stroke="#000" stroke-width="2.6" stroke-linejoin="round">${silhouette}</g>
<g transform="translate(3 29) rotate(-45)">
<g fill="${edge}" stroke="${edge}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">${silhouette}</g>
<path d="M0 0L8.2 -2.9V2.9Z" fill="url(#n)"/>
<path d="M0 0L3.2 -1.15V1.15Z" fill="${base}" stroke="${lo}" stroke-width=".3" stroke-linejoin="round"/>
<rect x="8" y="-3.3" width="2.6" height="6.6" fill="url(#m)"/>
<rect x="10.6" y="-3.5" width="18.4" height="7" rx="1.8" fill="url(#b)"/>
<rect x="12.4" y="-3.5" width="1.1" height="7" fill="${lo}" opacity=".55"/>
<path d="M14.6 -1.9H27.4" stroke="#fff" stroke-opacity=".5" stroke-width="1.1" stroke-linecap="round"/>
<rect x="29" y="-2.8" width="2.6" height="5.6" rx="1.2" fill="${cap}"/>
</g>
</svg>`;

  const out = svgCursor(svg, 3, 29, "crosshair");
  if (penCache.size > 64) penCache.clear();
  penCache.set(base, out);
  return out;
};

let eraserCache: string | null = null;

/** Same eraser artwork as before – just encoded safely now. */
export const getEraserCursor = (): string => {
  if (eraserCache) return eraserCache;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <g transform="translate(16, 16) rotate(-45) translate(-16, -16)">
      <rect x="6" y="10" width="20" height="12" rx="2" fill="#000000" opacity="0.25" transform="translate(1, 2)" />
      <rect x="6" y="10" width="20" height="12" rx="2" fill="#ffffff" stroke="#ffffff" stroke-width="4" />
      <rect x="6" y="10" width="20" height="12" rx="2" fill="#e4e4e7" stroke="#18181b" stroke-width="2" />
      <path d="M 8 10 L 14 10 L 14 22 L 8 22 A 2 2 0 0 1 6 20 L 6 12 A 2 2 0 0 1 8 10 Z" fill="#f43f5e" stroke="#18181b" stroke-width="2" />
      <line x1="14" y1="10" x2="14" y2="22" stroke="#18181b" stroke-width="2" />
      <path d="M 8 11 L 12 11" stroke="#ffffff" stroke-opacity="0.6" stroke-width="1.5" stroke-linecap="round" />
    </g>
  </svg>`;
  eraserCache = svgCursor(svg, 9, 23, "crosshair");
  return eraserCache;
};

/**
 * Single source of truth for the canvas cursor of a tool.
 *   pen + shapes (rectangle / circle / line / arrow) → coloured pen
 *   eraser → eraser · highlighter → text · select → default
 */
export function getToolCursor(tool: string, color: string): string {
  switch (tool) {
    case "select":
      return "default";
    case "eraser":
      return getEraserCursor();
    case "highlighter":
      return "text";
    case "pen":
    case "rectangle":
    case "circle":
    case "line":
    case "arrow":
      return getPenCursor(color);
    default:
      return "default";
  }
}
