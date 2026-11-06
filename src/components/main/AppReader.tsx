"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { OpenTab } from "../TabsBar";
import MarginCanvas from "../reader/MarginCanvas";
import PdfViewer from "../reader/PdfViewer";
import BlankPageViewer from "../reader/BlankPageViewer";
import LibraryView from "../LibraryView";
import HistoryView from "../HistoryView";
import SettingsView from "../SettingsView";

interface AppReaderProps {
  view: "reader" | "library" | "history" | "settings";
  pdfData: Uint8Array | null;
  activeTab: OpenTab | undefined;
  isMarginOpen: boolean;
  setIsMarginOpen: (v: boolean) => void;
  activeFilePath: string;
  totalPages: number;
  activeCanvasBg: string;
  setTotalPages: (v: number) => void;
  setOpenTabs: React.Dispatch<React.SetStateAction<OpenTab[]>>;
  activeTabId: string | null;
  handleDeleteBlankPage: (page: number) => void;
  activeScale: number;
  handleCanvasBgChange: (color: string) => void;
  handleScaleChange: (scale: number) => void;
  setHasText: (v: boolean) => void;
  handleDropPdf: (file: File) => void;
  handleOpenPdf: () => void;
  activeFileName: string;
  syncSessionWithFile: (path: string) => void;
  handleSelectLibraryFile: (path: string) => void;
  handleImportProject: () => void;
  onOpenNote: () => void; // ✅ اضافه شد
}

export const AppReader: React.FC<AppReaderProps> = ({
  view,
  pdfData,
  activeTab,
  isMarginOpen,
  setIsMarginOpen,
  activeFilePath,
  totalPages,
  activeCanvasBg,
  setTotalPages,
  setOpenTabs,
  activeTabId,
  handleDeleteBlankPage,
  activeScale,
  handleCanvasBgChange,
  handleScaleChange,
  setHasText,
  handleDropPdf,
  handleOpenPdf,
  activeFileName,
  syncSessionWithFile,
  handleSelectLibraryFile,
  handleImportProject,
  onOpenNote, // ✅ اضافه شد
}) => {
  return (
    <main className="flex-1 flex overflow-hidden relative">
      {view === "reader" && (
        <>
          {pdfData && !activeTab?.isBlank && (
            <>
              <div
                className={`h-full border-r border-white/5 relative bg-[#0c0c0e] flex flex-col shrink-0 ${isMarginOpen ? "w-[40%]" : "w-0 border-r-0"}`}
              >
                <div
                  className={`w-full h-full min-w-[300px] flex flex-col ${isMarginOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                >
                  <div className="flex-1 relative overflow-hidden">
                    <MarginCanvas filePath={activeFilePath} />
                  </div>
                </div>
              </div>

              <button
                onClick={() => setIsMarginOpen(!isMarginOpen)}
                className="absolute top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-7 h-20 bg-white border-y border-r border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-r-xl transition-colors shadow-sm"
                style={{ left: isMarginOpen ? "calc(40% - 1px)" : "0px" }}
              >
                {isMarginOpen ? (
                  <ChevronLeft size={16} />
                ) : (
                  <ChevronRight size={16} />
                )}
              </button>
            </>
          )}

          <div className="flex-1 h-full relative overflow-hidden flex items-center justify-center">
            {activeTab?.isBlank ? (
              <BlankPageViewer
                filePath={activeFilePath}
                initialPages={totalPages}
                canvasBg={activeCanvasBg}
                onPageAdded={(newTotal: number) => {
                  // ✅ تایپ newTotal مشخص شد
                  setTotalPages(newTotal);
                  if (activeTabId) {
                    setOpenTabs((prev) =>
                      prev.map((t) =>
                        t.id === activeTabId
                          ? { ...t, totalPages: newTotal }
                          : t,
                      ),
                    );
                  }
                }}
                onDeletePage={handleDeleteBlankPage}
                onOpenNote={onOpenNote} // ✅ پاس داده شد
              />
            ) : (
              <PdfViewer
                key={activeTabId || "empty"}
                fileData={pdfData}
                filePath={activeFilePath}
                initialScale={activeScale}
                canvasBg={activeCanvasBg}
                onCanvasBgChange={handleCanvasBgChange}
                onScaleChange={handleScaleChange}
                onTextLayerStatus={setHasText}
                onDocumentLoad={(pages) => {
                  setTotalPages(pages);
                  if (activeTabId) {
                    setOpenTabs((prev) =>
                      prev.map((t) =>
                        t.id === activeTabId ? { ...t, totalPages: pages } : t,
                      ),
                    );
                  }
                }}
                onDropPdf={handleDropPdf}
                onOpenPdf={handleOpenPdf}
                onOpenNote={onOpenNote} // ✅ پاس داده شد
              />
            )}
          </div>
        </>
      )}

      {view === "library" && (
        <div className="flex-1 h-full overflow-hidden bg-[#09090b]">
          <LibraryView
            onSelectFile={handleSelectLibraryFile}
            onImportProject={handleImportProject}
          />
        </div>
      )}

      {view === "history" && (
        <div className="flex-1 h-full overflow-hidden bg-[#09090b]">
          <HistoryView
            filePath={activeFilePath}
            fileName={activeFileName}
            onSessionDeleted={() => syncSessionWithFile(activeFilePath)}
          />
        </div>
      )}
      {view === "settings" && (
        <div className="flex-1 h-full overflow-hidden bg-[#09090b]">
          <SettingsView />
        </div>
      )}
    </main>
  );
};
