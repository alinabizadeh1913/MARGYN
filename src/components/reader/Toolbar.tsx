"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  PenTool,
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
    { id: "pen", icon: PenTool, label: "Pen (P)" },
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
    { id: "rectangle", icon: Square, label: "Rectangle" },
    { id: "circle", icon: Circle, label: "Ellipse" },
    { id: "line", icon: Minus, label: "Line" },
    { id: "arrow", icon: MoveUpRight, label: "Arrow" },
  ];

  const activeShape = shapeTools.find((t) => t.id === tool);
  const ActiveShapeIcon = activeShape ? activeShape.icon : Square;
  const showColors = COLOR_TOOLS.includes(tool);

  return (
    // ✅ overflow-x-auto و scrollbar-hide حذف شدند تا دراپ‌دان‌ها بریده نشوند
    <div className="relative z-[100] flex items-center gap-1 p-1.5 rounded-2xl bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-nm-edge shadow-nm-float shrink-0">
      <div className="flex items-center gap-0.5 pr-1 border-r border-nm-edge shrink-0">
        {baseTools.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            disabled={t.disabled}
            title={t.disabled ? t.tooltip : t.label}
            className={`relative p-[7px] rounded-xl transition-all duration-300 ${
              tool === t.id
                ? "bg-nm-accent/20 text-nm-hot ring-1 ring-nm-accent/50"
                : t.disabled
                  ? "text-nm-faint cursor-not-allowed"
                  : "text-nm-muted hover:text-white hover:bg-white/10"
            }`}
          >
            {tool === t.id && (
              <div className="absolute inset-0 bg-nm-accent/30 blur-md rounded-lg" />
            )}
            <t.icon size={17} className="relative z-10" />
          </button>
        ))}

        <div className="relative" ref={shapeMenuRef}>
          <button
            onClick={() => setIsShapeMenuOpen(!isShapeMenuOpen)}
            title="Shapes"
            className={`relative p-[7px] rounded-xl transition-all duration-300 flex items-center gap-0.5 ${
              activeShape
                ? "bg-nm-accent/20 text-nm-hot ring-1 ring-nm-accent/50"
                : "text-nm-muted hover:text-white hover:bg-white/10"
            }`}
          >
            {activeShape && (
              <div className="absolute inset-0 bg-nm-accent/30 blur-md rounded-lg" />
            )}
            <ActiveShapeIcon size={17} className="relative z-10" />
            <ChevronDown
              size={10}
              className={`relative z-10 transition-transform duration-300 ${
                isShapeMenuOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {isShapeMenuOpen && (
            // ✅ استایل شیک‌تر و مدرن‌تر برای منوی کشویی اشکال
            <div className="absolute top-full left-0 mt-2 w-44 bg-nm-panel border border-nm-edge rounded-xl shadow-nm-float flex flex-col z-[999] p-1.5 animate-in fade-in zoom-in-95 duration-150">
              {shapeTools.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTool(t.id);
                    setIsShapeMenuOpen(false);
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                    tool === t.id
                      ? "bg-nm-accent/15 text-nm-accent"
                      : "text-nm-muted hover:text-white hover:bg-white/5"
                  }`}
                >
                  <t.icon size={16} />
                  <span className="font-medium">{t.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 px-1 border-r border-nm-edge shrink-0">
        <button
          onClick={() => window.dispatchEvent(new Event("margyn-undo"))}
          title="Undo (Ctrl+Z)"
          className="p-[7px] rounded-xl text-nm-muted hover:text-white hover:bg-white/10 transition-colors"
        >
          <Undo2 size={17} />
        </button>
        <button
          onClick={() => window.dispatchEvent(new Event("margyn-redo"))}
          title="Redo (Ctrl+Shift+Z)"
          className="p-[7px] rounded-xl text-nm-muted hover:text-white hover:bg-white/10 transition-colors"
        >
          <Redo2 size={17} />
        </button>
      </div>

      {showColors && (
        <div className="hidden md:flex items-center gap-1.5 px-1.5 border-r border-nm-edge shrink-0">
          {DEFAULT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              className={`w-4 h-4 rounded-full transition-all duration-300 ${
                color === c
                  ? "scale-125 ring-2 ring-white/80 ring-offset-1 ring-offset-nm-deep"
                  : "hover:scale-110 opacity-70 hover:opacity-100 border border-nm-edge"
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
                  className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-300 border border-nm-edge ${
                    color === customColor
                      ? "scale-125 ring-2 ring-white/80 ring-offset-1 ring-offset-nm-deep"
                      : "hover:scale-110 opacity-70 hover:opacity-100"
                  }`}
                  style={{
                    background:
                      "conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
                  }}
                >
                  <div className="w-1.5 h-1.5 bg-nm-deep rounded-full" />
                </div>
              }
            />
          </div>
        </div>
      )}

      <div
        className="relative px-1 border-r border-nm-edge shrink-0"
        ref={sizeMenuRef}
      >
        <button
          onClick={() => setIsSizeMenuOpen(!isSizeMenuOpen)}
          title="Brush Size"
          className="flex items-center gap-1 p-[5px] rounded-xl text-nm-muted hover:text-white hover:bg-white/10 transition-colors"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <div
              className="rounded-full bg-white transition-all shadow-sm"
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
          // ✅ استایل شیک‌تر و چیدمان گرید ۴ ستونه برای انتخاب سایز
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[160px] bg-nm-panel border border-nm-edge rounded-xl shadow-nm-float p-2 grid grid-cols-4 gap-1.5 z-[999] animate-in fade-in zoom-in-95 duration-150">
            {sizes.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSize(s);
                  setIsSizeMenuOpen(false);
                }}
                title={`${s}px`}
                className={`aspect-square rounded-lg flex items-center justify-center transition-all ${
                  size === s ? "bg-nm-accent/15" : "hover:bg-white/5"
                }`}
              >
                <div
                  className={`rounded-full transition-all ${
                    size === s
                      ? "bg-nm-accent shadow-nm-glow-sm"
                      : "bg-nm-muted"
                  }`}
                  style={{ width: s / 1.8, height: s / 1.8 }}
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
          className={`flex items-center gap-1 p-[5px] rounded-xl transition-all duration-300 ${
            isDeleteMenuOpen
              ? "bg-rose-500/20 text-rose-400"
              : "text-nm-muted hover:text-rose-400 hover:bg-rose-500/10"
          }`}
        >
          <Trash2 size={16} />
          <ChevronDown
            size={10}
            className={`transition-transform duration-300 ${
              isDeleteMenuOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isDeleteMenuOpen && (
          // ✅ استایل شیک‌تر برای منوی پاک کردن
          <div className="absolute top-full right-0 mt-2 w-52 bg-nm-panel border border-nm-edge rounded-xl shadow-nm-float overflow-hidden flex flex-col z-[999] p-1.5 animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => {
                onClearCurrentPage();
                setIsDeleteMenuOpen(false);
              }}
              className="px-3 py-2.5 text-left text-sm font-medium text-nm-muted rounded-lg hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <Square size={16} className="opacity-70" />
              Clear Current Page
            </button>
            <button
              onClick={() => {
                onClearAllPages();
                setIsDeleteMenuOpen(false);
              }}
              className="px-3 py-2.5 text-left text-sm font-medium text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} className="opacity-70" />
              Clear All Pages
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
