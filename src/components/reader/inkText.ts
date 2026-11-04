import type { TextLine } from "./inkTypes";

/** nearest line by vertical distance; -1 when nothing is reasonably close */
function pickLine(lines: TextLine[], y: number, strict: boolean): number {
  let best = -1,
    bestD = Infinity;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    const d = y < L.top ? L.top - y : y > L.bottom ? y - L.bottom : 0;
    const dc = Math.abs(y - (L.top + L.bottom) / 2);
    const score = d * 1000 + dc;
    if (score < bestD) {
      bestD = score;
      best = i;
    }
  }
  if (best < 0) return -1;
  const L = lines[best];
  const d = y < L.top ? L.top - y : y > L.bottom ? y - L.bottom : 0;
  if (strict && d > L.h * 1.2) return -1;
  return best;
}

/** snap x to the closest character boundary on a line */
function snapX(line: TextLine, x: number): number {
  let best = x,
    bd = Infinity;
  for (const r of line.runs) {
    if (x <= r.left) {
      if (r.left - x < bd) {
        bd = r.left - x;
        best = r.left;
      }
      continue;
    }
    if (x >= r.right) {
      if (x - r.right < bd) {
        bd = x - r.right;
        best = r.right;
      }
      continue;
    }
    for (const bx of r.xs) {
      const d = Math.abs(bx - x);
      if (d < bd) {
        bd = d;
        best = bx;
      }
    }
  }
  return best;
}

/** pieces of the line between x0 and x1, merged across word gaps */
function lineRects(line: TextLine, x0: number, x1: number): number[][] {
  if (x1 < x0) [x0, x1] = [x1, x0];
  const pieces: number[][] = [];
  for (const r of line.runs) {
    const l = Math.max(r.left, x0),
      rr = Math.min(r.right, x1);
    if (rr - l > 0.5) pieces.push([l, rr]);
  }
  const merged: number[][] = [];
  const gap = line.h * 0.45;
  for (const p of pieces) {
    const last = merged[merged.length - 1];
    if (last && p[0] - last[1] <= gap) last[1] = Math.max(last[1], p[1]);
    else merged.push([p[0], p[1]]);
  }
  return merged.map(([l, r]) => [l, line.top, r, line.bottom]);
}

/**
 * Text-selection style highlight: returns perfectly straight rectangles
 * (l,t,r,b) that cover ONLY the text between the two points.
 */
export function selectionRects(
  lines: TextLine[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number[][] {
  if (!lines.length) return [];
  let ia = pickLine(lines, ay, true);
  let ib = pickLine(lines, by, true);
  if (ia < 0 && ib < 0) return [];
  if (ia < 0) ia = pickLine(lines, ay, false);
  if (ib < 0) ib = pickLine(lines, by, false);

  if (ia === ib) return lineRects(lines[ia], snapX(lines[ia], ax), snapX(lines[ia], bx));

  // reading order = top → bottom
  if (ia > ib) {
    [ia, ib] = [ib, ia];
    [ax, bx] = [bx, ax];
  }
  const out: number[][] = [];
  const first = lines[ia],
    last = lines[ib];
  const xa = snapX(first, ax),
    xb = snapX(last, bx);
  out.push(...lineRects(first, first.rtl ? -Infinity : xa, first.rtl ? xa : Infinity));
  for (let i = ia + 1; i < ib; i++) out.push(...lineRects(lines[i], -Infinity, Infinity));
  out.push(...lineRects(last, last.rtl ? xb : -Infinity, last.rtl ? Infinity : xb));
  return out;
}
