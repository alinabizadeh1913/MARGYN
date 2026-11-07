import {
  PDFDocument,
  PDFPage,
  BlendMode,
  LineCapStyle,
  rgb,
  type Color,
} from "pdf-lib";

/* =========================================================
   MARGYN — Flat PDF Export
   ---------------------------------------------------------
   Burns every "pdf"-target drawing into the PDF so it is
   visible in ANY viewer (Acrobat, Preview, Chrome, phones…).

   Design notes
   - Stored points are normalized (0..1) over the page exactly
     as the page was DISPLAYED (so page /Rotate and /CropBox
     are already baked in). We map them back to PDF user space.
   - Everything is emitted as vector paths through ONE helper
     (`emitPath`). pdf-lib's drawSvgPath() flips Y around the
     path origin, so we feed it (X, -Y) with origin (0,0): the
     result lands on exactly (X, Y) in PDF user space,
     regardless of rotation, crop box or media box offset.
     (The previous code left y at its default 0, so every pen
     stroke and arrow head was painted BELOW the page.)
   - Stroke widths are stored in on-screen pixels, so they are
     divided by `viewScale` (the zoom the page was drawn at)
     to look identical in the exported file.
   - Margin-canvas drawings are intentionally NOT exported.
   - Notes are intentionally NOT exported.
========================================================= */

export interface FlatPdfOptions {
  /**
   * Zoom the pages were displayed at while drawing (the viewer's `scale`,
   * default 1.3 in the app). Used to convert on-screen pixel stroke widths
   * to PDF points. Defaults to 1 (width used as-is).
   */
  viewScale?: number;
}

type Pt = [number, number];
type Mapper = (u: number, v: number) => Pt;

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface Binding {
  anchor: "top" | "right" | "bottom" | "left";
}

interface StoredStroke {
  points: number[][];
  color?: string;
  size?: number;
  tool?: string;
  isEraser?: boolean;
  start?: Binding | null;
  end?: Binding | null;
}

/* ───────────── colour ───────────── */

function parseColor(input: unknown): RGBA {
  const fallback: RGBA = { r: 0, g: 0, b: 0, a: 1 };
  if (typeof input !== "string") return fallback;
  const s = input.trim().toLowerCase();
  if (s === "white") return { r: 1, g: 1, b: 1, a: 1 };
  if (s === "black") return fallback;

  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length <= 4)
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    return {
      r: parseInt(h.slice(0, 2), 16) / 255,
      g: parseInt(h.slice(2, 4), 16) / 255,
      b: parseInt(h.slice(4, 6), 16) / 255,
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }

  const fn =
    /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?/.exec(
      s,
    );
  if (fn) {
    const c = (n: string) => Math.max(0, Math.min(255, +n)) / 255;
    return {
      r: c(fn[1]),
      g: c(fn[2]),
      b: c(fn[3]),
      a: fn[4] !== undefined ? Math.max(0, Math.min(1, +fn[4])) : 1,
    };
  }
  return fallback;
}

const toPdfColor = (c: RGBA): Color => rgb(c.r, c.g, c.b);

/* ───────────── page geometry ───────────── */

/**
 * Returns the displayed page size (points) and a mapper from NORMALIZED
 * displayed coordinates (u right, v down, 0..1) to PDF user space (y-up).
 * Handles /Rotate (0/90/180/270) and a /CropBox that differs from /MediaBox.
 */
