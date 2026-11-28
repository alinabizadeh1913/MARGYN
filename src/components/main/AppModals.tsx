"use client";

import React from "react";
import {
  Square,
  Lock,
  AlertTriangle,
  Trophy,
  Clock,
  Upload,
  FileDown,
  FileArchive,
  ChevronRight,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trash2,
  FilePlus,
  FileText,
  Move,
} from "lucide-react";
import Typography from "@/typography";
import { REQUIRED_END_PHRASE, REQUIRED_RESET_PHRASE } from "./constants";

interface AppModalsProps {
  showEndModal: boolean;
  setShowEndModal: (v: boolean) => void;
  showBackwardErrorModal: boolean;
  setShowBackwardErrorModal: (v: boolean) => void;
  startPage: number | null;
  showCongratsModal: boolean;
  setShowCongratsModal: (v: boolean) => void;
  activeFileName: string;
  showCloseModal: boolean;
  handleModalSave: () => void;
  handleModalDiscard: () => void;
  handleModalCancel: () => void;
  showTimerModal: boolean;
  setShowTimerModal: (v: boolean) => void;
  timerInput: string;
  setTimerInput: (v: string) => void;
  handleConfirmStartTimer: () => void;
  showExportModal: boolean;
  setShowExportModal: (v: boolean) => void;
  handleExportPdf: () => void;
  handleExportMargyn: () => void;
  exportingType: "pdf" | "margyn" | null;
  toast: { message: string; type: "success" | "error" } | null;
  endText: string;
  setEndText: (v: string) => void;
  endError: boolean;
  setEndError: (v: boolean) => void;
  endInputRef: React.RefObject<HTMLInputElement | null>;
  handleConfirmEndSession: () => void;
  showResetProgressModal: boolean;
  setShowResetProgressModal: (v: boolean) => void;
  resetProgressText: string;
  setResetProgressText: (v: string) => void;
  resetProgressError: boolean;
  setResetProgressError: (v: boolean) => void;
  resetProgressInputRef: React.RefObject<HTMLInputElement | null>;
  handleConfirmResetProgress: () => void;
  // ✅ پراپ‌های جدید برای مدال ساخت سند جدید
  showNewDocumentModal: boolean;
  setShowNewDocumentModal: (v: boolean) => void;
  handleCreateBlankDocument: (mode: "page" | "infinite") => void;
  showClearAllModal: boolean;
  setShowClearAllModal: (v: boolean) => void;
  handleConfirmClearAll: () => void;
}

