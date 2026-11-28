export type CanvasPatternType =
  | "blank"
  | "lines"
  | "grid"
  | "graph"
  | "dots"
  | "cross"
  | "isometric";

export type PatternKind = Exclude<CanvasPatternType, "blank">;

export interface CanvasPatternState {
  type: CanvasPatternType;
  /** فاصله‌ی هر الگو (واحد جهان، با زوم مقیاس می‌شود) */
  gaps: Record<PatternKind, number>;
  /** رنگ خطوط؛ null = خودکار بر اساس رنگ پس‌زمینه */
  color: string | null;
}

export const PATTERN_TYPES: CanvasPatternType[] = [
  "blank",
  "lines",
  "grid",
  "graph",
  "dots",
  "cross",
  "isometric",
];

export const PATTERN_MIN_GAP = 12;
export const PATTERN_MAX_GAP = 120;

export const DEFAULT_PATTERN: CanvasPatternState = {
  type: "blank",
  gaps: { lines: 32, grid: 32, graph: 24, dots: 28, cross: 40, isometric: 36 },
  color: null,
};

const STORAGE_PREFIX = "margyn:canvasPattern:";

export function loadPattern(filePath: string): CanvasPatternState {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + filePath);
    if (!raw) return DEFAULT_PATTERN;
    const p = JSON.parse(raw);
    const clamp = (v: unknown, d: number) =>
      typeof v === "number" && isFinite(v)
        ? Math.max(PATTERN_MIN_GAP, Math.min(PATTERN_MAX_GAP, Math.round(v)))
        : d;
    const type: CanvasPatternType = PATTERN_TYPES.includes(p?.type)
      ? p.type
      : "blank";
    const color =
      typeof p?.color === "string" && /^#[0-9a-f]{6}$/i.test(p.color)
        ? p.color
        : null;
    const d = DEFAULT_PATTERN.gaps;
    return {
      type,
      color,
      gaps: {
        lines: clamp(p?.gaps?.lines, d.lines),
        grid: clamp(p?.gaps?.grid, d.grid),
        graph: clamp(p?.gaps?.graph, d.graph),
        dots: clamp(p?.gaps?.dots, d.dots),
        cross: clamp(p?.gaps?.cross, d.cross),
        isometric: clamp(p?.gaps?.isometric, d.isometric),
      },
    };
  } catch {
    return DEFAULT_PATTERN;
  }
}

export function savePattern(filePath: string, state: CanvasPatternState) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + filePath, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return [r, g, b];
}

function isDarkBg(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 < 0.5;
}

