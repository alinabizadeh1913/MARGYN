"use client";

import React from "react";
import { Pen, Eraser, Minus, Plus, Trash2 } from "lucide-react";
import { useTool } from "@/providers/ToolProvider";
import Typography from "@/typography";

export default function Toolbar({ clearCanvas }: { clearCanvas: () => void }) {
  const { tool, setTool, color, setColor, size, setSize } = useTool();
  const colors = ["#38bdf8", "#f43f5e", "#10b981", "#f59e0b", "#a855f7", "#fafafa"];

  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1.5 rounded-xl bg-[#18181b]/90 backdrop-blur-md border border-[#27272a] shadow-2xl z-50">
      
      {/* Tools */}
      <div className="flex items-center gap-1 pr-2 border-r border-[#27272a]">
        <button
          onClick={() => setTool("pen")}
          className={`p-2 rounded-lg transition-colors ${tool === "pen" ? "bg-[#27272a] text-[#fafafa]" : "text-[#a1a1aa] hover:text-[#fafafa]"}`}
        >
          <Pen size={16} />
        </button>
        <button
          onClick={() => setTool("eraser")}
          className={`p-2 rounded-lg transition-colors ${tool === "eraser" ? "bg-[#27272a] text-[#fafafa]" : "text-[#a1a1aa] hover:text-[#fafafa]"}`}
        >
          <Eraser size={16} />
        </button>
      </div>

      {/* Colors (Only for Pen) */}
      {tool === "pen" && (
        <div className="flex items-center gap-2 px-2 border-r border-[#27272a]">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full transition-transform ${color === c ? "scale-110 ring-2 ring-offset-2 ring-offset-[#18181b] ring-[#fafafa]" : "hover:scale-110"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}

      {/* Size Controls */}
      <div className="flex items-center gap-2 px-2 border-r border-[#27272a]">
        <button onClick={() => setSize(Math.max(1, size - 1))} className="p-1 text-[#a1a1aa] hover:text-[#fafafa]">
          <Minus size={14} />
        </button>
        <Typography variant="chip" as="span" className="text-[#a1a1aa] w-4 text-center">
          {size}
        </Typography>
        <button onClick={() => setSize(Math.min(20, size + 1))} className="p-1 text-[#a1a1aa] hover:text-[#fafafa]">
          <Plus size={14} />
        </button>
      </div>

      {/* Clear All (The "Total Eraser") */}
      <div className="pl-1">
        <button 
          onClick={clearCanvas}
          className="p-2 text-rose-500/70 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
          title="Clear all drawings"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}