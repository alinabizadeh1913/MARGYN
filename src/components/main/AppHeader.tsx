"use client";

import React from "react";
import {
  Play,
  Square,
  Settings,
  Library,
  BookOpen,
  FileText,
  FolderOpen,
  Activity,
  Lock,
  CheckCircle2,
  Download,
  Upload,
  Save,
  Clock,
  FilePlus,
  RotateCcw,
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
  handleCreateBlankDocument: () => void;
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
  handleCreateBlankDocument,
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
  return (
    <header className="h-16 flex items-center justify-between px-4 border-b border-white/5 bg-black/40 backdrop-blur-2xl shrink-0 z-[100] shadow-[0_4px_30px_rgba(0,0,0,0.5)] gap-2">
      {/* بخش سمت چپ: نویگیشن و تولبار */}
      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5 shrink-0 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setView("reader")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-300 ${view === "reader" ? "bg-[#27272a] text-white shadow-[0_2px_10px_rgba(0,0,0,0.5)] border border-white/10" : "text-[#a1a1aa] hover:text-white hover:bg-white/5"}`}
          >
            <BookOpen size={15} />
            <span className="hidden 2xl:inline">
              <Typography variant="button">Reader</Typography>
            </span>
          </button>
          <button
            onClick={() => setView("library")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-300 ${view === "library" ? "bg-[#27272a] text-white shadow-[0_2px_10px_rgba(0,0,0,0.5)] border border-white/10" : "text-[#a1a1aa] hover:text-white hover:bg-white/5"}`}
          >
            <FolderOpen size={15} />
            <span className="hidden 2xl:inline">
              <Typography variant="button">Library</Typography>
            </span>
          </button>
          <button
            onClick={() => setView("history")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-300 ${view === "history" ? "bg-[#27272a] text-white shadow-[0_2px_10px_rgba(0,0,0,0.5)] border border-white/10" : "text-[#a1a1aa] hover:text-white hover:bg-white/5"}`}
          >
            <Library size={15} />
            <span className="hidden 2xl:inline">
              <Typography variant="button">History</Typography>
            </span>
          </button>
          <button
            onClick={() => setView("settings")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-300 ${view === "settings" ? "bg-[#27272a] text-white shadow-[0_2px_10px_rgba(0,0,0,0.5)] border border-white/10" : "text-[#a1a1aa] hover:text-white hover:bg-white/5"}`}
          >
            <Settings size={15} />
            <span className="hidden 2xl:inline">
              <Typography variant="button">Settings</Typography>
            </span>
          </button>
        </div>

        {view === "reader" && pdfData && (
          <div className="flex items-center animate-in fade-in slide-in-from-left-4 duration-300 border-l border-white/10 pl-2 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
            <Toolbar
              onClearCurrentPage={handleClearCurrentPage}
              onClearAllPages={handleClearAllPages}
              hasText={hasText}
            />
          </div>
        )}
      </div>

      {/* بخش سمت راست: اکشن‌ها */}
      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
        {view === "reader" && (
          <>
            <button
              onClick={handleCreateBlankDocument}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#38bdf8] hover:text-white hover:bg-[#38bdf8]/20 transition-all duration-300 text-xs font-medium border border-transparent hover:border-[#38bdf8]/30 shrink-0"
            >
              <FilePlus size={15} />
              <span className="hidden xl:inline">New Blank</span>
            </button>

            <button
              onClick={handleOpenPdf}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-white/10 transition-all duration-300 text-xs font-medium border border-transparent hover:border-white/10 shrink-0"
            >
              <FileText size={15} />
              <span className="hidden xl:inline">Open PDF</span>
            </button>
          </>
        )}

        {view === "reader" && pdfData && (
          <>
            <button
              onClick={handleImportProject}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#38bdf8] hover:text-white hover:bg-[#38bdf8]/20 transition-all duration-300 text-xs font-medium border border-[#38bdf8]/30 shrink-0"
            >
              <Download size={15} />
              <span className="hidden xl:inline">Import</span>
            </button>

            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#38bdf8] hover:text-white hover:bg-[#38bdf8]/20 transition-all duration-300 text-xs font-medium border border-[#38bdf8]/30 shrink-0"
            >
              <Upload size={15} />
              <span className="hidden xl:inline">Export</span>
            </button>

            {activeProjectPath && (
              <button
                onClick={handleSaveProject}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-300 text-xs font-medium border shrink-0 ${isDirty ? "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]" : "text-[#52525b] border-transparent cursor-default"}`}
                disabled={!isDirty}
              >
                <Save size={15} className={isDirty ? "animate-pulse" : ""} />
                <span className="hidden xl:inline">Save</span>
              </button>
            )}

            <div className="w-px h-6 bg-white/10 mx-0.5 shrink-0" />

            {activeTab?.isBlank ? (
              <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#18181b] text-[#52525b] border border-[#27272a] cursor-not-allowed shrink-0">
                <Lock size={14} />
                <span className="hidden xl:inline">
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
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#38bdf8] hover:bg-[#38bdf8]/10 transition-all text-xs font-medium shrink-0"
                          title="Set focus timer"
                        >
                          <Clock size={15} />
                          <span className="hidden xl:inline">Timer</span>
                        </button>
                      )
                    )
                  ) : (
                    <button
                      disabled
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[#52525b] border border-[#27272a] cursor-not-allowed opacity-60 text-xs font-medium shrink-0"
                      title="Focus session is active in another file"
                    >
                      <Clock size={15} />
                      <span className="hidden xl:inline">Timer</span>
                    </button>
                  )
                ) : null}

                {isSessionSyncing ? (
                  <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#18181b] text-[#52525b] border border-[#27272a] cursor-wait shrink-0">
                    <div className="w-3.5 h-3.5 border-2 border-[#52525b] border-t-transparent rounded-full animate-spin" />
                    <span className="hidden xl:inline">
                      <Typography variant="button">Checking...</Typography>
                    </span>
                  </div>
                ) : isCurrentPdfCompleted ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#18181b] text-[#52525b] border border-[#27272a] cursor-not-allowed">
                      <CheckCircle2 size={14} />
                      <span className="hidden xl:inline">
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
                    className={`group relative flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-all duration-500 overflow-hidden shrink-0 ${isActive ? "bg-rose-500/10 text-rose-400 border border-rose-500/30" : showResumeButton ? "bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:border-amber-400" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:border-emerald-400"}`}
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
                        <span className="hidden xl:inline relative z-10">
                          <Typography variant="button">End Session</Typography>
                        </span>
                      </>
                    ) : showResumeButton ? (
                      <>
                        <Activity size={13} className="relative z-10" />
                        <span className="hidden xl:inline relative z-10">
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
                        <span className="hidden xl:inline relative z-10">
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
