"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { OpenTab } from "../TabsBar";
import MarginCanvas from "../reader/MarginCanvas";
import PdfViewer from "../reader/PdfViewer";
import BlankPageViewer from "../reader/BlankPageViewer";
import InfiniteCanvasViewer from "../reader/InfiniteCanvasViewer"; // ✅ NEW
import LibraryView from "../LibraryView";
import HistoryView from "../HistoryView";
import SettingsView from "../SettingsView";
import SplitView from "../reader/SplitView";
import { PaneScope } from "../reader/PaneContext";

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
  onOpenNote: () => void;
  // ── split view ──
  splitTabs: OpenTab[];
  splitSizes: number[];
  onSplitSizesChange: (sizes: number[]) => void;
  onFocusPane: (id: string) => void;
  onPaneScaleChange: (tabId: string, filePath: string, scale: number) => void;
  onPaneCanvasBgChange: (tabId: string, filePath: string, color: string) => void;
  onPaneDocumentLoad: (tabId: string, pages: number) => void;
  onPaneBlankPageAdded: (tabId: string, total: number) => void;
  getSavedPage: (filePath: string) => number | undefined;
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
  onOpenNote,
  splitTabs,
  splitSizes,
  onSplitSizesChange,
  onFocusPane,
  onPaneScaleChange,
  onPaneCanvasBgChange,
  onPaneDocumentLoad,
  onPaneBlankPageAdded,
  getSavedPage,
}) => {
  const isSplit = view === "reader" && splitTabs.length > 1;

  const renderPane = (tab: OpenTab) => {
    const focused = tab.id === activeTabId;
    return (
      <PaneScope
        focused={focused}
        filePath={tab.filePath}
        getSavedPage={getSavedPage}
      >
        {tab.isInfinite ? (
          <InfiniteCanvasViewer
            filePath={tab.filePath}
            canvasBg={tab.canvasBg}
            onCanvasBgChange={(c) =>
              onPaneCanvasBgChange(tab.id, tab.filePath, c)
            }
            initialScale={tab.scale}
            onScaleChange={(s) => onPaneScaleChange(tab.id, tab.filePath, s)}
          />
        ) : tab.isBlank ? (
          <BlankPageViewer
            filePath={tab.filePath}
            initialPages={tab.totalPages || 1}
            canvasBg={tab.canvasBg}
            onCanvasBgChange={(c) =>
              onPaneCanvasBgChange(tab.id, tab.filePath, c)
            }
            initialScale={tab.scale}
            onScaleChange={(s) => onPaneScaleChange(tab.id, tab.filePath, s)}
            onPageAdded={(n: number) => onPaneBlankPageAdded(tab.id, n)}
            onDeletePage={handleDeleteBlankPage}
            onOpenNote={onOpenNote}
          />
        ) : (
          <PdfViewer
            fileData={tab.pdfData}
            filePath={tab.filePath}
            initialScale={tab.scale}
            canvasBg={tab.canvasBg}
            onCanvasBgChange={(c) =>
              onPaneCanvasBgChange(tab.id, tab.filePath, c)
            }
            onScaleChange={(s) => onPaneScaleChange(tab.id, tab.filePath, s)}
            onTextLayerStatus={focused ? setHasText : undefined}
            onDocumentLoad={(pages) => onPaneDocumentLoad(tab.id, pages)}
            onDropPdf={handleDropPdf}
            onOpenPdf={handleOpenPdf}
            onOpenNote={onOpenNote}
            isCompleted={tab.isCompleted}
          />
        )}
      </PaneScope>
    );
  };

  return (
    <main className="flex-1 flex overflow-hidden relative">
      {view === "reader" && (
        <>
          {pdfData && !activeTab?.isBlank && (
            <>
              <div
                className={`h-full border-r border-nm-edge relative bg-nm-deep flex flex-col shrink-0 ${isMarginOpen ? "w-[40%]" : "w-0 border-r-0"}`}
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
                className="absolute top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-5 h-16 bg-nm-panel border-y border-r border-nm-edge-strong text-nm-dim hover:text-nm-hot hover:bg-nm-raise rounded-r-lg transition-colors duration-200 group"
                style={{ left: isMarginOpen ? "calc(40% - 1px)" : "0px" }}
              >
                {isMarginOpen ? (
                  <ChevronLeft
                    size={18}
                    className="group-hover:-translate-x-0.5 transition-transform"
                  />
                ) : (
                  <ChevronRight
                    size={18}
                    className="group-hover:translate-x-0.5 transition-transform"
                  />
                )}
              </button>
            </>
          )}

          <div className="flex-1 h-full min-w-0 relative overflow-hidden flex items-center justify-center">
            {isSplit ? (
              <SplitView
                panes={splitTabs.map((t) => ({
                  id: t.id,
                  node: renderPane(t),
                }))}
                sizes={splitSizes}
                activeId={activeTabId}
                onSizesChange={onSplitSizesChange}
                onFocusPane={onFocusPane}
              />
            ) : activeTab?.isInfinite ? (
              <InfiniteCanvasViewer
                key={activeTabId || "empty"}
                filePath={activeFilePath}
                canvasBg={activeCanvasBg}
                onCanvasBgChange={handleCanvasBgChange}
                initialScale={activeScale}
                onScaleChange={handleScaleChange}
              />
            ) : activeTab?.isBlank ? (
              <BlankPageViewer
                filePath={activeFilePath}
                initialPages={totalPages}
                canvasBg={activeCanvasBg}
                onCanvasBgChange={handleCanvasBgChange}
                initialScale={activeScale}
                onScaleChange={handleScaleChange}
                onPageAdded={(newTotal: number) => {
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
                onOpenNote={onOpenNote}
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
                onOpenNote={onOpenNote}
                isCompleted={activeTab?.isCompleted}
              />
            )}
          </div>
        </>
      )}

      {view === "library" && (
        <div className="flex-1 h-full overflow-hidden bg-nm-deep">
          <LibraryView
            onSelectFile={handleSelectLibraryFile}
            onImportProject={handleImportProject}
          />
        </div>
      )}

      {view === "history" && (
        <div className="flex-1 h-full overflow-hidden bg-nm-deep">
          <HistoryView
            filePath={activeFilePath}
            fileName={activeFileName}
            onSessionDeleted={() => syncSessionWithFile(activeFilePath)}
          />
        </div>
      )}
      {view === "settings" && (
        <div className="flex-1 h-full overflow-hidden bg-nm-deep">
          <SettingsView />
        </div>
      )}
    </main>
  );
};
