"use client";

import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { useSession } from "@/providers/SessionProvider";
import { Maximize, Upload, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import Typography from "@/typography";

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function PdfViewer({ fileData }: { fileData: Uint8Array | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { setCurrentPage } = useSession();
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState(1.5);

  // Load the PDF from Uint8Array
  useEffect(() => {
    if (!fileData) {
      setPdfDoc(null);
      if (containerRef.current) containerRef.current.innerHTML = "";
      return;
    }

    const loadPdf = async () => {
      try {
        // Ensure the data is a pure Uint8Array
        const safeData = new Uint8Array(fileData);
        const loadingTask = pdfjsLib.getDocument({ data: safeData });
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
      } catch (error) {
        console.error("Failed to load PDF:", error);
      }
    };
    loadPdf();
  }, [fileData]);

  // Render all pages into the container
  useEffect(() => {
    if (!pdfDoc || !containerRef.current) return;

    const renderPages = async () => {
      const container = containerRef.current;
      if (!container) return;
      container.innerHTML = "";

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const pageWrapper = document.createElement("div");
        pageWrapper.className = "mb-8 shadow-2xl rounded-sm overflow-hidden bg-white";
        pageWrapper.setAttribute("data-page", i.toString());
        pageWrapper.appendChild(canvas);
        
        container.appendChild(pageWrapper);

        if (context) {
          await page.render({ canvasContext: context, viewport }).promise;
        }
      }
    };

    renderPages();
  }, [pdfDoc, scale]);

  // Anti-Obsession Logic: Silently track current page based on scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const pages = container.querySelectorAll("[data-page]");
      let currentVisiblePage = 1;

      pages.forEach((page) => {
        const rect = page.getBoundingClientRect();
        if (rect.top <= window.innerHeight / 2 && rect.bottom >= window.innerHeight / 2) {
          currentVisiblePage = parseInt(page.getAttribute("data-page") || "1", 10);
        }
      });

      setCurrentPage(currentVisiblePage);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [setCurrentPage]);

  if (!fileData) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center px-6 bg-[#18181b]">
        <div className="w-20 h-20 rounded-2xl bg-[#121214] border border-[#27272a] flex items-center justify-center mb-6">
          <Upload size={32} className="text-[#52525b]" />
        </div>
        <Typography variant="pageTitle" as="h1" className="text-[#fafafa] mb-3">
          Read, don't count.
        </Typography>
        <Typography variant="body" as="p" className="text-[#a1a1aa] max-w-md">
          Open a PDF to begin your session. No page numbers. No pressure. 
          Just you and the text.
        </Typography>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col relative">
      <div 
        ref={containerRef} 
        className="flex-1 overflow-y-auto p-12 flex flex-col items-center scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {!pdfDoc && (
          <div className="mt-20">
            <Typography variant="microLabel" className="text-[#52525b]">
              Loading Document...
            </Typography>
          </div>
        )}
      </div>

      {/* Floating Tools (Zoom, Fullscreen) */}
      <div className="absolute top-6 right-6 flex flex-col gap-2">
        <button 
          onClick={() => setScale(prev => Math.min(3, prev + 0.2))}
          className="p-2 bg-[#18181b]/80 backdrop-blur-md border border-[#27272a] rounded-md text-[#a1a1aa] hover:text-[#fafafa] transition-colors shadow-lg"
          title="Zoom In"
        >
          <ZoomIn size={16} />
        </button>
        <button 
          onClick={() => setScale(prev => Math.max(0.8, prev - 0.2))}
          className="p-2 bg-[#18181b]/80 backdrop-blur-md border border-[#27272a] rounded-md text-[#a1a1aa] hover:text-[#fafafa] transition-colors shadow-lg"
          title="Zoom Out"
        >
          <ZoomOut size={16} />
        </button>
        <button 
          onClick={() => setScale(1.5)}
          className="p-2 bg-[#18181b]/80 backdrop-blur-md border border-[#27272a] rounded-md text-[#a1a1aa] hover:text-[#fafafa] transition-colors shadow-lg"
          title="Reset Zoom"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
}