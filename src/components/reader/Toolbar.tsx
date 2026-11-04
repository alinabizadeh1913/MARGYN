"use client";

import React, { useState, useRef, useEffect } from "react";
import { Pen, Eraser, Trash2, ChevronDown, Palette } from "lucide-react";
import { useTool } from "@/providers/ToolProvider";
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

  const defaultColors = [
    "#38bdf8",
    "#f43f5e",
    "#10b981",
    "#f59e0b",
    "#a855f7",
    "#fafafa",
  ];

  // Generate even sizes from 8 to 36
  const sizes = Array.from({ length: 15 }, (_, i) => 8 + i * 2);

  // Close dropdowns when clicking outside
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
    <div className="w-full max-w-fit flex flex-wrap items-center justify-center gap-1 p-1.5 rounded-xl bg-[#18181b] border border-[#27272a] shadow-lg">
      {/* Tools */}
      <div className="flex items-center gap-1 pr-2 border-r border-[#27272a]">
        <button
          onClick={() => setTool("pen")}
          className={`p-1.5 rounded-lg transition-colors ${tool === "pen" ? "bg-[#27272a] text-[#fafafa]" : "text-[#a1a1aa] hover:text-[#fafafa]"}`}
        >
          <Pen size={16} />
        </button>
        <button
          onClick={() => setTool("eraser")}
          className={`p-1.5 rounded-lg transition-colors ${tool === "eraser" ? "bg-[#27272a] text-[#fafafa]" : "text-[#a1a1aa] hover:text-[#fafafa]"}`}
        >
          <Eraser size={16} />
        </button>
      </div>

      {/* Colors */}
      {tool === "pen" && (
        <div className="flex items-center gap-1.5 px-2 border-r border-[#27272a]">
          {defaultColors.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full transition-transform ${color === c ? "scale-110 ring-2 ring-offset-2 ring-offset-[#18181b] ring-[#fafafa]" : "hover:scale-110"}`}
              style={{ backgroundColor: c }}
            />
          ))}

          {/* Custom Color Picker */}
          <div className="relative flex items-center justify-center w-5 h-5 ml-1">
            <input
              ref={colorInputRef}
              type="color"
              value={customColor}
              onChange={(e) => updateCustomColor(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              title="Pick custom color"
            />
            <button
              onClick={() => colorInputRef.current?.click()}
              className={`w-full h-full rounded-full flex items-center justify-center transition-transform ${color === customColor ? "scale-110 ring-2 ring-offset-2 ring-offset-[#18181b] ring-[#fafafa]" : "hover:scale-110"}`}
              style={{
                background: `conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)`,
                border:
                  color === customColor
                    ? "2px solid transparent"
                    : "2px solid #27272a",
              }}
              title="Custom Color"
            >
              <div className="w-2.5 h-2.5 bg-[#18181b] rounded-full" />
            </button>
          </div>
        </div>
      )}

      {/* Size Dropdown */}
      <div
        className="relative px-2 border-r border-[#27272a]"
        ref={sizeMenuRef}
      >
        <button
          onClick={() => setIsSizeMenuOpen(!isSizeMenuOpen)}
          className="flex items-center gap-1.5 p-1.5 rounded-lg text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] transition-colors"
        >
          <Typography variant="chip" as="span" className="w-5 text-center">
            {size}
          </Typography>
          <ChevronDown
            size={12}
            className={`transition-transform ${isSizeMenuOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isSizeMenuOpen && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-24 max-h-60 overflow-y-auto bg-[#18181b] border border-[#27272a] rounded-lg shadow-xl flex flex-col z-50 py-1">
            {sizes.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSize(s);
                  setIsSizeMenuOpen(false);
                }}
                className={`px-4 py-1.5 text-center text-sm transition-colors ${size === s ? "text-[#38bdf8] font-bold bg-[#27272a]" : "text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a]"}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Clear Dropdown */}
      <div className="relative pl-1" ref={deleteMenuRef}>
        <button
          onClick={() => setIsDeleteMenuOpen(!isDeleteMenuOpen)}
          className={`flex items-center gap-1 p-1.5 rounded-lg transition-colors ${isDeleteMenuOpen ? "bg-rose-500/10 text-rose-500" : "text-rose-500/70 hover:text-rose-500 hover:bg-rose-500/10"}`}
          title="Delete options"
        >
          <Trash2 size={16} />
          <ChevronDown size={12} />
        </button>

        {isDeleteMenuOpen && (
          <div className="absolute top-full right-0 mt-2 w-48 bg-[#18181b] border border-[#27272a] rounded-lg shadow-xl overflow-hidden flex flex-col z-50">
            <button
              onClick={() => {
                onClearCurrentPage();
                setIsDeleteMenuOpen(false);
              }}
              className="px-4 py-2 text-left text-sm text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] transition-colors"
            >
              Clear Current Page
            </button>
            <button
              onClick={() => {
                onClearAllPages();
                setIsDeleteMenuOpen(false);
              }}
              className="px-4 py-2 text-left text-sm text-rose-500 hover:bg-rose-500/10 transition-colors"
            >
              Clear All Pages
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
