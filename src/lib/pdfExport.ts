import { PDFDocument, rgb, LineCapStyle } from "pdf-lib";

/* =========================================================
   MARGYN — Flat PDF Export
   ---------------------------------------------------------
   - Renders ONLY "pdf" target drawings (margin canvas excluded).
   - Skips strokes entirely outside the page bounds.
   - Uses TWO coordinate mappers:
       * mapPdf : y-up (bottom-left origin) for drawLine/
                   drawRectangle/drawEllipse
       * mapSvg : y-down (top-left origin) for drawSvgPath
                   (pdf-lib flips y internally → single flip total)
   - Handles every tool: pen, highlight-rect, rectangle,
     circle, line, arrow.
   - Notes are intentionally NOT exported (by design).
========================================================= */

function hexToRgb(hex: string) {
  const clean = String(hex).replace("#", "");
  const padded =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const bigint = parseInt(padded, 16);
  if (!Number.isFinite(bigint)) return rgb(0, 0, 0);
  const r = ((bigint >> 16) & 255) / 255;
  const g = ((bigint >> 8) & 255) / 255;
  const b = (bigint & 255) / 255;
  return rgb(r, g, b);
}

/**
 * Build an SVG path string from a flat screen-space point array.
 * Points are normalized (0..1) relative to the PDF page, so `map`
 * must convert them to absolute SVG coordinates (y-down).
 */
function tracePenSvg(
  p: number[],
  map: (x: number, y: number) => [number, number],
): string {
  const n = p.length >> 1;
  if (!n) return "";

  const [sx, sy] = map(p[0], p[1]);
  let d = `M ${sx} ${sy} `;

  if (n === 1) {
    d += `L ${sx + 0.01} ${sy}`;
    return d;
  }

  // Catmull-Rom → cubic Bézier (same curve as the on-screen renderer)
  for (let k = 0; k < n - 1; k++) {
    const i0 = Math.max(0, k - 1) * 2;
    const i1 = k * 2;
    const i2 = (k + 1) * 2;
    const i3 = Math.min(n - 1, k + 2) * 2;

    const p0x = p[i0];
    const p0y = p[i0 + 1];
    const p1x = p[i1];
    const p1y = p[i1 + 1];
    const p2x = p[i2];
    const p2y = p[i2 + 1];
    const p3x = p[i3];
    const p3y = p[i3 + 1];

    const c1x = p1x + (p2x - p0x) / 6;
    const c1y = p1y + (p2y - p0y) / 6;
    const c2x = p2x - (p3x - p1x) / 6;
    const c2y = p2y - (p3y - p1y) / 6;

    const [cx1, cy1] = map(c1x, c1y);
    const [cx2, cy2] = map(c2x, c2y);
    const [px2, py2] = map(p2x, p2y);

    d += `C ${cx1} ${cy1}, ${cx2} ${cy2}, ${px2} ${py2} `;
  }
  return d;
}

/**
 * Returns true if at least a portion of the stroke's bounding box
 * intersects the PDF page (with a generous margin for line width).
 * Strokes entirely outside are skipped — this is the "clipping to
 * the PDF boundary" behaviour requested by the product spec.
 */
function strokeIntersectsPage(
  points: number[][],
  pageWidth: number,
  pageHeight: number,
  margin: number,
): boolean {
  if (!Array.isArray(points) || points.length === 0) return false;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let found = false;
  for (const pt of points) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const nx = pt[0];
    const ny = pt[1];
    if (typeof nx !== "number" || !isFinite(nx)) continue;
    if (typeof ny !== "number" || !isFinite(ny)) continue;
    const px = nx * pageWidth;
    const py = (1 - ny) * pageHeight; // normalized → PDF coords
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
    found = true;
  }
  if (!found) return false;
  return !(
    maxX < -margin ||
    minX > pageWidth + margin ||
    maxY < -margin ||
    minY > pageHeight + margin
  );
}

/** Strict per-point validation to prevent NaN from poisoning the path. */
function isValidPoint(pt: any): pt is [number, number] {
  return (
    Array.isArray(pt) &&
    pt.length >= 2 &&
    typeof pt[0] === "number" &&
    isFinite(pt[0]) &&
    typeof pt[1] === "number" &&
    isFinite(pt[1])
  );
}

