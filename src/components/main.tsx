"use client";

import React, { useRef, useState } from "react";
import MarginCanvas from "./reader/MarginCanvas";
import PdfViewer from "./reader/PdfViewer";
import Toolbar from "./reader/Toolbar";
import HistoryView from "./HistoryView";
import SettingsView from "./SettingsView";
import { Play, Square, Settings, Library, BookOpen, FileText } from "lucide-react";
import { SessionProvider, useSession } from "@/providers/SessionProvider";
import { ToolProvider } from "@/providers/ToolProvider";
import Typography from "@/typography";

function AppContent() {
  const { isActive, startSession, endSession } = useSession();
  const [view, setView] = useState<"reader" | "history" | "settings">("reader");
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);

  const clearCanvasRef = useRef<(() => void) | null>(null);

  const handleOpenPdf = async () => {
    if (window.electronAPI) {
      const data = await window.electronAPI.openPdf();
      if (data) {
        setPdfData(new Uint8Array(data));
      }
    } else {
      alert("File dialog is only available in the desktop app.");
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#09090b]">
      {/* Top Bar */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-[#27272a] bg-[#09090b]/80 backdrop-blur-md shrink-0 z-50">
        <div className="flex items-center gap-6">
          <Typography variant="cardTitle" as="span" className="text-[#fafafa]">
            MARGYN
          </Typography>
          
          {/* Navigation */}
          <div className="flex items-center gap-1 bg-[#18181b] p-1 rounded-lg border border-[#27272a]">
            <button
              onClick={() => setView("reader")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                view === "reader" ? "bg-[#27272a] text-[#fafafa]" : "text-[#a1a1aa] hover:text-[#fafafa]"
              }`}
            >
              <BookOpen size={14} />
              <Typography variant="button">Reader</Typography>
            </button>
            <button
              onClick={() => setView("history")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                view === "history" ? "bg-[#27272a] text-[#fafafa]" : "text-[#a1a1aa] hover:text-[#fafafa]"
              }`}
            >
              <Library size={14} />
              <Typography variant="button">History</Typography>
            </button>
            <button
              onClick={() => setView("settings")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                view === "settings" ? "bg-[#27272a] text-[#fafafa]" : "text-[#a1a1aa] hover:text-[#fafafa]"
              }`}
            >
              <Settings size={14} />
              <Typography variant="button">Settings</Typography>
            </button>
          </div>

          {/* Open PDF Button */}
          {view === "reader" && (
             <button
               onClick={handleOpenPdf}
               className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] transition-colors text-xs font-medium border border-transparent hover:border-[#3f3f46]"
             >
               <FileText size={14} />
               <Typography variant="button">Open PDF</Typography>
             </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {view === "reader" && pdfData && (
            <button
              onClick={isActive ? endSession : startSession}
              className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all duration-300 ${
                isActive
                  ? "bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20"
                  : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20"
              }`}
            >
              {isActive ? (
                <>
                  <Square size={12} fill="currentColor" />
                  <Typography variant="button">End Session</Typography>
                </>
              ) : (
                <>
                  <Play size={12} fill="currentColor" />
                  <Typography variant="button">Start Session</Typography>
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {view === "reader" && (
          <>
            <div className="w-[30%] min-w-[300px] max-w-[500px] h-full border-r border-[#27272a] relative bg-[#121214] flex flex-col">
               {pdfData && <Toolbar clearCanvas={() => clearCanvasRef.current?.()} />}
               <MarginCanvas externalClearRef={clearCanvasRef} />
            </div>
            <div className="flex-1 h-full bg-[#18181b] relative overflow-hidden">
              <PdfViewer fileData={pdfData} />
            </div>
          </>
        )}
        
        {view === "history" && (
          <div className="flex-1 h-full overflow-hidden">
            <HistoryView />
          </div>
        )}

        {view === "settings" && (
          <div className="flex-1 h-full overflow-hidden">
            <SettingsView />
          </div>
        )}
      </main>
    </div>
  );
}

export default function MainComponent() {
  return (
    <SessionProvider>
      <ToolProvider>
        <AppContent />
      </ToolProvider>
    </SessionProvider>
  );
}