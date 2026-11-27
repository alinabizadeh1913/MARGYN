"use client";

import { useEffect, useState } from "react";

/**
 * Notifies when window.devicePixelRatio changes (moving the window between a
 * laptop panel and an external monitor, changing Windows scaling, browser zoom).
 * matchMedia("(resolution: Xdppx)") only fires once per value, so it is re-armed.
 */
export function subscribeDpr(cb: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  let mq: MediaQueryList | null = null;
  let stopped = false;

  const arm = () => {
    if (stopped) return;
    mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener("change", onChange, { once: true });
  };
  const onChange = () => {
    cb();
    arm();
  };
  arm();
  return () => {
    stopped = true;
    mq?.removeEventListener("change", onChange);
  };
}

/** Increments every time the pixel ratio changes. */
export function useDprTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeDpr(() => setTick((t) => t + 1)), []);
  return tick;
}