export async function generateFlatPdf(
  originalPdfData: Uint8Array | null,
  isBlank: boolean,
  totalPages: number,
  drawingsData: any[],
): Promise<Uint8Array> {
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
  const drawingsByPage: Record<number, any[]> = {};
  let totalStrokes = 0;

  for (const record of drawingsData) {
    if (!record || record.target !== "pdf") continue;
    const pageNum = Number(record.pageNumber);
    if (!Number.isFinite(pageNum) || pageNum < 1) continue;
    if (!drawingsByPage[pageNum]) drawingsByPage[pageNum] = [];
    try {
      const parsed = JSON.parse(record.data);
      if (Array.isArray(parsed)) {
        drawingsByPage[pageNum].push(...parsed);
        totalStrokes += parsed.length;
      }
    } catch (e) {
      console.warn("[PDF Export] Failed to parse drawing record:", e);
    }
  }

  if (totalStrokes === 0) {
    console.log("[PDF Export] No PDF-target strokes to render.");
    return await pdfDoc.save();
  }

  console.log(
    `[PDF Export] Rendering ${totalStrokes} stroke(s) across ${
      Object.keys(drawingsByPage).length
    } page(s)...`,
  );

  /* ---------- 3. Render each page's strokes ---------- */
  for (const [pageNumStr, strokes] of Object.entries(drawingsByPage)) {
    const pageNum = parseInt(pageNumStr, 10);
    const page = pages[pageNum - 1];
    if (!page) {
      console.warn(
        `[PDF Export] Page ${pageNum} not found (doc has ${pages.length}).`,
      );
      continue;
    }

    const { width: pw, height: ph } = page.getSize();

    // PDF-native coords: y-up (bottom-left origin)
    const mapPdf = (x: number, y: number): [number, number] => [
      x * pw,
      (1 - y) * ph,
    ];

    // SVG coords: y-down (top-left origin) — pdf-lib flips y internally
    const mapSvg = (x: number, y: number): [number, number] => [x * pw, y * ph];

    for (const stroke of strokes) {
      if (!stroke || !Array.isArray(stroke.points)) continue;
      if (stroke.points.length === 0) continue;

      const tool: string = stroke.tool || (stroke.isEraser ? "eraser" : "pen");
      if (tool === "eraser") continue;

      const colorHex =
        typeof stroke.color === "string" ? stroke.color : "#000000";
      const color = hexToRgb(colorHex);
      const size =
        typeof stroke.size === "number" && stroke.size > 0 ? stroke.size : 2;

      // Validate all points
      let allValid = true;
      for (const pt of stroke.points) {
        if (!isValidPoint(pt)) {
          allValid = false;
          break;
        }
      }
      if (!allValid) continue;

      // Skip strokes entirely outside the page
      if (!strokeIntersectsPage(stroke.points, pw, ph, size + 100)) continue;

      const p = stroke.points.flat();
      if (!p.length) continue;

      try {
        switch (tool) {
          case "pen": {
            const d = tracePenSvg(p, mapSvg);
            if (d) {
              page.drawSvgPath(d, {
                borderColor: color,
                borderWidth: size,
                borderLineCap: LineCapStyle.Round,
              });
            }
            break;
          }

          case "highlight-rect": {
            // Points come in pairs: [left,top], [right,bottom]
            for (let i = 0; i + 3 < p.length; i += 4) {
              const x0n = Math.min(p[i], p[i + 2]);
              const x1n = Math.max(p[i], p[i + 2]);
              const y0n = Math.min(p[i + 1], p[i + 3]);
              const y1n = Math.max(p[i + 1], p[i + 3]);
              const w = (x1n - x0n) * pw;
              const h = (y1n - y0n) * ph;
              if (w <= 0 || h <= 0) continue;
              const [x0, y0] = mapPdf(x0n, y1n);
              page.drawRectangle({
                x: x0,
                y: y0,
                width: w,
                height: h,
                color: color,
                opacity: 0.4,
              });
            }
            break;
          }

          case "rectangle": {
            const x0n = Math.min(p[0], p[2]);
            const x1n = Math.max(p[0], p[2]);
            const y0n = Math.min(p[1], p[3]);
            const y1n = Math.max(p[1], p[3]);
            const w = (x1n - x0n) * pw;
            const h = (y1n - y0n) * ph;
            if (w <= 0 || h <= 0) continue;
            const [x0, y0] = mapPdf(x0n, y1n);
            page.drawRectangle({
              x: x0,
              y: y0,
              width: w,
              height: h,
              borderColor: color,
              borderWidth: size,
            });
            break;
          }

          case "circle": {
            const cx = (p[0] + p[2]) / 2;
            const cy = (p[1] + p[3]) / 2;
            const rx = (Math.abs(p[0] - p[2]) / 2) * pw;
            const ry = (Math.abs(p[1] - p[3]) / 2) * ph;
            if (rx <= 0 || ry <= 0) continue;
            const [px, py] = mapPdf(cx, cy);
            page.drawEllipse({
              x: px,
              y: py,
              xScale: rx,
              yScale: ry,
              borderColor: color,
              borderWidth: size,
            });
            break;
          }

          case "line": {
            const [x0, y0] = mapPdf(p[0], p[1]);
            const [x1, y1] = mapPdf(p[2], p[3]);
            page.drawLine({
              start: { x: x0, y: y0 },
              end: { x: x1, y: y1 },
              thickness: size,
              color: color,
            });
            break;
          }

          case "arrow": {
            // Shaft (PDF coords)
            const [x0, y0] = mapPdf(p[0], p[1]);
            const [x1, y1] = mapPdf(p[2], p[3]);
            page.drawLine({
              start: { x: x0, y: y0 },
              end: { x: x1, y: y1 },
              thickness: size,
              color: color,
            });

            // Head — draw with SVG coords, pdf-lib flips y internally
            const [x0s, y0s] = mapSvg(p[0], p[1]);
            const [x1s, y1s] = mapSvg(p[2], p[3]);
            const angle = Math.atan2(y1s - y0s, x1s - x0s);
            const headLen = Math.max(10, size * 3.2);
            const headAngle = Math.PI / 6; // 30°
            const ax1 = x1s - headLen * Math.cos(angle - headAngle);
            const ay1 = y1s - headLen * Math.sin(angle - headAngle);
            const ax2 = x1s - headLen * Math.cos(angle + headAngle);
            const ay2 = y1s - headLen * Math.sin(angle + headAngle);
            const dHead = `M ${x1s} ${y1s} L ${ax1} ${ay1} L ${ax2} ${ay2} Z`;
            page.drawSvgPath(dHead, {
              color: color,
              borderColor: color,
              borderWidth: 1,
            });
            break;
          }

          default:
            // Unknown tool — skip silently, no artifact
            break;
        }
      } catch (err) {
        console.warn(
          `[PDF Export] Failed to draw stroke on page ${pageNum}:`,
          err,
        );
      }
    }
  }

  return await pdfDoc.save();
}