/** رسم الگو روی canvas با موقعیت پن و زوم فعلی */
export function drawPattern(
  canvas: HTMLCanvasElement,
  cssW: number,
  cssH: number,
  dpr: number,
  pattern: CanvasPatternState,
  panX: number,
  panY: number,
  scale: number,
  bg: string,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  if (pattern.type === "blank") return;

  const kind = pattern.type;
  const step = pattern.gaps[kind] * scale;
  const minStep =
    kind === "dots" ? 8 : kind === "cross" ? 12 : kind === "isometric" ? 10 : 6;
  // برای graph خطوط اصلی هر ۵ خانه‌اند
  const effStep = kind === "graph" ? step * 5 : step;
  if (effStep < minStep) return;

  const fade = Math.min(1, (effStep - minStep) / minStep);
  const custom = pattern.color ? hexToRgb(pattern.color) : null;
  const rgb: [number, number, number] =
    custom ?? (isDarkBg(bg) ? [255, 255, 255] : [40, 60, 100]);
  const heavy = kind === "dots" || kind === "cross";
  const base = custom ? (heavy ? 0.8 : 0.55) : heavy ? 0.38 : 0.2;
  const alpha = base * (0.35 + 0.65 * fade);
  const col = (a: number) =>
    `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${Math.min(1, a)})`;

  ctx.lineWidth = 1;

  // ---------- lines / grid ----------
  if (kind === "lines" || kind === "grid") {
    const startX = ((panX % step) + step) % step;
    const startY = ((panY % step) + step) % step;
    ctx.strokeStyle = col(alpha);
    ctx.beginPath();
    for (let y = startY; y <= cssH; y += step) {
      const yy = Math.round(y) + 0.5;
      ctx.moveTo(0, yy);
      ctx.lineTo(cssW, yy);
    }
    if (kind === "grid") {
      for (let x = startX; x <= cssW; x += step) {
        const xx = Math.round(x) + 0.5;
        ctx.moveTo(xx, 0);
        ctx.lineTo(xx, cssH);
      }
    }
    ctx.stroke();
    return;
  }

  // ---------- graph (کاغذ میلیمتری: خطوط ریز + خطوط اصلی هر ۵ خانه) ----------
  if (kind === "graph") {
    const showMinor = step >= minStep;
    const kx0 = Math.floor(-panX / step);
    const kx1 = Math.ceil((cssW - panX) / step);
    const ky0 = Math.floor(-panY / step);
    const ky1 = Math.ceil((cssH - panY) / step);
    const isMajor = (k: number) => (((k % 5) + 5) % 5) === 0;

    for (const major of [false, true]) {
      if (!major && !showMinor) continue;
      ctx.strokeStyle = col(major ? alpha * 1.15 : alpha * 0.55);
      ctx.beginPath();
      for (let k = ky0; k <= ky1; k++) {
        if (isMajor(k) !== major) continue;
        const yy = Math.round(panY + k * step) + 0.5;
        ctx.moveTo(0, yy);
        ctx.lineTo(cssW, yy);
      }
      for (let k = kx0; k <= kx1; k++) {
        if (isMajor(k) !== major) continue;
        const xx = Math.round(panX + k * step) + 0.5;
        ctx.moveTo(xx, 0);
        ctx.lineTo(xx, cssH);
      }
      ctx.stroke();
    }
    return;
  }

  // ---------- isometric (شبکه‌ی مثلثی) ----------
  if (kind === "isometric") {
    const t = Math.tan(Math.PI / 6); // 30°
    const h = (step * Math.sqrt(3)) / 2; // فاصله‌ی خطوط عمودی
    ctx.strokeStyle = col(alpha);
    ctx.beginPath();

    const j0 = Math.floor(-panX / h);
    const j1 = Math.ceil((cssW - panX) / h);
    for (let j = j0; j <= j1; j++) {
      const xx = Math.round(panX + j * h) + 0.5;
      ctx.moveTo(xx, 0);
      ctx.lineTo(xx, cssH);
    }

    // خانواده‌ی +30°
    const baseA = panY - panX * t;
    const a0 = Math.ceil((-cssW * t - baseA) / step);
    const a1 = Math.floor((cssH - baseA) / step);
    for (let k = a0; k <= a1; k++) {
      const y0 = baseA + k * step;
      ctx.moveTo(0, y0);
      ctx.lineTo(cssW, y0 + cssW * t);
    }

    // خانواده‌ی −30°
    const baseB = panY + panX * t;
    const b0 = Math.ceil(-baseB / step);
    const b1 = Math.floor((cssH + cssW * t - baseB) / step);
    for (let k = b0; k <= b1; k++) {
      const y0 = baseB + k * step;
      ctx.moveTo(0, y0);
      ctx.lineTo(cssW, y0 - cssW * t);
    }
    ctx.stroke();
    return;
  }

  const startX = ((panX % step) + step) % step;
  const startY = ((panY % step) + step) % step;

  // ---------- cross (علامت + در تقاطع‌ها) ----------
  if (kind === "cross") {
    const arm = Math.max(2.5, Math.min(7, 3 + scale * 1.5));
    ctx.strokeStyle = col(alpha);
    ctx.beginPath();
    for (let y = startY; y <= cssH + arm; y += step) {
      const yy = Math.round(y) + 0.5;
      for (let x = startX; x <= cssW + arm; x += step) {
        const xx = Math.round(x) + 0.5;
        ctx.moveTo(xx - arm, yy);
        ctx.lineTo(xx + arm, yy);
        ctx.moveTo(xx, yy - arm);
        ctx.lineTo(xx, yy + arm);
      }
    }
    ctx.stroke();
    return;
  }

  // ---------- dots ----------
  ctx.fillStyle = col(alpha);
  const r = Math.max(1, Math.min(2.6, 0.9 + scale * 0.6));
  if (r <= 1.6) {
    const s = Math.round(r * 2);
    for (let y = startY; y <= cssH; y += step) {
      for (let x = startX; x <= cssW; x += step) {
        ctx.fillRect(Math.round(x) - s / 2, Math.round(y) - s / 2, s, s);
      }
    }
  } else {
    ctx.beginPath();
    for (let y = startY; y <= cssH; y += step) {
      for (let x = startX; x <= cssW; x += step) {
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }
}
