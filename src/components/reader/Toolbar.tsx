"use client";

import React, { useState, useRef, useEffect } from "react";
import { Pen, Eraser, Trash2, ChevronDown } from "lucide-react";
import { useTool, DEFAULT_COLORS } from "@/providers/ToolProvider";
import Typography from "@/typography";

interface ToolbarProps {
  onClearCurrentPage: () => void;
  onClearAllPages: () => void;
}

export default function Toolbar({
  onClearCurrentPage,
  onClearAllPages,
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

  const deleteMenuRef = useRef<HTMLDivElement>(null);
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const sizes = Array.from({ length: 15 }, (_, i) => 8 + i * 2);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        deleteMenuRef.current &&
        !deleteMenuRef.current.contains(event.target as Node)
      ) {
        setIsDeleteMenuOpen(false);
      }
      if (
        sizeMenuRef.current &&
        !sizeMenuRef.current.contains(event.target as Node)
      ) {
        setIsSizeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="w-full max-w-fit flex flex-wrap items-center justify-center gap-2 p-2 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      {/* Tools */}
      <div className="flex items-center gap-1 pr-3 border-r border-white/10">
        <button
          onClick={() => setTool("pen")}
          className={`relative p-2 rounded-xl transition-all duration-300 ${tool === "pen" ? "bg-[#38bdf8]/20 text-[#38bdf8]" : "text-[#a1a1aa] hover:text-white hover:bg-white/10"}`}
        >
          {tool === "pen" && (
            <div className="absolute inset-0 bg-[#38bdf8]/30 blur-md rounded-xl" />
          )}
          <Pen size={18} className="relative z-10" />
        </button>
        <button
          onClick={() => setTool("eraser")}
          className={`relative p-2 rounded-xl transition-all duration-300 ${tool === "eraser" ? "bg-rose-500/20 text-rose-400" : "text-[#a1a1aa] hover:text-white hover:bg-white/10"}`}
        >
          {tool === "eraser" && (
            <div className="absolute inset-0 bg-rose-500/30 blur-md rounded-xl" />
          )}
          <Eraser size={18} className="relative z-10" />
        </button>
      </div>

      {/* Colors */}
      {tool === "pen" && (
        <div className="flex items-center gap-2.5 px-3 border-r border-white/10">
          {DEFAULT_COLORS.map((c, i) => (
            <div key={c} className="relative group flex flex-col items-center">
              <button
                onClick={() => setColor(c)}
                className={`w-5 h-5 rounded-full transition-all duration-300 ${color === c ? "scale-125 ring-2 ring-white/80 ring-offset-2 ring-offset-[#09090b]" : "hover:scale-110 opacity-70 hover:opacity-100 border border-white/20"}`}
                style={{ backgroundColor: c }}
              />
              <span className="absolute -bottom-4 text-[9px] text-white/40 group-hover:text-white/80 transition-colors">
                {i + 1}
              </span>
            </div>
          ))}

          {/* Custom Color Picker */}
          <div className="relative flex items-center justify-center w-5 h-5 ml-1 group flex-col">
            <input
              ref={colorInputRef}
              type="color"
              value={customColor}
              onChange={(e) => updateCustomColor(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
            />
            <button
              onClick={() => colorInputRef.current?.click()}
              className={`w-full h-full rounded-full flex items-center justify-center transition-all duration-300 z-10 border border-white/20 ${color === customColor ? "scale-125 ring-2 ring-white/80 ring-offset-2 ring-offset-[#09090b]" : "hover:scale-110 opacity-70 hover:opacity-100"}`}
              style={{
                background: `conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)`,
              }}
            >
              <div className="w-2.5 h-2.5 bg-[#09090b] rounded-full" />
            </button>
          </div>
        </div>
      )}

      {/* Size Dropdown */}
      <div className="relative px-3 border-r border-white/10" ref={sizeMenuRef}>
        <button
          onClick={() => setIsSizeMenuOpen(!isSizeMenuOpen)}
          className="flex items-center gap-2 p-1.5 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-colors"
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <div
              className="rounded-full bg-white transition-all"
              style={{ width: Math.min(size, 20), height: Math.min(size, 20) }}
            />
          </div>
          <ChevronDown
            size={14}
            className={`transition-transform duration-300 ${isSizeMenuOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isSizeMenuOpen && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-16 max-h-64 overflow-y-auto bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl flex flex-col z-50 py-2 scrollbar-hide">
            {sizes.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSize(s);
                  setIsSizeMenuOpen(false);
                }}
                className={`py-2 flex items-center justify-center transition-all ${size === s ? "bg-white/10" : "hover:bg-white/5"}`}
              >
                <div
                  className={`rounded-full ${size === s ? "bg-[#38bdf8] shadow-[0_0_10px_#38bdf8]" : "bg-[#a1a1aa]"}`}
                  style={{ width: s / 1.5, height: s / 1.5 }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Clear Dropdown */}
      <div className="relative pl-1" ref={deleteMenuRef}>
        <button
          onClick={() => setIsDeleteMenuOpen(!isDeleteMenuOpen)}
          className={`flex items-center gap-1.5 p-2 rounded-xl transition-all duration-300 ${isDeleteMenuOpen ? "bg-rose-500/20 text-rose-400" : "text-[#a1a1aa] hover:text-rose-400 hover:bg-rose-500/10"}`}
        >
          <Trash2 size={16} />
          <ChevronDown size={12} />
        </button>

        {isDeleteMenuOpen && (
          <div className="absolute top-full right-0 mt-4 w-48 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col z-50">
            <button
              onClick={() => {
                onClearCurrentPage();
                setIsDeleteMenuOpen(false);
              }}
              className="px-4 py-3 text-left text-sm text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-colors"
            >
              Clear Current Page
            </button>
            <button
              onClick={() => {
                onClearAllPages();
                setIsDeleteMenuOpen(false);
              }}
              className="px-4 py-3 text-left text-sm text-rose-400 hover:bg-rose-500/20 transition-colors"
            >
              Clear All Pages
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
