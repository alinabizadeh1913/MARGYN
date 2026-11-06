"use client";

import React, { useState, useRef, useEffect } from "react";
import PdfDrawingLayer from "./PdfDrawingLayer";
import { Plus, ZoomIn, ZoomOut, RotateCcw, Trash2, Type } from "lucide-react"; // ✅ Type اضافه شد
import Typography from "@/typography";
import { useSession } from "@/providers/SessionProvider";

interface BlankPageViewerProps {
  filePath: string;
  initialPages?: number;
  canvasBg?: string;
  onPageAdded: (newTotal: number) => void;
  onDeletePage: (pageNumber: number) => void;
  onOpenNote?: () => void;
}

const PAGE_WIDTH = 800;
const PAGE_HEIGHT = 1131;

export default function BlankPageViewer({
  filePath,
  initialPages = 1,
  canvasBg = "#ffffff",
  onPageAdded,
  onDeletePage,
  onOpenNote,
}: BlankPageViewerProps) {
  const [scale, setScale] = useState(1);
  const [pages, setPages] = useState(initialPages);
  const containerRef = useRef<HTMLDivElement>(null);
  const { setCurrentPage } = useSession();

  useEffect(() => {
    setPages(initialPages);
  }, [initialPages]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const centerY = container.scrollTop + container.clientHeight / 2;
    const pageHeight = PAGE_HEIGHT * scale + 40;
    const topPadding = 40;
    const pageIndex = Math.floor((centerY - topPadding) / pageHeight);
    const newPage = Math.min(pages, Math.max(1, pageIndex + 1));
    setCurrentPage(newPage);
  };

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

    setTimeout(() => {
      containerRef.current?.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 100);
  };

  return (
    <div className="w-full h-full bg-[#09090b] relative flex flex-col overflow-hidden">
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

        {/* ✅ دکمه نوت به پایین‌ترین قسمت منتقل شد و آیکون آن T شد */}
        {onOpenNote && (
          <button
            onClick={onOpenNote}
            className="bg-white/95 backdrop-blur-xl border border-zinc-200 p-3 rounded-2xl shadow-sm transition-all duration-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 flex items-center justify-center"
            title="Page Notes (Ctrl+T)"
          >
            <Type size={20} />
          </button>
        )}
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
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
              textLines={[]}
              onDeletePage={pages > 1 ? () => onDeletePage(i + 1) : undefined}
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
