"use client";

import React, { useState, useRef, useEffect } from "react";
import PdfDrawingLayer from "./PdfDrawingLayer";
import { Plus, ZoomIn, ZoomOut, RotateCcw, Trash2 } from "lucide-react";
import Typography from "@/typography";

interface BlankPageViewerProps {
  filePath: string;
  initialPages?: number;
  canvasBg?: string;
  onPageAdded: (newTotal: number) => void;
  onDeletePage: (pageNumber: number) => void; // ✅ این خط اضافه شد
}

const PAGE_WIDTH = 800;
const PAGE_HEIGHT = 1131; // نسبت A4

export default function BlankPageViewer({
  filePath,
  initialPages = 1,
  canvasBg = "#ffffff",
  onPageAdded,
  onDeletePage, // ✅ این پراپ اضافه شد
}: BlankPageViewerProps) {
  const [scale, setScale] = useState(1);
  const [pages, setPages] = useState(initialPages);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPages(initialPages);
  }, [initialPages]);

  // مدیریت زوم با Ctrl + Wheel
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        setScale((s) =>
          Math.min(3, Math.max(0.5, s - Math.sign(e.deltaY) * 0.1)),
        );
      }
    };
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  const handleAddPage = () => {
    const newTotal = pages + 1;
    setPages(newTotal);
    onPageAdded(newTotal);

    // اسکرول نرم به پایین‌ترین صفحه
    setTimeout(() => {
      containerRef.current?.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 100);
  };

  return (
    <div className="w-full h-full bg-[#09090b] relative flex flex-col overflow-hidden">
      {/* کنترل‌های زوم شبیه به PDF */}
      <div className="absolute top-8 right-8 flex flex-col gap-4 z-50">
        <div className="bg-white/95 backdrop-blur-xl border border-zinc-200 p-2 rounded-2xl flex flex-col gap-1.5 shadow-sm">
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.2))}
            className="p-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-all duration-200"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
            className="p-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-all duration-200"
          >
            <ZoomOut size={18} />
          </button>
          <button
            onClick={() => setScale(1)}
            className="p-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-all duration-200"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 w-full h-full overflow-y-auto flex flex-col items-center py-10 px-4"
      >
        {Array.from({ length: pages }).map((_, i) => (
          <div
            key={i}
            className="relative shadow-2xl rounded-sm ring-1 ring-white/10 shrink-0 mb-10 group"
            style={{
              width: PAGE_WIDTH * scale,
              height: PAGE_HEIGHT * scale,
              backgroundColor: canvasBg,
            }}
          >
            <div className="absolute top-4 left-4 text-zinc-400 font-mono text-sm select-none opacity-50 z-0 pointer-events-none">
              {i + 1}
            </div>

            {/* ✅ دکمه حذف صفحه در UI */}
            {pages > 1 && (
              <button
                onClick={() => onDeletePage(i + 1)}
                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-black/50 hover:bg-rose-500/80 text-white rounded-lg z-20"
                title="Delete Page"
              >
                <Trash2 size={16} />
              </button>
            )}

            <PdfDrawingLayer
              filePath={filePath}
              pageNumber={i + 1}
              width={PAGE_WIDTH * scale}
              height={PAGE_HEIGHT * scale}
              pdfWidth={PAGE_WIDTH * scale}
              pdfHeight={PAGE_HEIGHT * scale}
              textLines={[]} // صفحه خالی متن ندارد
              onDeletePage={pages > 1 ? () => onDeletePage(i + 1) : undefined} // ✅ پاس داده شد
            />
          </div>
        ))}

        <button
          onClick={handleAddPage}
          className="mb-20 flex items-center gap-2 px-6 py-3 rounded-full bg-[#121214] border border-[#27272a] text-[#a1a1aa] hover:text-white hover:bg-[#18181b] hover:border-[#38bdf8]/50 transition-all duration-300 shadow-xl group"
        >
          <Plus
            size={18}
            className="group-hover:text-[#38bdf8] transition-colors"
          />
          <Typography variant="button">Add New Page</Typography>
        </button>
      </div>
    </div>
  );
}
