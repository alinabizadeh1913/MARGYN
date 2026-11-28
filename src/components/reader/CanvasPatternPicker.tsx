"use client";

import React, { useEffect, useRef, useState } from "react";
import ColorPicker from "./ColorPicker";
import {
  PATTERN_MAX_GAP,
  PATTERN_MIN_GAP,
  PATTERN_TYPES,
  type CanvasPatternState,
  type CanvasPatternType,
  type PatternKind,
} from "./canvasPattern";

interface Props {
  value: CanvasPatternState;
  onChange: (next: CanvasPatternState) => void;
}

const LABELS: Record<CanvasPatternType, string> = {
  blank: "Blank",
  lines: "Lines",
  grid: "Grid",
  graph: "Graph",
  dots: "Dots",
  cross: "Cross",
  isometric: "Iso",
};

const SWATCHES = [
  "#6b7280",
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
];

function PatternIcon({
  type,
  size = 18,
}: {
  type: CanvasPatternType;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.2,
    strokeLinecap: "round" as const,
  };
  switch (type) {
    case "blank":
      return (
        <svg {...common}>
          <rect x="2" y="2" width="12" height="12" rx="2" />
        </svg>
      );
    case "lines":
      return (
        <svg {...common}>
          <path d="M2 4.5h12M2 8h12M2 11.5h12" />
        </svg>
      );
    case "grid":
      return (
        <svg {...common}>
          <rect x="2" y="2" width="12" height="12" rx="1.5" />
          <path d="M6 2v12M10 2v12M2 6h12M2 10h12" />
        </svg>
      );
    case "graph":
      return (
        <svg {...common}>
          <path d="M2 2v12M14 2v12M2 2h12M2 14h12" strokeWidth="1.6" />
          <path d="M5 2v12M8 2v12M11 2v12M2 5h12M2 8h12M2 11h12" opacity="0.45" />
        </svg>
      );
    case "dots":
      return (
        <svg {...common} fill="currentColor" stroke="none">
          {[3.5, 8, 12.5].flatMap((y) =>
            [3.5, 8, 12.5].map((x) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="1" />
            )),
          )}
        </svg>
      );
    case "cross":
      return (
        <svg {...common}>
          {[3.5, 8, 12.5].flatMap((y) =>
            [3.5, 8, 12.5].map((x) => (
              <path
                key={`${x}-${y}`}
                d={`M${x - 1.2} ${y}h2.4M${x} ${y - 1.2}v2.4`}
              />
            )),
          )}
        </svg>
      );
    case "isometric":
      return (
        <svg {...common}>
          <path d="M4 2v12M8 2v12M12 2v12" />
          <path d="M2 4l12 7M2 9l12 7M2 -1l12 7M2 11l12-7M2 16l12-7" opacity="0.7" />
        </svg>
      );
  }
}

export default function CanvasPatternPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const isBlank = value.type === "blank";
  const gap = isBlank ? null : value.gaps[value.type as PatternKind];
  const customColor = value.color;
  const colorIsPreset =
    !!customColor &&
    SWATCHES.some((c) => c.toLowerCase() === customColor.toLowerCase());

  return (
    <div className="relative flex items-center justify-center" ref={rootRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center ${
          open || !isBlank
            ? "text-nm-accent bg-nm-raise"
            : "text-white/70 group-hover/panel:text-nm-text hover:bg-nm-raise"
        }`}
        title="Page Style"
      >
        <PatternIcon type={value.type} />
      </button>

      {open && (
        <div className="absolute top-1/2 right-[calc(100%+16px)] -translate-y-[70%] w-[240px] bg-nm-panel border border-nm-edge rounded-2xl shadow-nm-float p-4 z-[99999] animate-in fade-in slide-in-from-right-2 duration-200">
          <div className="text-[10px] font-bold text-nm-muted mb-2 uppercase tracking-[0.1em]">
            Page Style
          </div>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {PATTERN_TYPES.map((type) => {
              const active = value.type === type;
              return (
                <button
                  key={type}
                  onClick={() => onChange({ ...value, type })}
                  title={LABELS[type]}
                  className={`flex flex-col items-center gap-1 py-2 rounded-xl border transition-all ${
                    active
                      ? "border-nm-accent/60 text-nm-accent bg-nm-raise"
                      : "border-nm-edge text-nm-muted hover:text-nm-text hover:bg-nm-raise"
                  }`}
                >
                  <PatternIcon type={type} size={16} />
                  <span className="text-[10px] font-medium">{LABELS[type]}</span>
                </button>
              );
            })}
          </div>

          {!isBlank && gap !== null && (
            <>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-nm-muted uppercase tracking-[0.1em]">
                    Spacing
                  </span>
                  <span className="text-xs font-mono text-nm-text">{gap}px</span>
                </div>
                <input
                  type="range"
                  min={PATTERN_MIN_GAP}
                  max={PATTERN_MAX_GAP}
                  step={1}
                  value={gap}
                  onChange={(e) => {
                    const g = Number(e.target.value);
                    const k = value.type as PatternKind;
                    onChange({ ...value, gaps: { ...value.gaps, [k]: g } });
                  }}
                  className="w-full accent-[rgb(var(--nm-accent))] cursor-pointer"
                />
              </div>

              <div>
                <div className="text-[10px] font-bold text-nm-muted mb-2 uppercase tracking-[0.1em]">
                  Color
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onChange({ ...value, color: null })}
                    title="Auto"
                    className={`w-5 h-5 rounded-full border border-nm-edge text-[9px] font-bold flex items-center justify-center text-nm-muted hover:text-nm-text transition-all ${
                      customColor === null
                        ? "ring-2 ring-nm-accent ring-offset-1 ring-offset-zinc-800"
                        : ""
                    }`}
                  >
                    A
                  </button>
                  {SWATCHES.map((c) => (
                    <button
                      key={c}
                      onClick={() => onChange({ ...value, color: c })}
                      title={c}
                      className={`w-5 h-5 rounded-full border border-nm-edge transition-all hover:scale-110 ${
                        customColor?.toLowerCase() === c
                          ? "ring-2 ring-nm-accent ring-offset-1 ring-offset-zinc-800"
                          : ""
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <ColorPicker
                    color={customColor ?? "#6b7280"}
                    onChange={(c) => onChange({ ...value, color: c.toLowerCase() })}
                    title="Custom line color"
                    placement="bottom"
                    trigger={
                      <div
                        className={`w-5 h-5 rounded-full border border-nm-edge transition-all hover:scale-110 ${
                          customColor && !colorIsPreset
                            ? "ring-2 ring-nm-accent ring-offset-1 ring-offset-zinc-800"
                            : ""
                        }`}
                        style={{
                          background:
                            "conic-gradient(#ef4444, #f59e0b, #10b981, #3b82f6, #8b5cf6, #ef4444)",
                        }}
                      />
                    }
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