export const AppModals: React.FC<AppModalsProps> = ({
  showEndModal,
  setShowEndModal,
  showBackwardErrorModal,
  setShowBackwardErrorModal,
  startPage,
  showCongratsModal,
  setShowCongratsModal,
  activeFileName,
  showCloseModal,
  handleModalSave,
  handleModalDiscard,
  handleModalCancel,
  showTimerModal,
  setShowTimerModal,
  timerInput,
  setTimerInput,
  handleConfirmStartTimer,
  showExportModal,
  setShowExportModal,
  handleExportPdf,
  handleExportMargyn,
  exportingType,
  toast,
  endText,
  setEndText,
  endError,
  setEndError,
  endInputRef,
  handleConfirmEndSession,
  showResetProgressModal,
  setShowResetProgressModal,
  resetProgressText,
  setResetProgressText,
  resetProgressError,
  setResetProgressError,
  resetProgressInputRef,
  handleConfirmResetProgress,
  showNewDocumentModal,
  setShowNewDocumentModal,
  handleCreateBlankDocument,
  showClearAllModal,
  setShowClearAllModal,
  handleConfirmClearAll,
}) => {
  return (
    <>
      {/* ✅ NEW: مدال ساخت سند جدید */}
      {showNewDocumentModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 transition-all duration-300">
          <div className="bg-nm-panel border border-nm-accent/30 p-8 rounded-3xl shadow-nm-float w-full max-w-md flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-nm-accent/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <FilePlus size={32} className="text-nm-accent" />
            </div>
            <Typography
              variant="pageTitle"
              as="h2"
              className="text-nm-text mb-2 font-semibold tracking-tight"
            >
              Create New Document
            </Typography>
            <Typography
              variant="body"
              as="p"
              className="text-nm-muted mb-8 text-center leading-relaxed"
            >
              Choose the type of workspace you want to start with.
            </Typography>

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={() => {
                  handleCreateBlankDocument("page");
                  setShowNewDocumentModal(false);
                }}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-nm-raise border border-nm-edge hover:bg-nm-line hover:border-rose-500/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                    <FileText
                      size={20}
                      className="text-rose-400 group-hover:scale-110 transition-transform"
                    />
                  </div>
                  <div className="flex flex-col text-left gap-1">
                    <Typography variant="cardTitle" className="text-nm-text">
                      Regular Page
                    </Typography>
                    <Typography variant="caption" className="text-nm-muted">
                      Single blank A4 page
                    </Typography>
                  </div>
                </div>
                <ChevronRight
                  size={18}
                  className="text-nm-dim group-hover:text-rose-400 transition-colors"
                />
              </button>

              <button
                onClick={() => {
                  handleCreateBlankDocument("infinite");
                  setShowNewDocumentModal(false);
                }}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-nm-raise border border-nm-edge hover:bg-nm-line hover:border-nm-ember/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-nm-ember/10 flex items-center justify-center shrink-0">
                    <Move
                      size={20}
                      className="text-nm-ember group-hover:scale-110 transition-transform"
                    />
                  </div>
                  <div className="flex flex-col text-left gap-1">
                    <Typography variant="cardTitle" className="text-nm-text">
                      Infinite Canvas
                    </Typography>
                    <Typography variant="caption" className="text-nm-muted">
                      Pan and draw anywhere
                    </Typography>
                  </div>
                </div>
                <ChevronRight
                  size={18}
                  className="text-nm-dim group-hover:text-nm-ember transition-colors"
                />
              </button>
            </div>

            <button
              onClick={() => setShowNewDocumentModal(false)}
              className="w-full mt-6 px-4 py-3.5 rounded-xl bg-nm-raise text-nm-muted hover:text-nm-text hover:bg-nm-line border border-nm-edge transition-all font-medium active:scale-[0.98]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showEndModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 transition-all duration-300">
          <div className="bg-nm-panel border border-rose-500/30 p-8 rounded-3xl shadow-nm-float w-full max-w-lg flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <Square size={32} className="text-rose-500" />
            </div>
            <Typography
              variant="pageTitle"
              as="h2"
              className="text-nm-text mb-2 font-semibold tracking-tight"
            >
              End Focus Session?
            </Typography>
            <Typography
              variant="body"
              as="p"
              className="text-nm-muted mb-8 max-w-sm leading-relaxed"
            >
              You are about to end your focus session. Your reading stats will
              be locked and revealed in 7 days.
              <br />
              <br />
              To confirm, type the following phrase in{" "}
              <strong>ALL CAPITAL LETTERS</strong>:
            </Typography>
            <div className="w-full bg-nm-deep border border-nm-edge rounded-2xl p-4 mb-6 flex items-center justify-center gap-3 select-none">
              <Lock size={16} className="text-nm-dim" />
              <span className="text-nm-text font-mono text-base font-bold tracking-widest">
                {REQUIRED_END_PHRASE}
              </span>
            </div>
            <input
              ref={endInputRef}
              type="text"
              value={endText}
              onChange={(e) => {
                setEndText(e.target.value);
                setEndError(false);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") handleConfirmEndSession();
              }}
              onPaste={(e) => e.preventDefault()}
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
              autoComplete="off"
              spellCheck="false"
              placeholder="TYPE HERE (UPPERCASE ONLY)"
              autoFocus
              className={`w-full px-5 py-4 rounded-xl bg-nm-raise border-2 outline-none transition-all text-center text-lg font-mono tracking-widest shadow-sm ${endError ? "border-rose-400 focus:border-rose-500 text-rose-600 placeholder-rose-300 animate-shake" : "border-nm-edge focus:border-rose-500/50 text-nm-text"}`}
            />
            {endError && (
              <Typography
                variant="caption"
                className="text-rose-500 mt-3 font-medium animate-pulse"
              >
                Incorrect. You must type it exactly as shown.
              </Typography>
            )}
            <div className="flex gap-4 w-full mt-8">
              <button
                onClick={() => setShowEndModal(false)}
                className="flex-1 px-4 py-3.5 rounded-xl bg-nm-raise text-nm-muted hover:text-nm-text hover:bg-nm-line border border-nm-edge transition-all font-medium active:scale-[0.98]"
              >
                Keep Focusing
              </button>
              <button
                onClick={handleConfirmEndSession}
                className="flex-1 px-4 py-3.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-all font-medium shadow-nm-glow active:scale-[0.98]"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}

      {showBackwardErrorModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 transition-all duration-300">
          <div className="bg-nm-panel border border-amber-500/30 p-8 rounded-3xl shadow-nm-float w-full max-w-md flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <AlertTriangle size={32} className="text-amber-500" />
            </div>
            <Typography
              variant="pageTitle"
              as="h2"
              className="text-nm-text mb-2 font-semibold tracking-tight"
            >
              Cannot End Session
            </Typography>
            <Typography
              variant="body"
              as="p"
              className="text-nm-muted mb-8 leading-relaxed"
            >
              You have navigated behind your session's active reading area. To
              ensure your progress is recorded correctly, please return to the{" "}
              <strong>last active page or advance further</strong> before ending
              the session.
            </Typography>
            <button
              onClick={() => setShowBackwardErrorModal(false)}
              className="w-full px-4 py-3.5 rounded-xl bg-amber-500 text-black hover:bg-amber-400 transition-all font-medium shadow-nm-glow-warn active:scale-[0.98]"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {showCongratsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 transition-all duration-500">
          <div className="bg-nm-panel border border-emerald-500/30 p-10 rounded-3xl shadow-nm-glow-ok w-full max-w-lg flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 relative">
              <div className="absolute inset-0 bg-emerald-500/15 rounded-full" />
              <Trophy size={48} className="text-emerald-500 relative z-10" />
            </div>
            <Typography
              variant="pageTitle"
              as="h2"
              className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-nm-accent mb-2 font-bold tracking-tight text-3xl"
            >
              Congratulations!
            </Typography>
            <Typography
              variant="bodyMedium"
              as="p"
              className="text-nm-text mb-2"
            >
              You have successfully completed:
            </Typography>
            <div className="w-full bg-nm-deep border border-emerald-500/20 rounded-2xl p-4 mb-8">
              <Typography
                variant="cardTitle"
                className="text-nm-text truncate px-4"
              >
                {activeFileName || "Your Document"}
              </Typography>
            </div>
            <Typography
              variant="body"
              as="p"
              className="text-nm-muted mb-8 max-w-sm leading-relaxed"
            >
              That's another step forward in your journey. Your focus and
              dedication are paying off. Take a moment to appreciate your
              progress!
            </Typography>
            <button
              onClick={() => setShowCongratsModal(false)}
              className="w-full px-4 py-3.5 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all font-medium shadow-nm-glow-ok active:scale-[0.98]"
            >
              Awesome!
            </button>
          </div>
        </div>
      )}

      {showCloseModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 transition-all duration-300">
          <div className="bg-nm-panel border border-amber-500/30 p-8 rounded-3xl shadow-nm-float w-full max-w-md flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <AlertTriangle size={32} className="text-amber-500" />
            </div>
            <Typography
              variant="pageTitle"
              as="h2"
              className="text-nm-text mb-2 font-semibold tracking-tight"
            >
              Unsaved Changes
            </Typography>
            <Typography
              variant="body"
              as="p"
              className="text-nm-muted mb-8 leading-relaxed"
            >
              You have unsaved changes in your current project. Do you want to
              save your progress before leaving?
            </Typography>
            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={handleModalSave}
                className="w-full px-4 py-3 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all font-medium shadow-nm-glow-ok active:scale-[0.98]"
              >
                Yes, Save
              </button>
              <button
                onClick={handleModalDiscard}
                className="w-full px-4 py-3 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all font-medium active:scale-[0.98]"
              >
                No, Don't Save
              </button>
              <button
                onClick={handleModalCancel}
                className="w-full px-4 py-3 rounded-xl bg-nm-raise text-nm-muted hover:text-nm-text hover:bg-nm-line border border-nm-edge transition-all font-medium active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showTimerModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 transition-all duration-300">
          <div className="bg-nm-panel border border-nm-accent/30 p-8 rounded-3xl shadow-nm-float w-full max-w-sm flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-nm-accent/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <Clock size={32} className="text-nm-accent" />
            </div>
            <Typography
              variant="pageTitle"
              as="h2"
              className="text-nm-text mb-2 font-semibold tracking-tight"
            >
              Set Focus Timer
            </Typography>
            <Typography
              variant="body"
              as="p"
              className="text-nm-muted mb-8 leading-relaxed"
            >
              Enter the duration in minutes.
            </Typography>
            <div className="w-full flex items-center bg-nm-raise border-2 border-nm-edge focus-within:border-nm-accent/50 rounded-xl transition-all shadow-sm overflow-hidden mb-8">
              <input
                type="number"
                value={timerInput}
                onChange={(e) => setTimerInput(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") handleConfirmStartTimer();
                  if (e.key === "Escape") setShowTimerModal(false);
                }}
                autoFocus
                className="flex-1 w-full px-5 py-4 bg-transparent outline-none text-center text-xl font-mono tracking-widest text-nm-text [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="pr-5 text-nm-dim font-medium">min</span>
            </div>
            <div className="flex gap-4 w-full">
              <button
                onClick={() => setShowTimerModal(false)}
                className="flex-1 px-4 py-3.5 rounded-xl bg-nm-raise text-nm-muted hover:text-nm-text hover:bg-nm-line border border-nm-edge transition-all font-medium active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStartTimer}
                className="flex-1 px-4 py-3.5 rounded-xl bg-nm-accent text-white hover:bg-nm-accent/90 transition-all font-medium shadow-nm-glow active:scale-[0.98]"
              >
                Start
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 transition-all duration-300">
          <div className="bg-nm-panel border border-nm-accent/30 p-8 rounded-3xl shadow-nm-float w-full max-w-md flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-nm-accent/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <Upload size={32} className="text-nm-accent" />
            </div>
            <Typography
              variant="pageTitle"
              as="h2"
              className="text-nm-text mb-2 font-semibold tracking-tight"
            >
              Export Document
            </Typography>
            <Typography
              variant="body"
              as="p"
              className="text-nm-muted mb-8 leading-relaxed"
            >
              Choose a format to save your work.
            </Typography>

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={handleExportPdf}
                disabled={exportingType !== null}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-nm-raise border border-nm-edge hover:bg-nm-line hover:border-nm-accent/50 transition-all group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                    <FileDown size={20} className="text-rose-400" />
                  </div>
                  <div className="flex flex-col text-left gap-1">
                    <Typography variant="cardTitle" className="text-nm-text">
                      PDF Document
                    </Typography>
                    <Typography variant="caption" className="text-nm-muted">
                      Flat PDF with all annotations
                    </Typography>
                  </div>
                </div>
                {exportingType === "pdf" ? (
                  <div className="w-5 h-5 border-2 border-nm-accent border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <ChevronRight
                    size={20}
                    className="text-nm-dim group-hover:text-nm-accent transition-colors shrink-0"
                  />
                )}
              </button>

              <button
                onClick={handleExportMargyn}
                disabled={exportingType !== null}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-nm-raise border border-nm-edge hover:bg-nm-line hover:border-nm-accent/50 transition-all group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <FileArchive size={20} className="text-emerald-400" />
                  </div>
                  <div className="flex flex-col text-left gap-1">
                    <Typography variant="cardTitle" className="text-nm-text">
                      Margyn Project
                    </Typography>
                    <Typography variant="caption" className="text-nm-muted">
                      Editable project (.margyn)
                    </Typography>
                  </div>
                </div>
                {exportingType === "margyn" ? (
                  <div className="w-5 h-5 border-2 border-nm-accent border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <ChevronRight
                    size={20}
                    className="text-nm-dim group-hover:text-nm-accent transition-colors shrink-0"
                  />
                )}
              </button>
            </div>

            <button
              onClick={() => setShowExportModal(false)}
              disabled={exportingType !== null}
              className="w-full mt-4 px-4 py-3 rounded-xl bg-transparent text-nm-muted hover:text-nm-text hover:bg-nm-line transition-all font-medium disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showResetProgressModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 transition-all duration-300">
          <div className="bg-nm-panel border border-rose-500/30 p-8 rounded-3xl shadow-nm-float w-full max-w-lg flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <RotateCcw size={32} className="text-rose-500" />
            </div>
            <Typography
              variant="pageTitle"
              as="h2"
              className="text-nm-text mb-2 font-semibold tracking-tight"
            >
              Reset Document Progress?
            </Typography>
            <Typography
              variant="body"
              as="p"
              className="text-nm-muted mb-8 max-w-sm leading-relaxed"
            >
              This will permanently delete <strong>ALL</strong> focus sessions
              for this document and reset its status to unread. You will be able
              to start from scratch.
              <br />
              <br />
              To confirm, type the following phrase in{" "}
              <strong>ALL CAPITAL LETTERS</strong>:
            </Typography>
            <div className="w-full bg-nm-deep border border-nm-edge rounded-2xl p-4 mb-6 flex items-center justify-center gap-3 select-none">
              <Lock size={16} className="text-nm-dim" />
              <span className="text-nm-text font-mono text-base font-bold tracking-widest">
                {REQUIRED_RESET_PHRASE}
              </span>
            </div>
            <input
              ref={resetProgressInputRef}
              type="text"
              value={resetProgressText}
              onChange={(e) => {
                setResetProgressText(e.target.value);
                setResetProgressError(false);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") handleConfirmResetProgress();
              }}
              onPaste={(e) => e.preventDefault()}
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
              autoComplete="off"
              spellCheck="false"
              placeholder="TYPE HERE (UPPERCASE ONLY)"
              autoFocus
              className={`w-full px-5 py-4 rounded-xl bg-nm-raise border-2 outline-none transition-all text-center text-lg font-mono tracking-widest shadow-sm ${resetProgressError ? "border-rose-400 focus:border-rose-500 text-rose-600 placeholder-rose-300 animate-shake" : "border-nm-edge focus:border-rose-500/50 text-nm-text"}`}
            />
            {resetProgressError && (
              <Typography
                variant="caption"
                className="text-rose-500 mt-3 font-medium animate-pulse"
              >
                Incorrect. You must type it exactly as shown.
              </Typography>
            )}
            <div className="flex gap-4 w-full mt-8">
              <button
                onClick={() => setShowResetProgressModal(false)}
                className="flex-1 px-4 py-3.5 rounded-xl bg-nm-raise text-nm-muted hover:text-nm-text hover:bg-nm-line border border-nm-edge transition-all font-medium active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResetProgress}
                className="flex-1 px-4 py-3.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-all font-medium shadow-nm-glow active:scale-[0.98]"
              >
                Reset Progress
              </button>
            </div>
          </div>
        </div>
      )}

      {showClearAllModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 transition-all duration-300"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            className="bg-nm-panel border border-rose-500/30 p-8 rounded-3xl shadow-nm-float w-full max-w-md flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <Trash2 size={32} className="text-rose-500" />
            </div>
            <Typography
              variant="pageTitle"
              as="h2"
              className="text-nm-text mb-2 font-semibold tracking-tight"
            >
              Clear All Pages?
            </Typography>
            <Typography
              variant="body"
              as="p"
              className="text-nm-muted mb-8 leading-relaxed"
            >
              Every drawing on <strong>all pages</strong> of this document will
              be erased. You can bring it back right after with{" "}
              <strong>Ctrl+Z</strong>.
            </Typography>
            <div className="flex gap-4 w-full">
              <button
                autoFocus
                onClick={() => setShowClearAllModal(false)}
                className="flex-1 px-4 py-3.5 rounded-xl bg-nm-raise text-nm-muted hover:text-nm-text hover:bg-nm-line border border-nm-edge transition-all font-medium active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClearAll}
                className="flex-1 px-4 py-3.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-all font-medium shadow-nm-glow active:scale-[0.98]"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-8 right-8 z-[200] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div
            className={`flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border ${toast.type === "success" ? "bg-nm-panel border-emerald-500/30 text-emerald-400 shadow-nm-glow-ok" : "bg-nm-panel border-rose-500/30 text-rose-400 shadow-nm-glow"}`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 size={24} className="shrink-0" />
            ) : (
              <XCircle size={24} className="shrink-0" />
            )}
            <Typography
              variant="bodyMedium"
              className="text-nm-text font-medium"
            >
              {toast.message}
            </Typography>
          </div>
        </div>
      )}
    </>
  );
};
