"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Pen,
  Eraser,
  Highlighter,
  Square,
  Circle,
  Minus,
  MoveUpRight,
  Trash2,
  ChevronDown,
  MousePointer2,
  Undo2,
  Redo2,
} from "lucide-react";
import { useTool, DEFAULT_COLORS, ToolType } from "@/providers/ToolProvider";
import ColorPicker from "./ColorPicker";

interface ToolbarProps {
  onClearCurrentPage: () => void;
  onClearAllPages: () => void;
  hasText?: boolean;
}

interface ToolItem {
  id: ToolType;
  icon: React.ElementType;
  label: string;
  disabled?: boolean;
  tooltip?: string;
}

const COLOR_TOOLS: ToolType[] = [
  "select",
  "pen",
  "highlighter",
  "rectangle",
  "circle",
  "line",
  "arrow",
];

export default function Toolbar({
  onClearCurrentPage,
  onClearAllPages,
  hasText = true,
}: ToolbarProps) {
  const {
    tool,
    setTool,
    color,
    setColor,
    customColor,
    updateCustomColor,
    size,
    setSize,
  } = useTool();

  const [isDeleteMenuOpen, setIsDeleteMenuOpen] = useState(false);
  const [isSizeMenuOpen, setIsSizeMenuOpen] = useState(false);
  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false);

  const deleteMenuRef = useRef<HTMLDivElement>(null);
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const shapeMenuRef = useRef<HTMLDivElement>(null);

  const sizes = Array.from({ length: 15 }, (_, i) => 8 + i * 2);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (deleteMenuRef.current && !deleteMenuRef.current.contains(target))
        setIsDeleteMenuOpen(false);
      if (sizeMenuRef.current && !sizeMenuRef.current.contains(target))
        setIsSizeMenuOpen(false);
      if (shapeMenuRef.current && !shapeMenuRef.current.contains(target))
        setIsShapeMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!hasText && tool === "highlighter") setTool("pen");
  }, [hasText, tool, setTool]);

  const baseTools: ToolItem[] = [
    { id: "select", icon: MousePointer2, label: "Select / Move (V)" },
    { id: "pen", icon: Pen, label: "Pen (P)" },
    {
      id: "highlighter",
      icon: Highlighter,
      label: "Highlighter (H)",
      disabled: !hasText,
      tooltip: "Highlighter requires text in PDF",
    },
    { id: "eraser", icon: Eraser, label: "Eraser (E)" },
  ];

  const shapeTools: ToolItem[] = [
    { id: "rectangle", icon: Square, label: "Rectangle (R)" },
    { id: "circle", icon: Circle, label: "Ellipse (O)" },
    { id: "line", icon: Minus, label: "Line (L) – Shift = 45°" },
    { id: "arrow", icon: MoveUpRight, label: "Arrow (A) – snaps to shapes" },
  ];

  const activeShape = shapeTools.find((t) => t.id === tool);
  const ActiveShapeIcon = activeShape ? activeShape.icon : Square;
  const showColors = COLOR_TOOLS.includes(tool);

  return (
    <div className="relative z-[100] flex items-center gap-1 p-1 rounded-xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-lg shrink-0 overflow-x-auto scrollbar-hide max-w-full">
      <div className="flex items-center gap-0.5 pr-1 border-r border-white/10 shrink-0">
        {baseTools.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            disabled={t.disabled}
            title={t.disabled ? t.tooltip : t.label}
            className={`relative p-1.5 rounded-lg transition-all duration-300 ${
              tool === t.id
                ? "bg-[#38bdf8]/20 text-[#38bdf8]"
                : t.disabled
                  ? "text-[#3f3f46] cursor-not-allowed"
                  : "text-[#a1a1aa] hover:text-white hover:bg-white/10"
            }`}
          >
            {tool === t.id && (
              <div className="absolute inset-0 bg-[#38bdf8]/30 blur-md rounded-lg" />
            )}
            <t.icon size={15} className="relative z-10" />
          </button>
        ))}

        <div className="relative" ref={shapeMenuRef}>
          <button
            onClick={() => setIsShapeMenuOpen(!isShapeMenuOpen)}
            title="Shapes"
            className={`relative p-1.5 rounded-lg transition-all duration-300 flex items-center gap-0.5 ${
              activeShape
                ? "bg-[#38bdf8]/20 text-[#38bdf8]"
                : "text-[#a1a1aa] hover:text-white hover:bg-white/10"
            }`}
          >
            {activeShape && (
              <div className="absolute inset-0 bg-[#38bdf8]/30 blur-md rounded-lg" />
            )}
            <ActiveShapeIcon size={15} className="relative z-10" />
            <ChevronDown
              size={10}
              className={`relative z-10 transition-transform duration-300 ${
                isShapeMenuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {isShapeMenuOpen && (
            <div className="absolute top-full left-0 mt-3 w-36 bg-[#121214] border border-[#27272a] rounded-xl shadow-2xl flex flex-col z-[999] py-1">
              {shapeTools.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTool(t.id);
                    setIsShapeMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    tool === t.id
                      ? "bg-[#38bdf8]/20 text-[#38bdf8]"
                      : "text-[#a1a1aa] hover:text-white hover:bg-white/5"
                  }`}
                >
                  <t.icon size={14} />
                  <span>{t.label.split(" (")[0]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 px-1 border-r border-white/10 shrink-0">
        <button
          onClick={() => window.dispatchEvent(new Event("margyn-undo"))}
          title="Undo (Ctrl+Z)"
          className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-colors"
        >
          <Undo2 size={15} />
        </button>
        <button
          onClick={() => window.dispatchEvent(new Event("margyn-redo"))}
          title="Redo (Ctrl+Shift+Z)"
          className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-colors"
        >
          <Redo2 size={15} />
        </button>
      </div>

      {showColors && (
        <div className="hidden md:flex items-center gap-1.5 px-1.5 border-r border-white/10 shrink-0">
          {DEFAULT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                color === c
                  ? "scale-125 ring-2 ring-white/80 ring-offset-1 ring-offset-[#09090b]"
                  : "hover:scale-110 opacity-70 hover:opacity-100 border border-white/20"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}

          <div className="relative flex items-center justify-center ml-0.5">
            <ColorPicker
              color={customColor}
              onChange={updateCustomColor}
              title="Custom Color"
              placement="bottom"
              trigger={
                <div
                  aria-label="Custom color"
                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all duration-300 border border-white/20 ${
                    color === customColor
                      ? "scale-125 ring-2 ring-white/80 ring-offset-1 ring-offset-[#09090b]"
                      : "hover:scale-110 opacity-70 hover:opacity-100"
                  }`}
                  style={{
                    background:
                      "conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
                  }}
                >
                  <div className="w-1.5 h-1.5 bg-[#09090b] rounded-full" />
                </div>
              }
            />
          </div>
        </div>
      )}

      <div
        className="relative px-1 border-r border-white/10 shrink-0"
        ref={sizeMenuRef}
      >
        <button
          onClick={() => setIsSizeMenuOpen(!isSizeMenuOpen)}
          title="Brush Size"
          className="flex items-center gap-1 p-1 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-colors"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <div
              className="rounded-full bg-white transition-all"
              style={{ width: Math.min(size, 14), height: Math.min(size, 14) }}
            />
          </div>
          <ChevronDown
            size={12}
            className={`transition-transform duration-300 ${
              isSizeMenuOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isSizeMenuOpen && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[120px] bg-[#121214] border border-[#27272a] rounded-xl shadow-2xl p-2 grid grid-cols-3 gap-1 z-[999]">
            {sizes.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSize(s);
                  setIsSizeMenuOpen(false);
                }}
                title={`${s}px`}
                className={`aspect-square rounded-lg flex items-center justify-center transition-all ${
                  size === s ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <div
                  className={`rounded-full transition-all ${
                    size === s
                      ? "bg-[#38bdf8] shadow-[0_0_10px_#38bdf8]"
                      : "bg-[#a1a1aa]"
                  }`}
                  style={{ width: s / 1.5, height: s / 1.5 }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative pl-1 shrink-0" ref={deleteMenuRef}>
        <button
          onClick={() => setIsDeleteMenuOpen(!isDeleteMenuOpen)}
          title="Clear Options"
          className={`flex items-center gap-1 p-1 rounded-lg transition-all duration-300 ${
            isDeleteMenuOpen
              ? "bg-rose-500/20 text-rose-400"
              : "text-[#a1a1aa] hover:text-rose-400 hover:bg-rose-500/10"
          }`}
        >
          <Trash2 size={14} />
          <ChevronDown size={10} />
        </button>

        {isDeleteMenuOpen && (
          <div className="absolute top-full right-0 mt-3 w-48 bg-[#121214] border border-[#27272a] rounded-xl shadow-2xl overflow-hidden flex flex-col z-[999]">
            <button
              onClick={() => {
                onClearCurrentPage();
                setIsDeleteMenuOpen(false);
              }}
              className="px-4 py-3 text-left text-sm text-[#a1a1aa] hover:text-white hover:bg-white/5 transition-colors"
            >
              Clear Current Page
            </button>
            <div className="h-px w-full bg-[#27272a]" />
            <button
              onClick={() => {
                onClearAllPages();
                setIsDeleteMenuOpen(false);
              }}
              className="px-4 py-3 text-left text-sm text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              Clear All Pages
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
