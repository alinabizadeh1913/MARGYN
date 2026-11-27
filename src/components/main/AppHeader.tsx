"use client";

import React from "react";
import {
  Play,
  Square,
  Settings,
  FileText,
  Activity,
  Lock,
  CheckCircle2,
  Download,
  Upload,
  Save,
  Clock,
  FilePlus,
  RotateCcw,
  Crown,
  Castle,
  ScrollText,
} from "lucide-react";
import Typography from "@/typography";
import Toolbar from "../reader/Toolbar";
import TimerDisplay from "../reader/TimerDisplay";
import { OpenTab } from "../TabsBar";

interface AppHeaderProps {
  view: "reader" | "library" | "history" | "settings";
  setView: (v: "reader" | "library" | "history" | "settings") => void;
  handleClearCurrentPage: () => void;
  handleClearAllPages: () => void;
  hasText: boolean;
  onOpenNewDocument: () => void; // ✅ تغییر یافت
  handleOpenPdf: () => void;
  handleImportProject: () => void;
  setShowExportModal: (v: boolean) => void;
  activeProjectPath: string | null;
  isDirty: boolean;
  handleSaveProject: () => void;
  activeTab: OpenTab | undefined;
  activeSessionFilePath: string | null;
  activeFilePath: string;
  timerEndsAt: number | null;
  isActive: boolean;
  isSessionSyncing: boolean;
  isCurrentPdfCompleted: boolean;
  showResumeButton: boolean;
  handleTryEndSession: () => void;
  handleStartTimer: () => void;
  pdfData: Uint8Array | null;
  handleResetProgress: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  view,
  setView,
  handleClearCurrentPage,
  handleClearAllPages,
  hasText,
  onOpenNewDocument,
  handleOpenPdf,
  handleImportProject,
  setShowExportModal,
  activeProjectPath,
  isDirty,
  handleSaveProject,
  activeTab,
  activeSessionFilePath,
  activeFilePath,
  timerEndsAt,
  isActive,
  isSessionSyncing,
  isCurrentPdfCompleted,
  showResumeButton,
  handleTryEndSession,
  handleStartTimer,
  pdfData,
  handleResetProgress,
}) => {
  const isInfinite = !!activeTab?.isInfinite;

  return (
    <header className="relative h-16 flex items-center justify-between px-4 bg-nm-deep shrink-0 z-[100] shadow-nm-float gap-2">
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-visible">
        <div className="flex items-center gap-1 bg-nm-deep p-1.5 rounded-2xl border border-transparent shadow-nm-inset-sm shrink-0 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setView("reader")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-300 ${view === "reader" ? "bg-nm-deep text-nm-hot border border-transparent shadow-nm-inset-sm" : "text-nm-muted hover:text-white hover:bg-white/5"}`}
          >
            <Crown size={16} />
            <span className="hidden min-[1700px]:inline">
              <Typography variant="button">Reader</Typography>
            </span>
          </button>
          <button
            onClick={() => setView("library")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-300 ${view === "library" ? "bg-nm-deep text-nm-hot border border-transparent shadow-nm-inset-sm" : "text-nm-muted hover:text-white hover:bg-white/5"}`}
          >
            <Castle size={16} />
            <span className="hidden min-[1700px]:inline">
              <Typography variant="button">Library</Typography>
            </span>
          </button>
          <button
            onClick={() => setView("history")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-300 ${view === "history" ? "bg-nm-deep text-nm-hot border border-transparent shadow-nm-inset-sm" : "text-nm-muted hover:text-white hover:bg-white/5"}`}
          >
            <ScrollText size={16} />
            <span className="hidden min-[1700px]:inline">
              <Typography variant="button">History</Typography>
            </span>
          </button>
          <button
            onClick={() => setView("settings")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-300 ${view === "settings" ? "bg-nm-deep text-nm-hot border border-transparent shadow-nm-inset-sm" : "text-nm-muted hover:text-white hover:bg-white/5"}`}
          >
            <Settings size={16} />
            <span className="hidden min-[1700px]:inline">
              <Typography variant="button">Settings</Typography>
            </span>
          </button>
        </div>

        {view === "reader" && pdfData && (
          <div className="flex items-center animate-in fade-in slide-in-from-left-4 duration-300 border-l border-nm-edge pl-2 flex-1 min-w-0 overflow-visible">
            <Toolbar
              onClearCurrentPage={handleClearCurrentPage}
              onClearAllPages={handleClearAllPages}
              hasText={hasText}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
        {view === "reader" && (
          <>
            {/* ✅ دکمه New Blank اکنون مدال را باز می‌کند */}
            <button
              onClick={onOpenNewDocument}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-nm-accent hover:text-white hover:bg-nm-accent/20 transition-all duration-300 text-xs font-medium border border-transparent hover:border-nm-accent/30 shrink-0"
            >
              <FilePlus size={15} />
              <span className="hidden min-[1700px]:inline">New Blank</span>
            </button>

            <button
              onClick={handleOpenPdf}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-nm-muted hover:text-white hover:bg-white/10 transition-all duration-300 text-xs font-medium border border-transparent hover:border-nm-edge shrink-0"
            >
              <FileText size={15} />
              <span className="hidden min-[1700px]:inline">Open PDF</span>
            </button>
          </>
        )}

        {view === "reader" && pdfData && (
          <>
            {!isInfinite && (
              <>
                <button
                  onClick={handleImportProject}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-nm-accent hover:text-white hover:bg-nm-accent/20 transition-all duration-300 text-xs font-medium border border-nm-accent/30 shrink-0"
                >
                  <Download size={15} />
                  <span className="hidden min-[1700px]:inline">Import</span>
                </button>

                <button
                  onClick={() => setShowExportModal(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-nm-accent hover:text-white hover:bg-nm-accent/20 transition-all duration-300 text-xs font-medium border border-nm-accent/30 shrink-0"
                >
                  <Upload size={15} />
                  <span className="hidden min-[1700px]:inline">Export</span>
                </button>

                {activeProjectPath && (
                  <button
                    onClick={handleSaveProject}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-300 text-xs font-medium border shrink-0 ${isDirty ? "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 shadow-nm-glow-ok" : "text-nm-dim border-transparent cursor-default"}`}
                    disabled={!isDirty}
                  >
                    <Save
                      size={15}
                      className={isDirty ? "animate-pulse" : ""}
                    />
                    <span className="hidden min-[1700px]:inline">Save</span>
                  </button>
                )}
              </>
            )}

            <div className="w-px h-6 bg-white/10 mx-0.5 shrink-0" />

            {activeTab?.isBlank || isInfinite ? (
              <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-nm-raise text-nm-dim border border-nm-edge cursor-not-allowed shrink-0">
                <Lock size={14} />
                <span className="hidden min-[1700px]:inline">
                  <Typography variant="button">No Session</Typography>
                </span>
              </div>
            ) : (
              <>
                {activeSessionFilePath ? (
                  activeSessionFilePath === activeFilePath ? (
                    timerEndsAt ? (
                      <TimerDisplay />
                    ) : (
                      isActive &&
                      !isSessionSyncing && (
                        <button
                          onClick={handleStartTimer}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-nm-accent hover:bg-nm-accent/10 transition-all text-xs font-medium shrink-0"
                          title="Set focus timer"
                        >
                          <Clock size={15} />
                          <span className="hidden min-[1700px]:inline">Timer</span>
                        </button>
                      )
                    )
                  ) : (
                    <button
                      disabled
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-nm-dim border border-nm-edge cursor-not-allowed opacity-60 text-xs font-medium shrink-0"
                      title="Focus session is active in another file"
                    >
                      <Clock size={15} />
                      <span className="hidden min-[1700px]:inline">Timer</span>
                    </button>
                  )
                ) : null}

                {isSessionSyncing ? (
                  <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-nm-raise text-nm-dim border border-nm-edge cursor-wait shrink-0">
                    <div className="w-3.5 h-3.5 border-2 border-nm-dim border-t-transparent rounded-full animate-spin" />
                    <span className="hidden min-[1700px]:inline">
                      <Typography variant="button">Checking...</Typography>
                    </span>
                  </div>
                ) : isCurrentPdfCompleted ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-nm-raise text-nm-dim border border-nm-edge cursor-not-allowed">
                      <CheckCircle2 size={14} />
                      <span className="hidden min-[1700px]:inline">
                        <Typography variant="button">Completed</Typography>
                      </span>
                    </div>
                    <button
                      onClick={handleResetProgress}
                      className="flex items-center justify-center p-1.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 hover:text-rose-300 transition-all duration-300 shrink-0"
                      title="Reset Document Progress"
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleTryEndSession}
                    className={`group relative flex items-center gap-1.5 px-5 py-2 rounded-full transition-all duration-500 overflow-hidden shrink-0 ${isActive ? "bg-rose-500/10 text-rose-400 border border-rose-500/30" : showResumeButton ? "bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:border-amber-400" : "bg-gradient-to-b from-[#ff3b4a] to-[#c8102e] text-white border border-nm-hot/50 shadow-nm-glow hover:shadow-nm-glow hover:brightness-110"}`}
                  >
                    <div
                      className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md ${isActive ? "bg-rose-500/20" : showResumeButton ? "bg-amber-500/20" : "bg-emerald-500/20"}`}
                    />
                    {isActive ? (
                      <>
                        <Square
                          size={13}
                          fill="currentColor"
                          className="relative z-10"
                        />
                        <span className="hidden min-[1700px]:inline relative z-10">
                          <Typography variant="button">End Session</Typography>
                        </span>
                      </>
                    ) : showResumeButton ? (
                      <>
                        <Activity size={13} className="relative z-10" />
                        <span className="hidden min-[1700px]:inline relative z-10">
                          <Typography variant="button">
                            Resume Session
                          </Typography>
                        </span>
                      </>
                    ) : (
                      <>
                        <Play
                          size={13}
                          fill="currentColor"
                          className="relative z-10"
                        />
                        <span className="hidden min-[1700px]:inline relative z-10">
                          <Typography variant="button">
                            Start Session
                          </Typography>
                        </span>
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </header>
  );
};
