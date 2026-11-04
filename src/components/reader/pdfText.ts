import type { TextLine, TextRun } from "./inkTypes";

let measureCtx: CanvasRenderingContext2D | null = null;
const widthCache = new Map<string, number>();

function charW(ch: string): number {
  let w = widthCache.get(ch);
  if (w !== undefined) return w;
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d");
    if (measureCtx) measureCtx.font = "100px sans-serif";
  }
  w = measureCtx ? measureCtx.measureText(ch).width / 100 : 0.5;
  if (ch === " ") w = Math.max(w, 0.25);
  w = Math.max(w, 0.05);
  widthCache.set(ch, w);
  return w;
}

interface Acc {
  baseline: number;
  h: number;
  runs: TextRun[];
  rtlVotes: number;
}

/**
 * Turns pdf.js text items into straight text lines with per-character x
 * boundaries (estimated proportionally – good enough for snapping).
 * Rotated/vertical text is ignored. Returns [] for scanned PDFs.
 */
export function buildTextLines(
  items: any[],
  viewport: { scale: number; transform: number[] },
  Util: { transform: (a: number[], b: number[]) => number[] },
): TextLine[] {
  const acc: Acc[] = [];

  for (const item of items) {
    const str: string | undefined = item?.str;
    if (!str || !str.trim()) continue;
    const tx = Util.transform(viewport.transform, item.transform);
    const fh = Math.hypot(tx[2], tx[3]);
    if (fh < 1 || Math.abs(tx[1]) > fh * 0.05) continue;
    const width = item.width * viewport.scale;
    if (!(width > 0)) continue;

    const left = tx[4];
    const right = left + width;
    const rtl = item.dir === "rtl";
    const chars = Array.from(str);
    const ws = chars.map(charW);
    const total = ws.reduce((a, b) => a + b, 0) || 1;
    const xs: number[] = [];
    let cum = 0;
    for (let i = 0; i <= chars.length; i++) {
      const f = cum / total;
      xs.push(rtl ? right - width * f : left + width * f);
      cum += ws[i] || 0;
    }
    xs.sort((a, b) => a - b);

    const baseline = tx[5];
    let line = acc.find((l) => Math.abs(l.baseline - baseline) < Math.max(l.h, fh) * 0.4);
    if (!line) {
      line = { baseline, h: fh, runs: [], rtlVotes: 0 };
      acc.push(line);
    }
    line.h = Math.max(line.h, fh);
    if (rtl) line.rtlVotes++;
    line.runs.push({ left, right, xs });
  }

  acc.sort((a, b) => a.baseline - b.baseline);
  return acc.map((l) => {
    l.runs.sort((a, b) => a.left - b.left);
    return {
      top: l.baseline - l.h * 0.88,
      bottom: l.baseline + l.h * 0.22,
      h: l.h,
      rtl: l.rtlVotes > l.runs.length / 2,
      runs: l.runs,
    };
  });
}
