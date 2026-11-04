"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Shield,
  Trash2,
  Info,
  Volume2,
  Keyboard,
  RotateCcw,
  AlertTriangle,
  Lock,
  FolderOpen,
  RefreshCw,
} from "lucide-react";
import Typography from "@/typography";
import { resetDatabase, getSetting, setSetting } from "@/db";
import { useShortcuts, ShortcutAction } from "@/providers/ShortcutProvider";
import { setAudioEnabled } from "@/lib/audio";
import ShortcutInput from "./ShortcutInput";
import DevSessionInspector from "./DevSessionInspector";

const REQUIRED_RESET_PHRASE = "DELETE ALL MY DATA";

export default function SettingsView() {
  const { shortcuts, updateShortcut, resetShortcuts } = useShortcuts();
  const [audioEnabled, setAudioEnabledState] = useState(true);
  const [exportDir, setExportDir] = useState<string | null>(null);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetText, setResetText] = useState("");
  const [resetError, setResetError] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showResetModal) {
        setShowResetModal(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showResetModal]);

  useEffect(() => {
    const loadSettings = async () => {
      const savedAudio = await getSetting("audioEnabled");
      if (savedAudio !== null) {
        const isEnabled = savedAudio === "true";
        setAudioEnabledState(isEnabled);
        setAudioEnabled(isEnabled);
      }

      const savedDir = await getSetting("defaultExportDir");
      if (savedDir) setExportDir(savedDir);
    };
    loadSettings();
  }, []);

  useEffect(() => {
    if (showResetModal) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [showResetModal]);

  const toggleAudio = async () => {
    const newValue = !audioEnabled;
    setAudioEnabledState(newValue);
    setAudioEnabled(newValue);
    await setSetting("audioEnabled", newValue.toString());
  };

  const handleSelectExportDir = async () => {
    if (window.electronAPI) {
      const dir = await window.electronAPI.selectDirectory();
      if (dir) {
        setExportDir(dir);
        await setSetting("defaultExportDir", dir);
      }
    }
  };

  const handleReloadApp = () => {
    window.location.reload();
  };

  const handleOpenResetModal = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setShowResetModal(true);
    setResetText("");
    setResetError(false);
  };

  const handleConfirmReset = async () => {
    if (resetText === REQUIRED_RESET_PHRASE) {
      setIsResetting(true);
      try {
        await resetDatabase();
        if (window.electronAPI) {
          await window.electronAPI.clearActivePdf();
        }
        window.location.reload();
      } catch (error) {
        console.error("Failed to reset database:", error);
        setIsResetting(false);
      }
    } else {
      setResetError(true);
      setResetText("");
      inputRef.current?.focus();
    }
  };

  const shortcutLabels: Record<ShortcutAction, string> = {
    pen: "Select Pen Tool",
    eraser: "Select Eraser Tool",
    startSession: "Start Session",
    endSession: "End Session",
    openPdf: "Open PDF File",
    closePdf: "Close Current Tab",
    switchTab: "Switch Tab", // ✅ اضافه شد
    clearPage: "Clear Current Page Drawings",
    clearAll: "Clear All Pages Drawings",
    toggleMargin: "Toggle Margin Sidebar",
    saveProject: "Save Project",
    importProject: "Import Project",
    exportProject: "Export Project",
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] p-10 overflow-y-auto relative">
      <div className="max-w-4xl w-full mx-auto pb-20">
        <header className="mb-10">
          <Typography
            variant="pageTitle"
            as="h1"
            className="text-[#fafafa] mb-3"
          >
            Settings
          </Typography>
          <Typography variant="body" as="p" className="text-[#a1a1aa]">
            Manage your preferences and application data.
          </Typography>
        </header>

        <div className="space-y-6">
          <section className="bg-[#121214] border border-[#27272a] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Volume2 size={20} className="text-[#a1a1aa]" />
              <Typography
                variant="cardTitle"
                as="h2"
                className="text-[#fafafa]"
              >
                Preferences
              </Typography>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <Typography
                  variant="label"
                  as="span"
                  className="text-[#fafafa] block mb-1"
                >
                  Audio Effects
                </Typography>
                <Typography
                  variant="caption"
                  as="span"
                  className="text-[#52525b]"
                >
                  Play subtle sounds when starting or ending a session.
                </Typography>
              </div>
              <button
                onClick={toggleAudio}
                className={`w-10 h-6 rounded-full relative transition-colors border ${
                  audioEnabled
                    ? "bg-emerald-500/20 border-emerald-500/30"
                    : "bg-[#27272a] border-[#3f3f46]"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full transition-all ${
                    audioEnabled
                      ? "right-1 bg-emerald-500"
                      : "left-1 bg-[#71717a]"
                  }`}
                />
              </button>
            </div>
          </section>

          <section className="bg-[#121214] border border-[#27272a] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <FolderOpen size={20} className="text-[#a1a1aa]" />
              <Typography
                variant="cardTitle"
                as="h2"
                className="text-[#fafafa]"
              >
                Storage & Export
              </Typography>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <Typography
                  variant="label"
                  as="span"
                  className="text-[#fafafa] block mb-1"
                >
                  Default Export Directory
                </Typography>
                <Typography
                  variant="caption"
                  as="span"
                  className="text-[#52525b] block max-w-[400px] truncate"
                >
                  {exportDir || "Documents folder (Default)"}
                </Typography>
              </div>
              <button
                onClick={handleSelectExportDir}
                className="flex items-center gap-2 px-4 py-2 bg-[#18181b] hover:bg-[#27272a] text-[#fafafa] border border-[#3f3f46] rounded-lg transition-colors text-sm font-medium"
              >
                Browse...
              </button>
            </div>
          </section>

          <section className="bg-[#121214] border border-[#27272a] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <RefreshCw size={20} className="text-[#a1a1aa]" />
              <Typography
                variant="cardTitle"
                as="h2"
                className="text-[#fafafa]"
              >
                Application Control
              </Typography>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <Typography
                  variant="label"
                  as="span"
                  className="text-[#fafafa] block mb-1"
                >
                  Reload Application
                </Typography>
                <Typography
                  variant="caption"
                  as="span"
                  className="text-[#52525b]"
                >
                  Restart the interface and refresh all loaded data.
                </Typography>
              </div>
              <button
                onClick={handleReloadApp}
                className="flex items-center gap-2 px-4 py-2 bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/30 rounded-lg transition-colors text-sm font-medium"
              >
                <RefreshCw size={16} />
                Reload Now
              </button>
            </div>
          </section>

          <section className="bg-[#121214] border border-[#27272a] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Keyboard size={20} className="text-[#a1a1aa]" />
                <Typography
                  variant="cardTitle"
                  as="h2"
                  className="text-[#fafafa]"
                >
                  Keyboard Shortcuts
                </Typography>
              </div>
              <button
                onClick={resetShortcuts}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#a1a1aa] hover:text-[#fafafa] bg-[#18181b] border border-[#27272a] rounded-md transition-colors"
              >
                <RotateCcw size={14} />
                Reset to Defaults
              </button>
            </div>

            <div className="space-y-3">
              {(Object.keys(shortcuts) as ShortcutAction[]).map((action) => (
                <div
                  key={action}
                  className="flex items-center justify-between py-2 border-b border-[#27272a]/50 last:border-0"
                >
                  <Typography variant="body" className="text-[#a1a1aa]">
                    {shortcutLabels[action]}
                  </Typography>
                  <ShortcutInput
                    value={shortcuts[action]}
                    onChange={(val) => updateShortcut(action, val)}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="bg-[#121214] border border-rose-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield size={20} className="text-rose-500" />
              <Typography variant="cardTitle" as="h2" className="text-rose-500">
                Danger Zone
              </Typography>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <Typography
                  variant="label"
                  as="span"
                  className="text-[#fafafa] block mb-1"
                >
                  Reset All Data
                </Typography>
                <Typography
                  variant="caption"
                  as="span"
                  className="text-[#52525b]"
                >
                  Permanently delete all your reading sessions, margins, and
                  library history.
                </Typography>
              </div>
              <button
                onClick={handleOpenResetModal}
                className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
                <Typography variant="button">Reset Data</Typography>
              </button>
            </div>
          </section>

          <section className="bg-[#121214] border border-[#27272a] rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Info size={20} className="text-[#a1a1aa]" />
              <Typography
                variant="cardTitle"
                as="h2"
                className="text-[#fafafa]"
              >
                About MARGYN
              </Typography>
            </div>
            <div className="space-y-2">
              <Typography variant="body" as="p" className="text-[#a1a1aa]">
                Version 1.0.0
              </Typography>
              <Typography variant="caption" as="p" className="text-[#52525b]">
                Read, don't count. Mindful reading with a writable margin.
              </Typography>
            </div>
          </section>

          <DevSessionInspector />
        </div>
      </div>

      {showResetModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md transition-all duration-300">
          <div className="bg-[#121214] border border-rose-500/30 p-8 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] w-full max-w-lg flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <AlertTriangle size={32} className="text-rose-500" />
            </div>

            <Typography
              variant="pageTitle"
              as="h2"
              className="text-[#fafafa] mb-2 font-semibold tracking-tight"
            >
              Are you absolutely sure?
            </Typography>

            <Typography
              variant="body"
              as="p"
              className="text-[#a1a1aa] mb-8 max-w-sm leading-relaxed"
            >
              This will permanently delete all your sessions, drawings, and
              library history. This action{" "}
              <strong className="text-rose-400">cannot be undone</strong>.
              <br />
              <br />
              To confirm, type the following phrase in{" "}
              <strong>ALL CAPITAL LETTERS</strong>:
            </Typography>

            <div className="w-full bg-[#09090b] border border-[#27272a] rounded-2xl p-4 mb-6 flex items-center justify-center gap-3 select-none">
              <Lock size={16} className="text-[#52525b]" />
              <span className="text-[#fafafa] font-mono text-base font-bold tracking-widest">
                {REQUIRED_RESET_PHRASE}
              </span>
            </div>

            <input
              ref={inputRef}
              type="text"
              value={resetText}
              onChange={(e) => {
                setResetText(e.target.value);
                setResetError(false);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter" && !isResetting) handleConfirmReset();
              }}
              onPaste={(e) => e.preventDefault()}
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
              onContextMenu={(e) => e.preventDefault()}
              autoComplete="off"
              spellCheck="false"
              disabled={isResetting}
              placeholder="TYPE HERE (UPPERCASE ONLY)"
              autoFocus
              className={`w-full px-5 py-4 rounded-xl bg-[#18181b] border-2 outline-none transition-all text-center text-lg font-mono tracking-widest shadow-sm ${
                resetError
                  ? "border-rose-400 focus:border-rose-500 text-rose-600 placeholder-rose-300 animate-shake"
                  : "border-[#27272a] focus:border-rose-500/50 text-[#fafafa]"
              }`}
            />
            {resetError && (
              <Typography
                variant="caption"
                className="text-rose-500 mt-3 font-medium animate-pulse"
              >
                Incorrect. You must type it exactly as shown.
              </Typography>
            )}

            <div className="flex gap-4 w-full mt-8">
              <button
                onClick={() => setShowResetModal(false)}
                disabled={isResetting}
                className="flex-1 px-4 py-3.5 rounded-xl bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] border border-[#27272a] transition-all font-medium active:scale-[0.98] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                disabled={isResetting}
                className="flex-1 px-4 py-3.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-all font-medium shadow-[0_0_15px_rgba(244,63,94,0.3)] active:scale-[0.98] disabled:opacity-50 flex justify-center items-center"
              >
                {isResetting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  "Delete Everything"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