function pageGeometry(page: PDFPage) {
  const box = page.getCropBox();
  const cx = box.x,
    cy = box.y,
    cw = box.width,
    ch = box.height;
  const rot =
    (((Math.round(page.getRotation().angle / 90) * 90) % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  const W = swap ? ch : cw; // displayed width  (pt)
  const H = swap ? cw : ch; // displayed height (pt)

  let toPdf: Mapper;
  switch (rot) {
    case 90:
      toPdf = (u, v) => [cx + v * cw, cy + u * ch];
      break;
    case 180:
      toPdf = (u, v) => [cx + (1 - u) * cw, cy + v * ch];
      break;
    case 270:
      toPdf = (u, v) => [cx + (1 - v) * cw, cy + (1 - u) * ch];
      break;
    default:
      toPdf = (u, v) => [cx + u * cw, cy + (1 - v) * ch];
  }
  return { W, H, toPdf };
}

/* ───────────── path emitter ───────────── */

interface PathStyle {
  stroke?: RGBA;
  width?: number;
  cap?: LineCapStyle;
  fill?: RGBA;
  fillOpacity?: number;
  blend?: BlendMode;
}

const f = (n: number) => (Math.round(n * 1000) / 1000).toString();

/** Draw a path whose coordinates are already in PDF user space (y-up). */
function emitPath(page: PDFPage, segs: string[], st: PathStyle) {
  if (!segs.length) return;
  const d = segs.join(" ");
  page.drawSvgPath(d, {
    x: 0,
    y: 0,
    ...(st.stroke
      ? {
          borderColor: toPdfColor(st.stroke),
          borderWidth: Math.max(0.05, st.width ?? 1),
          borderOpacity: st.stroke.a,
          borderLineCap: st.cap ?? LineCapStyle.Round,
        }
      : {}),
    ...(st.fill
      ? {
          color: toPdfColor(st.fill),
          opacity: (st.fillOpacity ?? 1) * st.fill.a,
        }
      : {}),
    ...(st.blend ? { blendMode: st.blend } : {}),
  });
}

/** SVG-flip helper: PDF (X,Y) → path coordinate (X,-Y). */
const sv = (p: Pt): string => `${f(p[0])} ${f(-p[1])}`;

/* ───────────── shape builders (display space, pt, y-down) ───────────── */

type DPt = [number, number];

/** Catmull-Rom → cubic Bézier: identical to the on-screen renderer. */
function penSegments(pts: DPt[], T: (p: DPt) => Pt): string[] {
  const n = pts.length;
  if (!n) return [];
  const segs = [`M ${sv(T(pts[0]))}`];
  if (n === 1) {
    segs.push(`L ${sv(T([pts[0][0] + 0.01, pts[0][1]]))}`);
    return segs;
  }
  for (let k = 0; k < n - 1; k++) {
    const p0 = pts[Math.max(0, k - 1)];
    const p1 = pts[k];
    const p2 = pts[k + 1];
    const p3 = pts[Math.min(n - 1, k + 2)];
    const c1: DPt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: DPt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    segs.push(`C ${sv(T(c1))}, ${sv(T(c2))}, ${sv(T(p2))}`);
  }
  return segs;
}

const KAPPA = 0.5522847498307936;

function ellipseSegments(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  T: (p: DPt) => Pt,
): string[] {
  const ox = rx * KAPPA,
    oy = ry * KAPPA;
  const P = (x: number, y: number) => sv(T([x, y]));
  return [
    `M ${P(cx + rx, cy)}`,
    `C ${P(cx + rx, cy + oy)}, ${P(cx + ox, cy + ry)}, ${P(cx, cy + ry)}`,
    `C ${P(cx - ox, cy + ry)}, ${P(cx - rx, cy + oy)}, ${P(cx - rx, cy)}`,
    `C ${P(cx - rx, cy - oy)}, ${P(cx - ox, cy - ry)}, ${P(cx, cy - ry)}`,
    `C ${P(cx + ox, cy - ry)}, ${P(cx + rx, cy - oy)}, ${P(cx + rx, cy)}`,
    "Z",
  ];
}

function rectSegments(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  T: (p: DPt) => Pt,
): string[] {
  const P = (x: number, y: number) => sv(T([x, y]));
  return [
    `M ${P(x0, y0)}`,
    `L ${P(x1, y0)}`,
    `L ${P(x1, y1)}`,
    `L ${P(x0, y1)}`,
    "Z",
  ];
}

/* ───────────── arrow geometry (port of inkGeometry.connector) ───────────── */

const unit = (x: number, y: number): DPt => {
  const l = Math.hypot(x, y);
  return l < 1e-6 ? [0, 0] : [x / l, y / l];
};

function anchorNormal(a: Binding["anchor"]): DPt {
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

interface Curve {
  p0: DPt;
  c1: DPt;
  c2: DPt;
  p3: DPt;
  curved: boolean;
}

/** Same maths as the editor, evaluated in SCREEN pixels (`p` is screen-space). */
function connector(
  p0: DPt,
  p3: DPt,
  start?: Binding | null,
  end?: Binding | null,
): Curve {
  if (!start && !end) return { p0, c1: p0, c2: p3, p3, curved: false };
  const d = Math.hypot(p3[0] - p0[0], p3[1] - p0[1]);
  const k = Math.min(Math.max(d * 0.45, 28), 220);
  let c1: DPt = [0, 0];
  let c2: DPt = [0, 0];
  if (start) {
    const n = anchorNormal(start.anchor);
    c1 = [p0[0] + n[0] * k, p0[1] + n[1] * k];
  }
  if (end) {
    const n = anchorNormal(end.anchor);
    c2 = [p3[0] + n[0] * k, p3[1] + n[1] * k];
  }
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

function arrowTangent(cv: Curve): DPt {
  let t = unit(cv.p3[0] - cv.c2[0], cv.p3[1] - cv.c2[1]);
  if (t[0] === 0 && t[1] === 0)
    t = unit(cv.p3[0] - cv.c1[0], cv.p3[1] - cv.c1[1]);
  if (t[0] === 0 && t[1] === 0)
    t = unit(cv.p3[0] - cv.p0[0], cv.p3[1] - cv.p0[1]);
  if (t[0] === 0 && t[1] === 0) t = [1, 0];
  return t;
}

const headLenPx = (size: number) => Math.max(10, size * 3.2);

/* ───────────── validation ───────────── */

function isValidPoint(pt: unknown): pt is [number, number] {
  return (
    Array.isArray(pt) &&
    pt.length >= 2 &&
    typeof pt[0] === "number" &&
    Number.isFinite(pt[0]) &&
    typeof pt[1] === "number" &&
    Number.isFinite(pt[1])
  );
}

/** Does the stroke's bbox touch the page (with margin, in normalized units)? */
function touchesPage(points: number[][], mx: number, my: number): boolean {
  let x0 = Infinity,
    x1 = -Infinity,
    y0 = Infinity,
    y1 = -Infinity;
  for (const [x, y] of points) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return !(x1 < -mx || x0 > 1 + mx || y1 < -my || y0 > 1 + my);
}

/* ───────────── per-stroke drawing ───────────── */

function drawStroke(
  page: PDFPage,
  s: StoredStroke,
  tool: string,
  geo: ReturnType<typeof pageGeometry>,
  viewScale: number,
) {
  const { W, H, toPdf } = geo;
  const rawSize =
    typeof s.size === "number" && s.size > 0 && Number.isFinite(s.size)
      ? s.size
      : 2;
  const width = rawSize / viewScale;
  const col = parseColor(s.color);

  // normalized → display points (y-down) → PDF user space
  const D = (pt: number[]): DPt => [pt[0] * W, pt[1] * H];
  const T = (p: DPt): Pt => toPdf(p[0] / W, p[1] / H);
  const pts = s.points.map(D);

  switch (tool) {
    case "pen": {
      if (pts.length === 1) {
        emitPath(
          page,
          ellipseSegments(pts[0][0], pts[0][1], width / 2, width / 2, T),
          {
            fill: col,
          },
        );
        return;
      }
      emitPath(page, penSegments(pts, T), {
        stroke: col,
        width,
        cap: LineCapStyle.Round,
      });
      return;
    }

    case "highlight-rect": {
      // points come as [left,top],[right,bottom] pairs; ONE path so overlaps
      // are filled once (no darker seams) — same as the on-screen renderer.
      const segs: string[] = [];
      for (let i = 0; i + 1 < pts.length; i += 2) {
        const a = pts[i],
          b = pts[i + 1];
        const x0 = Math.min(a[0], b[0]),
          x1 = Math.max(a[0], b[0]),
          y0 = Math.min(a[1], b[1]),
          y1 = Math.max(a[1], b[1]);
        if (x1 - x0 <= 0 || y1 - y0 <= 0) continue;
        segs.push(...rectSegments(x0, y0, x1, y1, T));
      }
      emitPath(page, segs, {
        fill: col,
        fillOpacity: 0.4,
        blend: BlendMode.Multiply,
      });
      return;
    }

    case "rectangle": {
      if (pts.length < 2) return;
      const [a, b] = pts;
      emitPath(
        page,
        rectSegments(
          Math.min(a[0], b[0]),
          Math.min(a[1], b[1]),
          Math.max(a[0], b[0]),
          Math.max(a[1], b[1]),
          T,
        ),
        { stroke: col, width },
      );
      return;
    }

    case "circle": {
      if (pts.length < 2) return;
      const [a, b] = pts;
      const rx = Math.abs(a[0] - b[0]) / 2,
        ry = Math.abs(a[1] - b[1]) / 2;
      if (rx < 0.01 && ry < 0.01) return;
      emitPath(
        page,
        ellipseSegments((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, rx, ry, T),
        { stroke: col, width },
      );
      return;
    }

    case "line": {
      if (pts.length < 2) return;
      emitPath(page, [`M ${sv(T(pts[0]))}`, `L ${sv(T(pts[1]))}`], {
        stroke: col,
        width,
        cap: LineCapStyle.Round,
      });
      return;
    }

    case "arrow": {
      if (pts.length < 2) return;
      // The editor works in screen pixels (curve handle length, head size);
      // evaluate there, then convert back to points so it looks the same.
      const k = viewScale;
      const sp0: DPt = [pts[0][0] * k, pts[0][1] * k];
      const sp3: DPt = [pts[1][0] * k, pts[1][1] * k];
      const cv = connector(sp0, sp3, s.start, s.end);
      const len = Math.hypot(cv.p3[0] - cv.p0[0], cv.p3[1] - cv.p0[1]);
      if (len < 0.5) return;

      const hl = Math.min(headLenPx(rawSize), Math.max(len * 0.6, 4));
      const hw = hl * 0.42;
      const t = arrowTangent(cv);
      const tip = cv.p3;
      const ex = tip[0] - t[0] * hl * 0.7;
      const ey = tip[1] - t[1] * hl * 0.7;

      const back = (p: DPt): Pt => T([p[0] / k, p[1] / k]);

      // shaft (butt cap so it never pokes through the head)
      const shaft = [`M ${sv(back(cv.p0))}`];
      if (cv.curved)
        shaft.push(
          `C ${sv(back(cv.c1))}, ${sv(back(cv.c2))}, ${sv(back([ex, ey]))}`,
        );
      else shaft.push(`L ${sv(back([ex, ey]))}`);
      emitPath(page, shaft, { stroke: col, width, cap: LineCapStyle.Butt });

      // head (filled + thin outline, like the editor)
      const bx = tip[0] - t[0] * hl,
        by = tip[1] - t[1] * hl;
      const head = [
        `M ${sv(back(tip))}`,
        `L ${sv(back([bx - t[1] * hw, by + t[0] * hw]))}`,
        `L ${sv(back([bx + t[1] * hw, by - t[0] * hw]))}`,
        "Z",
      ];
      emitPath(page, head, {
        fill: col,
        stroke: col,
        width: Math.max(1, rawSize * 0.5) / viewScale,
        cap: LineCapStyle.Round,
      });
      return;
    }

    default:
      return; // unknown tool → skip silently
  }
}

/* ───────────── public API ───────────── */

export async function generateFlatPdf(
  originalPdfData: Uint8Array | null,
  isBlank: boolean,
  totalPages: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  drawingsData: any[],
  options: FlatPdfOptions = {},
): Promise<Uint8Array> {
  const viewScale =
    typeof options.viewScale === "number" &&
    Number.isFinite(options.viewScale) &&
    options.viewScale > 0
      ? options.viewScale
      : 1;

  /* ---------- 1. Load or create the base PDF ---------- */
  let pdfDoc: PDFDocument;
  if (isBlank || !originalPdfData || originalPdfData.length === 0) {
    pdfDoc = await PDFDocument.create();
    for (let i = 0; i < Math.max(1, totalPages); i++) {
      pdfDoc.addPage([800, 1131]); // A4-ish
    }
  } else {
    pdfDoc = await PDFDocument.load(originalPdfData, {
      ignoreEncryption: true,
    });
  }
  const pages = pdfDoc.getPages();

  /* ---------- 2. Group strokes by page (only target="pdf") ---------- */
  const byPage = new Map<number, StoredStroke[]>();
  let total = 0;

  for (const record of drawingsData ?? []) {
    if (!record || record.target !== "pdf") continue;
    const pageNum = Number(record.pageNumber ?? record.page_number);
    if (!Number.isInteger(pageNum) || pageNum < 1) continue;

    let parsed: unknown = record.data;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch (e) {
        console.warn("[PDF Export] Failed to parse drawing record:", e);
        continue;
      }
    }
    if (!Array.isArray(parsed)) continue;

    const list = byPage.get(pageNum) ?? [];
    list.push(...(parsed as StoredStroke[]));
    total += parsed.length;
    byPage.set(pageNum, list);
  }

  if (total === 0) return await pdfDoc.save();

  /* ---------- 3. Render ---------- */
  for (const [pageNum, strokes] of byPage) {
    const page = pages[pageNum - 1];
    if (!page) {
      console.warn(
        `[PDF Export] Page ${pageNum} not found (doc has ${pages.length}).`,
      );
      continue;
    }
    const geo = pageGeometry(page);

    for (const stroke of strokes) {
      if (!stroke || !Array.isArray(stroke.points) || !stroke.points.length)
        continue;

      const tool = stroke.tool || (stroke.isEraser ? "eraser" : "pen");
      if (tool === "eraser") continue; // legacy pixel-eraser: not representable

      if (!stroke.points.every(isValidPoint)) continue;

      const size = typeof stroke.size === "number" ? stroke.size : 2;
      const m = (size / viewScale + 100) / 1; // generous bleed in pt
      if (!touchesPage(stroke.points, m / geo.W, m / geo.H)) continue;

      try {
        drawStroke(page, stroke, tool, geo, viewScale);
      } catch (err) {
        console.warn(
          `[PDF Export] Failed to draw ${tool} on page ${pageNum}:`,
          err,
        );
      }
    }
  }

  return await pdfDoc.save();
}

/**
 * Call this right BEFORE reading drawings from the DB for an export.
 * Strokes are saved with a 500 ms debounce; this forces any pending save
 * (via the existing "margyn-flush-ink" event) and waits for it, so the last
 * stroke you drew is never missing from the exported PDF.
 */
export async function flushPendingInk(): Promise<void> {
  if (typeof window === "undefined") return;
  const pending: Promise<void>[] = [];
  window.dispatchEvent(
    new CustomEvent("margyn-flush-ink", {
      detail: { register: (p: Promise<void>) => pending.push(p) },
    }),
  );
  await Promise.allSettled(pending);
}
