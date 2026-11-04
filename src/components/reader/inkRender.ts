import type { Anchor, Box, Stroke } from "./inkTypes";
import {
  anchorPoint,
  arrowTangent,
  connector,
  getHandles,
  headLen,
  kindOf,
  ANCHORS,
} from "./inkGeometry";

export const ACCENT = "#38bdf8";
export const HIGHLIGHT_ALPHA = 0.4;

export function tracePen(ctx: CanvasRenderingContext2D, p: number[]) {
  const n = p.length >> 1;
  ctx.moveTo(p[0], p[1]);
  if (n === 1) {
    ctx.lineTo(p[0] + 0.01, p[1]);
  } else if (n === 2) {
    ctx.lineTo(p[2], p[3]);
  } else {
    for (let i = 1; i < n - 1; i++) {
      ctx.quadraticCurveTo(
        p[i * 2],
        p[i * 2 + 1],
        (p[i * 2] + p[i * 2 + 2]) / 2,
        (p[i * 2 + 1] + p[i * 2 + 3]) / 2,
      );
    }
    ctx.lineTo(p[(n - 1) * 2], p[(n - 1) * 2 + 1]);
  }
}

/** Draws any element from its SCREEN-space flat points. */
export function paintStroke(
  ctx: CanvasRenderingContext2D,
  s: Stroke,
  p: number[],
) {
  const n = p.length >> 1;
  if (!n) return;
  const k = kindOf(s);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = s.size;
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;

  switch (k) {
    case "eraser": // legacy pixel-eraser strokes from older saves
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "#000";
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      if (n === 1) ctx.lineTo(p[0] + 0.01, p[1]);
      for (let i = 1; i < n; i++) ctx.lineTo(p[i * 2], p[i * 2 + 1]);
      ctx.stroke();
      break;

    case "highlight-rect": {
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = HIGHLIGHT_ALPHA;
      // ONE path: overlapping rects are filled once (no darker seams)
      ctx.beginPath();
      for (let i = 0; i + 3 < p.length; i += 4) {
        const x0 = Math.min(p[i], p[i + 2]),
          x1 = Math.max(p[i], p[i + 2]),
          y0 = Math.min(p[i + 1], p[i + 3]),
          y1 = Math.max(p[i + 1], p[i + 3]);
        ctx.rect(x0, y0, x1 - x0, y1 - y0);
      }
      ctx.fill();
      break;
    }

    case "rectangle": {
      if (n < 2) break;
      ctx.lineJoin = "miter";
      ctx.strokeRect(
        Math.min(p[0], p[2]),
        Math.min(p[1], p[3]),
        Math.abs(p[0] - p[2]),
        Math.abs(p[1] - p[3]),
      );
      break;
    }
    case "circle": {
      if (n < 2) break;
      const rx = Math.abs(p[0] - p[2]) / 2,
        ry = Math.abs(p[1] - p[3]) / 2;
      if (rx < 0.01 && ry < 0.01) break;
      ctx.beginPath();
      ctx.ellipse(
        (p[0] + p[2]) / 2,
        (p[1] + p[3]) / 2,
        rx,
        ry,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      break;
    }
    case "line":
      if (n < 2) break;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(p[2], p[3]);
      ctx.stroke();
      break;

    case "arrow": {
      if (n < 2) break;
      const cv = connector(p, s.start, s.end);
      const len = Math.hypot(cv.p3[0] - cv.p0[0], cv.p3[1] - cv.p0[1]);
      if (len < 0.5) break;
      const hl = Math.min(headLen(s.size), Math.max(len * 0.6, 4));
      const hw = hl * 0.42;
      const t = arrowTangent(cv);
      const tip = cv.p3;
      const ex = tip[0] - t[0] * hl * 0.7;
      const ey = tip[1] - t[1] * hl * 0.7;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(cv.p0[0], cv.p0[1]);
      if (cv.curved)
        ctx.bezierCurveTo(cv.c1[0], cv.c1[1], cv.c2[0], cv.c2[1], ex, ey);
      else ctx.lineTo(ex, ey);
      ctx.stroke();
      const bx = tip[0] - t[0] * hl,
        by = tip[1] - t[1] * hl;
      ctx.beginPath();
      ctx.moveTo(tip[0], tip[1]);
      ctx.lineTo(bx - t[1] * hw, by + t[0] * hw);
      ctx.lineTo(bx + t[1] * hw, by - t[0] * hw);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = Math.max(1, s.size * 0.5);
      ctx.lineJoin = "round";
      ctx.stroke();
      break;
    }

    default: {
      // pen
      if (n === 1) {
        ctx.beginPath();
        ctx.arc(p[0], p[1], s.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        tracePen(ctx, p);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/* ───────────── overlay UI ───────────── */

export interface SelInfo {
  boxes: Box[];
  bbox: Box | null;
  /** single line/arrow selected → endpoint handles instead of bbox */
  endpoints: [number, number][] | null;
}

export function drawSelectionUI(ctx: CanvasRenderingContext2D, info: SelInfo) {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = ACCENT;
  if (info.endpoints) {
    ctx.fillStyle = "#fff";
    ctx.lineWidth = 1.6;
    for (const [x, y] of info.endpoints) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (info.boxes.length > 1) {
    ctx.globalAlpha = 0.55;
    for (const b of info.boxes) ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h);
    ctx.globalAlpha = 1;
  }
  if (info.bbox) {
    const b = info.bbox;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h);
    ctx.fillStyle = "#fff";
    ctx.lineWidth = 1.5;
    for (const h of getHandles(b)) {
      ctx.beginPath();
      ctx.rect(h.x - 4, h.y - 4, 8, 8);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawAnchorHints(
  ctx: CanvasRenderingContext2D,
  box: Box,
  active: Anchor | null,
) {
  ctx.save();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.9;
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  ctx.globalAlpha = 1;
  for (const a of ANCHORS) {
    const [x, y] = anchorPoint(box, a);
    ctx.beginPath();
    ctx.arc(x, y, a === active ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = a === active ? ACCENT : "#fff";
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export function drawMarquee(ctx: CanvasRenderingContext2D, b: Box) {
  ctx.save();
  ctx.fillStyle = "rgba(56,189,248,0.10)";
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h);
  ctx.restore();
}

export function drawEraserRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(x, y, r - 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
