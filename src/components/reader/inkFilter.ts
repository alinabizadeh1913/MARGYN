/**
 * One-Euro filter (Casiez, Roussel & Vogel, CHI 2012) for pointer samples.
 *
 * Why it exists
 * -------------
 * Raw pointer data is noisy: a mouse reports whole pixels (a slow diagonal
 * becomes a staircase), a digitiser adds sub-pixel tremor. Drawing those
 * samples as they are makes slow strokes look shaky.
 *
 * The filter smooths hard when the pointer is slow (where jitter is visible)
 * and almost not at all when it is fast (where any smoothing would show up as
 * the ink trailing behind the hand).
 *
 * IMPORTANT: `dCutoff` must be high (10-20 Hz). With the textbook value of
 * 1 Hz the speed estimate reacts so slowly that the first ~150 ms of every
 * fast stroke is smoothed heavily and the ink visibly "rubber-bands" behind
 * the pointer (measured: 60-110 px of lag). Do not lower it.
 *
 * Tuning (both numbers are in "per second" units, CSS px):
 *   minCutoff  - higher = less smoothing at rest, less lag, more jitter left.
 *   beta       - higher = smoothing disappears sooner as the pointer speeds up.
 */
export interface FilterParams {
  minCutoff: number;
  beta: number;
  dCutoff: number;
}

/** Pen / touch: the physical tip is visible, so lag matters most. Light smoothing. */
export const PEN_FILTER: FilterParams = { minCutoff: 3.0, beta: 0.2, dCutoff: 15 };
/** Mouse: integer-pixel quantisation needs more smoothing at low speed. */
export const MOUSE_FILTER: FilterParams = { minCutoff: 2.0, beta: 0.12, dCutoff: 12 };

export const filterFor = (pointerType: string): FilterParams =>
  pointerType === "mouse" ? MOUSE_FILTER : PEN_FILTER;

const alpha = (cutoff: number, dt: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

/** Fallback sample interval (s) when two samples carry the same timestamp. */
const DEFAULT_DT = 1 / 240;
const MAX_DT = 0.1;

export class PointFilter {
  private t = 0;
  private rx = 0;
  private ry = 0;
  private fx = 0;
  private fy = 0;
  private vx = 0;
  private vy = 0;
  private started = false;

  constructor(private readonly p: FilterParams) {}

  /** Feed one raw sample (ms timestamp); returns the filtered position. */
  filter(x: number, y: number, tMs: number): [number, number] {
    if (!this.started) {
      this.started = true;
      this.t = tMs;
      this.rx = this.fx = x;
      this.ry = this.fy = y;
      return [x, y];
    }
    let dt = (tMs - this.t) / 1000;
    if (!(dt > 0)) dt = DEFAULT_DT;
    else if (dt > MAX_DT) dt = MAX_DT;
    this.t = tMs;

    const ad = alpha(this.p.dCutoff, dt);
    const dx = (x - this.rx) / dt;
    const dy = (y - this.ry) / dt;
    this.rx = x;
    this.ry = y;
    this.vx += ad * (dx - this.vx);
    this.vy += ad * (dy - this.vy);

    const a = alpha(this.p.minCutoff + this.p.beta * Math.hypot(this.vx, this.vy), dt);
    this.fx += a * (x - this.fx);
    this.fy += a * (y - this.fy);
    return [this.fx, this.fy];
  }
}
