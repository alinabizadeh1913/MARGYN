"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Palette, Check, Pipette } from "lucide-react";

declare global {
  interface Window {
    EyeDropper?: new () => {
      open: () => Promise<{ sRGBHex: string }>;
    };
  }
}

const PRESET_COLORS = [
  "#ffffff",
  "#f4f4f5",
  "#d4d4d8",
  "#71717a",
  "#09090b",
  "#f43f5e",
  "#f59e0b",
  "#10b981",
  "#38bdf8",
  "#a855f7",
];

function hexToHsv(hex: string) {
  let r = 0,
    g = 0,
    b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex[1] + hex[2], 16);
    g = parseInt(hex[3] + hex[4], 16);
    b = parseInt(hex[5] + hex[6], 16);
  }
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0,
    v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    v: Math.round(v * 100),
  };
}

function hsvToHex(h: number, s: number, v: number) {
  s /= 100;
  v /= 100;
  const i = Math.floor(h / 60);
  const f = h / 60 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0,
    g = 0,
    b = 0;
  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  title?: string;
  trigger?: React.ReactNode; // ✅ پراپ جدید برای دکمه سفارشی
  placement?: "left" | "bottom"; // ✅ پراپ جدید برای جهت باز شدن
}

export default function ColorPicker({
  color,
  onChange,
  title = "Canvas Background Color",
  trigger,
  placement = "left",
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hsv, setHsv] = useState(() => hexToHsv(color));
  const [hexInput, setHexInput] = useState(color.replace("#", ""));
  const popoverRef = useRef<HTMLDivElement>(null);

  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (color.toUpperCase() !== `#${hexInput}`.toUpperCase()) {
      setHsv(hexToHsv(color));
      setHexInput(color.replace("#", "").toUpperCase());
    }
  }, [color]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const updateColor = useCallback(
    (newHsv: { h: number; s: number; v: number }) => {
      setHsv(newHsv);
      const newHex = hsvToHex(newHsv.h, newHsv.s, newHsv.v);
      setHexInput(newHex.replace("#", ""));
      if (newHex.toLowerCase() !== color.toLowerCase()) {
        onChange(newHex);
      }
    },
    [color, onChange],
  );

  const handleSvUpdate = (e: React.PointerEvent | PointerEvent) => {
    if (!svRef.current) return;
    const rect = svRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    updateColor({
      ...hsv,
      s: Math.round(x * 100),
      v: Math.round((1 - y) * 100),
    });
  };

  const handleHueUpdate = (e: React.PointerEvent | PointerEvent) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    updateColor({ ...hsv, h: Math.round(x * 360) });
  };

  const handleHexInput = (val: string) => {
    const cleanVal = val.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
    setHexInput(cleanVal);
    if (cleanVal.length === 6) {
      const newHsv = hexToHsv(`#${cleanVal}`);
      setHsv(newHsv);
      if (`#${cleanVal}`.toLowerCase() !== color.toLowerCase()) {
        onChange(`#${cleanVal}`);
      }
    }
  };

  const handleEyedropper = async () => {
    if (!window.EyeDropper) return;
    try {
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      const newColor = result.sRGBHex.toUpperCase();
      updateColor(hexToHsv(newColor));
    } catch (e: any) {
      if (e.name !== "AbortError") console.error(e);
    }
  };

  return (
    <div className="relative flex items-center justify-center" ref={popoverRef}>
      {/* ✅ اگر دکمه سفارشی داده شده باشد از آن استفاده می‌کند، در غیر این صورت آیکون پیش‌فرض */}
      {trigger ? (
        <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
          {trigger}
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center ${isOpen ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"}`}
          title={title}
        >
          <Palette size={18} />
        </button>
      )}

      {isOpen && (
        <div
          className={`absolute w-[260px] bg-gradient-to-br from-zinc-900 to-zinc-700 border border-zinc-600/50 rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.8)] p-4 z-[99999] animate-in fade-in duration-200 ${
            placement === "left"
              ? "top-1/2 right-[calc(100%+16px)] -translate-y-[30%] slide-in-from-right-2"
              : "top-[calc(100%+16px)] right-0 slide-in-from-top-2"
          }`}
        >
          <div
            ref={svRef}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              handleSvUpdate(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1) handleSvUpdate(e);
            }}
            className="relative w-full h-28 rounded-lg mb-4 cursor-crosshair overflow-hidden border border-white/10 shadow-inner"
            style={{ backgroundColor: `hsl(${hsv.h}, 100%, 50%)` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
            <div
              className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-[0_0_4px_rgba(0,0,0,0.5)] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                left: `${hsv.s}%`,
                top: `${100 - hsv.v}%`,
                backgroundColor: `#${hexInput}`,
              }}
            />
          </div>

          <div
            ref={hueRef}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              handleHueUpdate(e);
            }}
            onPointerMove={(e) => {
              if (e.buttons === 1) handleHueUpdate(e);
            }}
            className="relative w-full h-3 rounded-full mb-4 cursor-pointer border border-white/10"
            style={{
              background:
                "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
            }}
          >
            <div
              className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 top-1/2 pointer-events-none"
              style={{
                left: `${(hsv.h / 360) * 100}%`,
                backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
              }}
            />
          </div>

          <div className="text-[10px] font-bold text-zinc-400 mb-2 uppercase tracking-[0.1em]">
            Quick Presets
          </div>
          <div className="grid grid-cols-5 gap-2 mb-4">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => updateColor(hexToHsv(c))}
                className={`w-full aspect-square max-h-6 rounded-full border border-white/20 transition-all hover:scale-110 flex items-center justify-center ${color.toUpperCase() === c.toUpperCase() ? "ring-2 ring-[#38bdf8] ring-offset-1 ring-offset-zinc-800" : ""}`}
                style={{ backgroundColor: c }}
              >
                {color.toUpperCase() === c.toUpperCase() && (
                  <Check
                    size={12}
                    className={
                      c === "#ffffff" || c === "#f4f4f5" || c === "#d4d4d8"
                        ? "text-black"
                        : "text-white"
                    }
                  />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2 focus-within:border-[#38bdf8]/70 transition-colors shadow-inner">
            <button
              onClick={handleEyedropper}
              className="text-zinc-400 hover:text-[#38bdf8] transition-colors shrink-0"
              title="Pick color from screen"
            >
              <Pipette size={16} />
            </button>
            <span className="text-zinc-500 font-mono text-sm shrink-0">#</span>
            <input
              type="text"
              value={hexInput}
              onChange={(e) => handleHexInput(e.target.value)}
              className="flex-1 w-full bg-transparent outline-none text-white font-mono text-sm uppercase placeholder:text-zinc-600"
              maxLength={6}
              spellCheck={false}
              placeholder="HEX"
            />
          </div>
        </div>
      )}
    </div>
  );
}
