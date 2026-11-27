"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { ToolType } from "@/providers/ToolProvider";
import { getKeyCode, isTypingTarget } from "@/lib/keys";

/**
 * Unified pan input for the Infinite Canvas, built for pen tablets.
 *
 * Why this exists
 * ---------------
 * With a pen (Windows Ink / WinTab) the physical movement is reported as
 * `pointerType: "pen"`. A middle-mouse press injected by the tablet driver is a
 * *different* pointer (the virtual mouse), and Chromium frequently drops or
 * decouples it while the pen is in range. The old implementation only reacted
 * to `button === 1` on the very same pointer, so it never worked with a pen.
 *
 * Supported ways to pan (all at the same time):
 *  1. Hold **Space** (map a pen button to Space in the driver) and drag with the pen.
 *     A quick *tap* of the key toggles the Hand tool instead (for drivers that
 *     only send a short key press and not a held key).
 *  2. Pen barrel button + drag (Windows Ink reports it as `buttons & 2`).
 *  3. Middle mouse / wheel button, even when the movement comes from the pen.
 *  4. The Hand tool (G or toolbar).
 */

type Source = "tool" | "key" | "barrel" | "middle";

interface Params {
  containerRef: RefObject<HTMLElement | null>;
  tool: ToolType;
  setTool: (t: ToolType) => void;
  onCommit: (dx: number, dy: number) => void;
}

const TAP_MS = 250;
const PAN_KEYS = new Set(["Space"]);

export function usePanInput({ containerRef, tool, setTool, onCommit }: Params) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [keyHeld, setKeyHeld] = useState(false);

  const toolRef = useRef(tool);
  const prevToolRef = useRef<ToolType>("pen");
  const commitRef = useRef(onCommit);
  const setToolRef = useRef(setTool);
  const startRef = useRef<{
    x: number;
    y: number;
    pid: number | null;
    src: Source;
  } | null>(null);
  const dragRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);
  const keyDownAt = useRef(0);
  const usedWhileHeld = useRef(false);
  const keyHeldRef = useRef(false);

  useEffect(() => {
    toolRef.current = tool;
    if (tool !== "pan") prevToolRef.current = tool;
  }, [tool]);
  useEffect(() => {
    commitRef.current = onCommit;
    setToolRef.current = setTool;
  }, [onCommit, setTool]);

  const flush = useCallback(() => {
    rafRef.current = 0;
    setDrag({ x: dragRef.current.x, y: dragRef.current.y });
  }, []);

  const begin = useCallback((x: number, y: number, pid: number | null, src: Source) => {
    startRef.current = { x, y, pid, src };
    dragRef.current = { x: 0, y: 0 };
    setDrag({ x: 0, y: 0 });
    setIsPanning(true);
    if (src === "key") usedWhileHeld.current = true;
  }, []);

  const move = useCallback(
    (x: number, y: number) => {
      const s = startRef.current;
      if (!s) return;
      dragRef.current = { x: x - s.x, y: y - s.y };
      if (!rafRef.current) rafRef.current = requestAnimationFrame(flush);
    },
    [flush],
  );

  const end = useCallback((commit: boolean) => {
    const s = startRef.current;
    if (!s) return;
    startRef.current = null;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const { x, y } = dragRef.current;
    dragRef.current = { x: 0, y: 0 };
    if (commit && (x !== 0 || y !== 0)) commitRef.current(x, y);
    setDrag({ x: 0, y: 0 });
    setIsPanning(false);
  }, []);

  useEffect(() => {
    const inside = (t: EventTarget | null) =>
      !!containerRef.current && t instanceof Node && containerRef.current.contains(t);

    const onPointerDown = (e: PointerEvent) => {
      if (startRef.current || !inside(e.target)) return;

      const middle = e.button === 1 || (e.buttons & 4) !== 0;
      const barrel = e.pointerType === "pen" && (e.buttons & 2) !== 0 && e.button !== 5;
      const modeOn = keyHeldRef.current || toolRef.current === "pan";
      const primary = e.button === 0 || e.button === -1;

      let src: Source | null = null;
      if (middle) src = "middle";
      else if (barrel) src = "barrel";
      else if (modeOn && primary) src = keyHeldRef.current ? "key" : "tool";
      if (!src) return;

      e.preventDefault();
      e.stopPropagation();
      begin(e.clientX, e.clientY, e.pointerId, src);
      if (src !== "middle") {
        try {
          containerRef.current?.setPointerCapture(e.pointerId);
        } catch {}
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const s = startRef.current;
      if (!s) return;
      // A middle press from the driver is a virtual mouse pointer, but the
      // movement comes from the pen pointer: accept any pointer for "middle".
      if (s.src !== "middle" && s.pid !== null && e.pointerId !== s.pid) return;
      move(e.clientX, e.clientY);
    };

    const onPointerUp = (e: PointerEvent) => {
      const s = startRef.current;
      if (!s) return;
      if (s.src === "middle") {
        // End on the middle button release, or when the originating pointer lifts.
        if (e.button === 1 || e.pointerId === s.pid) end(true);
        return;
      }
      if (e.pointerId === s.pid) end(true);
    };

    const onPointerCancel = (e: PointerEvent) => {
      const s = startRef.current;
      if (s && (e.pointerId === s.pid || s.src === "middle")) end(true);
    };

    // Fallback for setups that only deliver legacy mouse events for the middle button.
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 1 || startRef.current || !inside(e.target)) return;
      e.preventDefault();
      begin(e.clientX, e.clientY, null, "middle");
    };
    const onMouseMove = (e: MouseEvent) => {
      if (startRef.current) move(e.clientX, e.clientY);
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 1 && startRef.current?.src === "middle") end(true);
    };
    const onAuxClick = (e: MouseEvent) => {
      if (e.button === 1 && inside(e.target)) e.preventDefault();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!PAN_KEYS.has(getKeyCode(e)) || isTypingTarget(e.target)) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      e.preventDefault(); // no page scroll / no button "click" on Space
      if (e.repeat || keyHeldRef.current) return;
      keyHeldRef.current = true;
      keyDownAt.current = performance.now();
      usedWhileHeld.current = false;
      setKeyHeld(true);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!PAN_KEYS.has(getKeyCode(e))) return;
      if (isTypingTarget(e.target) && !keyHeldRef.current) return;
      e.preventDefault();
      if (!keyHeldRef.current) return;
      keyHeldRef.current = false;
      setKeyHeld(false);
      const tapped = performance.now() - keyDownAt.current < TAP_MS;
      if (tapped && !usedWhileHeld.current) {
        // Driver sent only a short press -> behave as a toggle.
        setToolRef.current(
          toolRef.current === "pan" ? prevToolRef.current || "pen" : "pan",
        );
      }
    };

    const onBlur = () => {
      keyHeldRef.current = false;
      setKeyHeld(false);
      end(true);
    };

    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && startRef.current) end(false);
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerCancel, true);
    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("mousemove", onMouseMove, true);
    window.addEventListener("mouseup", onMouseUp, true);
    window.addEventListener("auxclick", onAuxClick, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("keydown", onEscape, true);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerCancel, true);
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("mousemove", onMouseMove, true);
      window.removeEventListener("mouseup", onMouseUp, true);
      window.removeEventListener("auxclick", onAuxClick, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("keydown", onEscape, true);
      window.removeEventListener("blur", onBlur);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [containerRef, begin, move, end]);

  const panMode = keyHeld || tool === "pan";
  return { drag, isPanning, panMode, keyHeld };
}
