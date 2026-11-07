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
  Github,
  Linkedin,
  Mail,
  Instagram,
  ExternalLink,
  X,
  User,
  Code2,
  Cpu,
  Sparkles,
} from "lucide-react";
import Typography from "@/typography";
import { resetDatabase, getSetting, setSetting } from "@/db";
import { useShortcuts, ShortcutAction } from "@/providers/ShortcutProvider";
import {
  setAudioEnabled,
  playToggleOnSound,
  playToggleOffSound,
} from "@/lib/audio";
import ShortcutInput from "./ShortcutInput";

const REQUIRED_RESET_PHRASE = "DELETE ALL MY DATA";

export default function SettingsView() {
  const { shortcuts, updateShortcut, resetShortcuts } = useShortcuts();
  const [audioEnabled, setAudioEnabledState] = useState(false);
  const [exportDir, setExportDir] = useState<string | null>(null);

  const [errorAction, setErrorAction] = useState<ShortcutAction | null>(null);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetText, setResetText] = useState("");
  const [resetError, setResetError] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ✅ استیت برای مدال توسعه‌دهنده
  const [showDevModal, setShowDevModal] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showResetModal) setShowResetModal(false);
        if (showDevModal) setShowDevModal(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showResetModal, showDevModal]);

  useEffect(() => {
    const loadSettings = async () => {
      const savedAudio = await getSetting("audioEnabled");
      if (savedAudio !== null) {
        const isEnabled = savedAudio === "true";
        setAudioEnabledState(isEnabled);
        setAudioEnabled(isEnabled);
      } else {
        await setSetting("audioEnabled", "false");
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
    if (newValue) {
      setAudioEnabled(true);
      setAudioEnabledState(true);
      playToggleOnSound();
    } else {
      playToggleOffSound();
      setAudioEnabledState(false);
      setTimeout(() => setAudioEnabled(false), 100);
    }
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
    increaseSize: "Increase Tool Size",
    decreaseSize: "Decrease Tool Size",
    startSession: "Start Session",
    endSession: "End Session",
    openPdf: "Open PDF File",
    closePdf: "Close Current Tab",
    switchTab: "Switch Tab",
    clearPage: "Clear Current Page Drawings",
    clearAll: "Clear All Pages Drawings",
    toggleMargin: "Toggle Margin Sidebar",
    saveProject: "Save Project",
    importProject: "Import Project",
    exportProject: "Export Project",
    newBlank: "Create New Blank Document",
    note: "Open Page Notes",
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
                    hasError={errorAction === action}
                    onChange={async (val) => {
                      setErrorAction(null);
                      const result = await updateShortcut(action, val);
                      if (!result.success) {
                        setErrorAction(action);
                        setTimeout(() => {
                          setErrorAction((prev) =>
                            prev === action ? null : prev,
                          );
                        }, 2000);
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* ✅ Danger Zone */}
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

          {/* =========================================================
              ✅ بخش جدید: معرفی توسعه‌دهنده (Developer & Creator)
          ========================================================= */}
          <section className="relative bg-[#121214] border border-[#38bdf8]/30 rounded-2xl p-6 overflow-hidden group">
            {/* Glow پس‌زمینه کارت */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#38bdf8]/5 via-transparent to-[#a855f7]/5 opacity-50 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <div className="absolute -inset-x-10 -top-10 h-32 bg-[#38bdf8]/10 blur-[50px] pointer-events-none" />

            <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#38bdf8] to-[#a855f7] p-[2px] shadow-[0_0_20px_rgba(56,189,248,0.3)]">
                  <div className="w-full h-full bg-[#121214] rounded-full flex items-center justify-center">
                    <User size={24} className="text-[#fafafa]" />
                  </div>
                </div>
                <div>
                  <Typography
                    variant="cardTitle"
                    as="h2"
                    className="text-[#fafafa] flex items-center gap-2"
                  >
                    Meet the Developer
                    <Sparkles size={14} className="text-amber-400" />
                  </Typography>
                  <Typography
                    variant="caption"
                    as="p"
                    className="text-[#a1a1aa] mt-1"
                  >
                    Ali Nabizadeh — Software Engineer & Creator of MARGYN
                  </Typography>
                </div>
              </div>

              <button
                onClick={() => setShowDevModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/30 rounded-xl transition-all duration-300 font-medium shadow-[0_0_15px_rgba(56,189,248,0.1)] hover:shadow-[0_0_20px_rgba(56,189,248,0.3)] hover:-translate-y-0.5"
              >
                <Code2 size={16} />
                View Developer Profile
              </button>
            </div>
          </section>
          {/* ========================================================= */}

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
        </div>
      </div>

      {/* ✅ مدال معرفی توسعه‌دهنده */}
      {showDevModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md transition-all duration-300 p-4 sm:p-8">
          {/* هاله‌های نورانی پشت مدال */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#38bdf8]/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#a855f7]/10 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative bg-[#121214] border border-[#38bdf8]/30 rounded-3xl shadow-[0_20px_80px_-15px_rgba(56,189,248,0.15)] w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            {/* هدر مدال با گرادیانت */}
            <div className="h-32 bg-gradient-to-r from-[#0c0c0e] to-[#18181b] relative border-b border-[#27272a] shrink-0">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-[size:24px_24px] opacity-20 pointer-events-none" />
              <button
                onClick={() => setShowDevModal(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-rose-500/20 text-[#a1a1aa] hover:text-rose-400 transition-colors z-20 backdrop-blur-md"
              >
                <X size={20} />
              </button>

              {/* آواتار */}
              <div className="absolute -bottom-12 left-8">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-[#38bdf8] via-[#a855f7] to-[#f43f5e] p-[3px] shadow-[0_0_30px_rgba(56,189,248,0.3)] rotate-3 hover:rotate-0 transition-transform duration-300">
                  <div className="w-full h-full bg-[#09090b] rounded-xl flex items-center justify-center overflow-hidden">
                    {/* اینجا می‌تونید تصویر خودتون رو قرار بدید، فعلا از آیکون استفاده میکنیم */}
                    <User size={40} className="text-[#fafafa]" />
                  </div>
                </div>
              </div>
            </div>

            {/* بدنه مدال */}
            <div className="pt-16 px-8 pb-8 overflow-y-auto custom-scrollbar flex-1">
              <div className="flex justify-between items-start flex-wrap gap-4 mb-6">
                <div>
                  <Typography
                    variant="pageTitle"
                    as="h2"
                    className="text-[#fafafa] text-2xl font-bold tracking-tight mb-1"
                  >
                    Ali Nabizadeh
                  </Typography>
                  <Typography
                    variant="bodyMedium"
                    className="text-[#38bdf8] flex items-center gap-2"
                  >
                    Software Engineer{" "}
                    <span className="w-1 h-1 bg-[#52525b] rounded-full" />{" "}
                    Creator of MARGYN
                  </Typography>
                </div>

                {/* شبکه‌های اجتماعی */}
                <div className="flex items-center gap-2">
                  <a
                    href="https://github.com/alinabizadeh1913"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-white hover:border-[#38bdf8]/50 hover:bg-[#38bdf8]/10 transition-all duration-300"
                    title="GitHub"
                  >
                    <Github size={20} />
                  </a>
                  <a
                    href="https://www.linkedin.com/in/ali-nabizadeh-884866280/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-[#0a66c2] hover:border-[#0a66c2]/50 hover:bg-[#0a66c2]/10 transition-all duration-300"
                    title="LinkedIn"
                  >
                    <Linkedin size={20} />
                  </a>
                  <a
                    href="mailto:alinabizadeh1913@gmail.com"
                    className="p-2.5 rounded-xl bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-amber-400 hover:border-amber-400/50 hover:bg-amber-400/10 transition-all duration-300"
                    title="Email"
                  >
                    <Mail size={20} />
                  </a>
                  <a
                    href="http://instagram.com/ali.nabizadeh.79"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-[#e1306c] hover:border-[#e1306c]/50 hover:bg-[#e1306c]/10 transition-all duration-300"
                    title="Instagram"
                  >
                    <Instagram size={20} />
                  </a>
                </div>
              </div>

              <div className="space-y-6">
                {/* درباره من و پروژه */}
                <div>
                  <Typography
                    variant="microLabel"
                    className="text-[#52525b] mb-2 flex items-center gap-2"
                  >
                    <Info size={14} /> Behind the Code
                  </Typography>
                  <Typography
                    variant="body"
                    as="p"
                    className="text-[#a1a1aa] leading-relaxed"
                  >
                    Hi, I'm Ali Nabizadeh — a Software Engineer driven by the
                    intersection of clean architecture and intuitive user
                    experiences.
                    <br />
                    <br />
                    MARGYN was born from a personal desire for a
                    distraction-free, mindful reading space. I didn't just want
                    to build another PDF reader; I wanted to create a tool that
                    respects your focus and keeps your thoughts organized. I
                    architected this application from the ground up,
                    meticulously designing the local-first database, engineering
                    the custom ink rendering engine, and crafting a seamless UI
                    that blends out of the way of your reading. MARGYN isn't
                    just a product of modern tech; it's a statement on how we
                    should interact with digital text.
                  </Typography>
                </div>

                {/* مهارت‌ها */}
                <div>
                  <Typography
                    variant="microLabel"
                    className="text-[#52525b] mb-3 flex items-center gap-2"
                  >
                    <Cpu size={14} /> Core Technologies & Skills
                  </Typography>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Next.js",
                      "TypeScript",
                      "Tailwind CSS",
                      "UI/UX Aware",
                      "AI Integration",
                      "Prompt Engineering",
                      "IT Fundamentals",
                      "Electron",
                      "SQLite",
                      "Drizzle ORM",
                    ].map((skill) => (
                      <span
                        key={skill}
                        className="px-3 py-1.5 rounded-lg bg-[#18181b] border border-[#27272a] text-[#a1a1aa] text-xs font-medium hover:border-[#38bdf8]/50 hover:text-[#38bdf8] transition-colors cursor-default"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* لینک‌های سریع */}
                <div className="pt-4 border-t border-[#27272a]">
                  <a
                    href="https://www.linkedin.com/in/ali-nabizadeh-884866280/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-[#38bdf8]/10 to-transparent border border-[#38bdf8]/20 hover:border-[#38bdf8]/50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#38bdf8]/20 rounded-lg shrink-0">
                        <Linkedin size={18} className="text-[#38bdf8]" />
                      </div>
                      <div className="flex flex-col">
                        <Typography
                          variant="bodyMedium"
                          className="text-[#fafafa] block"
                        >
                          Connect on LinkedIn
                        </Typography>
                        <Typography
                          variant="caption"
                          className="text-[#52525b] block mt-1"
                        >
                          Let's build something great together.
                        </Typography>
                      </div>
                    </div>
                    <ExternalLink
                      size={18}
                      className="text-[#38bdf8] group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform shrink-0"
                    />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* مدال ریست داده‌ها */}
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
