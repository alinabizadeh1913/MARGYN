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
  Palette,
  Check,
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
import {
  THEMES,
  THEME_DB_KEY,
  ThemeId,
  applyTheme,
  getStoredTheme,
  isThemeId,
} from "@/lib/theme";

const REQUIRED_RESET_PHRASE = "DELETE ALL MY DATA";

export default function SettingsView() {
  const { shortcuts, updateShortcut, resetShortcuts } = useShortcuts();
  const [audioEnabled, setAudioEnabledState] = useState(false);
  const [exportDir, setExportDir] = useState<string | null>(null);
  const [themeId, setThemeId] = useState<ThemeId>(() => getStoredTheme());

  const [errorAction, setErrorAction] = useState<ShortcutAction | null>(null);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetText, setResetText] = useState("");
  const [resetError, setResetError] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

      // Theme: localStorage is applied before first paint; the database copy
      // only restores it if localStorage was cleared.
      const savedTheme = await getSetting(THEME_DB_KEY);
      if (isThemeId(savedTheme) && savedTheme !== getStoredTheme()) {
        applyTheme(savedTheme);
        setThemeId(savedTheme);
      }
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

  const handleSelectTheme = async (id: ThemeId) => {
    if (id === themeId) return;
    setThemeId(id);
    applyTheme(id);
    await setSetting(THEME_DB_KEY, id);
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
    pan: "Select Pan Tool (Hand)",
    increaseSize: "Increase Tool Size",
    decreaseSize: "Decrease Tool Size",
    startSession: "Start Session",
    endSession: "End Session",
    openPdf: "Open PDF File",
    closePdf: "Close Current Tab",
    switchTab: "Switch Tab",
    nextTab: "Next Tab",
    prevTab: "Previous Tab",
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
    <div className="flex flex-col h-full w-full bg-nm-deep p-10 overflow-y-auto relative">
      <div className="max-w-4xl w-full mx-auto pb-20">
        <header className="mb-10">
          <Typography
            variant="pageTitle"
            as="h1"
            className="text-nm-text mb-3"
          >
            Settings
          </Typography>
          <Typography variant="body" as="p" className="text-nm-muted">
            Manage your preferences and application data.
          </Typography>
        </header>

        <div className="space-y-6">
          <section className="bg-nm-panel border border-nm-edge rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Volume2 size={20} className="text-nm-muted" />
              <Typography
                variant="cardTitle"
                as="h2"
                className="text-nm-text"
              >
                Preferences
              </Typography>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <Typography
                  variant="label"
                  as="span"
                  className="text-nm-text block mb-1"
                >
                  Audio Effects
                </Typography>
                <Typography
                  variant="caption"
                  as="span"
                  className="text-nm-dim"
                >
                  Play subtle sounds when starting or ending a session.
                </Typography>
              </div>
              <button
                onClick={toggleAudio}
                className={`w-10 h-6 rounded-full relative transition-colors border ${
                  audioEnabled
                    ? "bg-emerald-500/20 border-emerald-500/30"
                    : "bg-nm-line border-nm-faint"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 rounded-full transition-all ${
                    audioEnabled
                      ? "right-1 bg-emerald-500"
                      : "left-1 bg-nm-dim"
                  }`}
                />
              </button>
            </div>
          </section>

          <section className="bg-nm-panel border border-nm-edge rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Palette size={20} className="text-nm-muted" />
              <Typography
                variant="cardTitle"
                as="h2"
                className="text-nm-text"
              >
                Theme Color
              </Typography>
            </div>
            <div className="py-3">
              <Typography
                variant="label"
                as="span"
                className="text-nm-text block mb-1"
              >
                Accent Color
              </Typography>
              <Typography
                variant="caption"
                as="span"
                className="text-nm-dim block mb-5"
              >
                Re-tints the whole interface. Applied instantly and remembered.
              </Typography>
              <div className="flex flex-wrap items-start gap-6">
                {THEMES.map((t) => {
                  const active = t.id === themeId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTheme(t.id)}
                      aria-pressed={active}
                      aria-label={`${t.label} theme`}
                      className="flex flex-col items-center gap-2 group"
                    >
                      <span
                        className={`w-14 h-14 rounded-full bg-nm-panel flex items-center justify-center transition-shadow duration-300 ${
                          active
                            ? "shadow-nm-inset"
                            : "shadow-nm-raised-sm group-hover:shadow-nm-raised"
                        }`}
                      >
                        <span
                          className="w-7 h-7 rounded-full flex items-center justify-center"
                          style={{
                            backgroundColor: `rgb(${t.rgb})`,
                            boxShadow: active
                              ? `0 0 14px rgb(${t.rgb} / 0.65)`
                              : "none",
                          }}
                        >
                          {active && (
                            <Check
                              size={14}
                              strokeWidth={3}
                              className="text-black/70"
                            />
                          )}
                        </span>
                      </span>
                      <span
                        className={`text-[11px] font-medium tracking-wide transition-colors ${
                          active ? "text-nm-text" : "text-nm-dim"
                        }`}
                      >
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="bg-nm-panel border border-nm-edge rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <FolderOpen size={20} className="text-nm-muted" />
              <Typography
                variant="cardTitle"
                as="h2"
                className="text-nm-text"
              >
                Storage & Export
              </Typography>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <Typography
                  variant="label"
                  as="span"
                  className="text-nm-text block mb-1"
                >
                  Default Export Directory
                </Typography>
                <Typography
                  variant="caption"
                  as="span"
                  className="text-nm-dim block max-w-[400px] truncate"
                >
                  {exportDir || "Documents folder (Default)"}
                </Typography>
              </div>
              <button
                onClick={handleSelectExportDir}
                className="flex items-center gap-2 px-4 py-2 bg-nm-raise hover:bg-nm-line text-nm-text border border-nm-faint rounded-lg transition-colors text-sm font-medium"
              >
                Browse...
              </button>
            </div>
          </section>

          <section className="bg-nm-panel border border-nm-edge rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <RefreshCw size={20} className="text-nm-muted" />
              <Typography
                variant="cardTitle"
                as="h2"
                className="text-nm-text"
              >
                Application Control
              </Typography>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <Typography
                  variant="label"
                  as="span"
                  className="text-nm-text block mb-1"
                >
                  Reload Application
                </Typography>
                <Typography
                  variant="caption"
                  as="span"
                  className="text-nm-dim"
                >
                  Restart the interface and refresh all loaded data.
                </Typography>
              </div>
              <button
                onClick={handleReloadApp}
                className="flex items-center gap-2 px-4 py-2 bg-nm-accent/10 hover:bg-nm-accent/20 text-nm-accent border border-nm-accent/30 rounded-lg transition-colors text-sm font-medium"
              >
                <RefreshCw size={16} />
                Reload Now
              </button>
            </div>
          </section>

          <section className="bg-nm-panel border border-nm-edge rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Keyboard size={20} className="text-nm-muted" />
                <Typography
                  variant="cardTitle"
                  as="h2"
                  className="text-nm-text"
                >
                  Keyboard Shortcuts
                </Typography>
              </div>
              <button
                onClick={resetShortcuts}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-nm-muted hover:text-nm-text bg-nm-raise border border-nm-edge rounded-md transition-colors"
              >
                <RotateCcw size={14} />
                Reset to Defaults
              </button>
            </div>

            <div className="space-y-3">
              {(Object.keys(shortcuts) as ShortcutAction[]).map((action) => (
                <div
                  key={action}
                  className="flex items-center justify-between py-2 border-b border-nm-edge/50 last:border-0"
                >
                  <Typography variant="body" className="text-nm-muted">
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

          <section className="bg-nm-panel border border-rose-500/20 rounded-2xl p-6">
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
                  className="text-nm-text block mb-1"
                >
                  Reset All Data
                </Typography>
                <Typography
                  variant="caption"
                  as="span"
                  className="text-nm-dim"
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

          <section className="relative bg-nm-panel border border-nm-accent/30 rounded-2xl p-6 overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-nm-accent/5 via-transparent to-nm-ember/5 opacity-50 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <div className="relative z-10 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-nm-accent to-nm-ember p-[2px] shadow-nm-glow">
                  <div className="w-full h-full bg-nm-panel rounded-full flex items-center justify-center">
                    <User size={24} className="text-nm-text" />
                  </div>
                </div>
                <div>
                  <Typography
                    variant="cardTitle"
                    as="h2"
                    className="text-nm-text flex items-center gap-2"
                  >
                    Meet the Developer
                    <Sparkles size={14} className="text-amber-400" />
                  </Typography>
                  <Typography
                    variant="caption"
                    as="p"
                    className="text-nm-muted mt-1"
                  >
                    Ali Nabizadeh — Software Engineer & Creator of MARGYN
                  </Typography>
                </div>
              </div>

              <button
                onClick={() => setShowDevModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-nm-accent/10 hover:bg-nm-accent/20 text-nm-accent border border-nm-accent/30 rounded-xl transition-all duration-300 font-medium shadow-nm-glow hover:shadow-nm-glow hover:-translate-y-0.5"
              >
                <Code2 size={16} />
                View Developer Profile
              </button>
            </div>
          </section>

          <section className="bg-nm-panel border border-nm-edge rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Info size={20} className="text-nm-muted" />
              <Typography
                variant="cardTitle"
                as="h2"
                className="text-nm-text"
              >
                About MARGYN
              </Typography>
            </div>
            <div className="space-y-2">
              <Typography variant="body" as="p" className="text-nm-muted">
                Version 1.0.0
              </Typography>
              <Typography variant="caption" as="p" className="text-nm-dim">
                Read, don't count. Mindful reading with a writable margin.
              </Typography>
            </div>
          </section>
        </div>
      </div>

      {showDevModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 transition-all duration-300 p-4 sm:p-8">

          <div className="relative bg-nm-panel border border-nm-accent/30 rounded-3xl shadow-nm-glow w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="h-32 bg-nm-raise relative shrink-0">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#2b2630_1px,transparent_1px),linear-gradient(to_bottom,#2b2630_1px,transparent_1px)] bg-[size:24px_24px] opacity-20 pointer-events-none" />
              <button
                onClick={() => setShowDevModal(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-rose-500/20 text-nm-muted hover:text-rose-400 transition-colors z-20"
              >
                <X size={20} />
              </button>

              <div className="absolute -bottom-12 left-8">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-nm-accent via-nm-ember to-nm-hot p-[3px] shadow-nm-glow rotate-3 hover:rotate-0 transition-transform duration-300">
                  <div className="w-full h-full bg-nm-deep rounded-xl flex items-center justify-center overflow-hidden">
                    <User size={40} className="text-nm-text" />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-16 px-8 pb-8 overflow-y-auto custom-scrollbar flex-1">
              <div className="flex justify-between items-start flex-wrap gap-4 mb-6">
                <div>
                  <Typography
                    variant="pageTitle"
                    as="h2"
                    className="text-nm-text text-2xl font-bold tracking-tight mb-1"
                  >
                    Ali Nabizadeh
                  </Typography>
                  <Typography
                    variant="bodyMedium"
                    className="text-nm-accent flex items-center gap-2"
                  >
                    Software Engineer{" "}
                    <span className="w-1 h-1 bg-nm-dim rounded-full" />{" "}
                    Creator of MARGYN
                  </Typography>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href="https://github.com/alinabizadeh1913"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-nm-raise border border-nm-edge text-nm-muted hover:text-white hover:border-nm-accent/50 hover:bg-nm-accent/10 transition-all duration-300"
                    title="GitHub"
                  >
                    <Github size={20} />
                  </a>
                  <a
                    href="https://www.linkedin.com/in/ali-nabizadeh-884866280/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-nm-raise border border-nm-edge text-nm-muted hover:text-[#0a66c2] hover:border-[#0a66c2]/50 hover:bg-[#0a66c2]/10 transition-all duration-300"
                    title="LinkedIn"
                  >
                    <Linkedin size={20} />
                  </a>
                  <a
                    href="mailto:alinabizadeh1913@gmail.com"
                    className="p-2.5 rounded-xl bg-nm-raise border border-nm-edge text-nm-muted hover:text-amber-400 hover:border-amber-400/50 hover:bg-amber-400/10 transition-all duration-300"
                    title="Email"
                  >
                    <Mail size={20} />
                  </a>
                  <a
                    href="http://instagram.com/ali.nabizadeh.79"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl bg-nm-raise border border-nm-edge text-nm-muted hover:text-[#e1306c] hover:border-[#e1306c]/50 hover:bg-[#e1306c]/10 transition-all duration-300"
                    title="Instagram"
                  >
                    <Instagram size={20} />
                  </a>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <Typography
                    variant="microLabel"
                    className="text-nm-dim mb-2 flex items-center gap-2"
                  >
                    <Info size={14} /> Behind the Code
                  </Typography>
                  <Typography
                    variant="body"
                    as="p"
                    className="text-nm-muted leading-relaxed"
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

                <div>
                  <Typography
                    variant="microLabel"
                    className="text-nm-dim mb-3 flex items-center gap-2"
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
                        className="px-3 py-1.5 rounded-lg bg-nm-raise border border-nm-edge text-nm-muted text-xs font-medium hover:border-nm-accent/50 hover:text-nm-accent transition-colors cursor-default"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-nm-edge">
                  <a
                    href="https://www.linkedin.com/in/ali-nabizadeh-884866280/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-nm-accent/10 to-transparent border border-nm-accent/20 hover:border-nm-accent/50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-nm-accent/20 rounded-lg shrink-0">
                        <Linkedin size={18} className="text-nm-accent" />
                      </div>
                      <div className="flex flex-col">
                        <Typography
                          variant="bodyMedium"
                          className="text-nm-text block"
                        >
                          Connect on LinkedIn
                        </Typography>
                        <Typography
                          variant="caption"
                          className="text-nm-dim block mt-1"
                        >
                          Let's build something great together.
                        </Typography>
                      </div>
                    </div>
                    <ExternalLink
                      size={18}
                      className="text-nm-accent group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform shrink-0"
                    />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showResetModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 transition-all duration-300">
          <div className="bg-nm-panel border border-rose-500/30 p-8 rounded-3xl shadow-nm-float w-full max-w-lg flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <AlertTriangle size={32} className="text-rose-500" />
            </div>
            <Typography
              variant="pageTitle"
              as="h2"
              className="text-nm-text mb-2 font-semibold tracking-tight"
            >
              Are you absolutely sure?
            </Typography>
            <Typography
              variant="body"
              as="p"
              className="text-nm-muted mb-8 max-w-sm leading-relaxed"
            >
              This will permanently delete all your sessions, drawings, and
              library history. This action{" "}
              <strong className="text-rose-400">cannot be undone</strong>.
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
              className={`w-full px-5 py-4 rounded-xl bg-nm-raise border-2 outline-none transition-all text-center text-lg font-mono tracking-widest shadow-sm ${
                resetError
                  ? "border-rose-400 focus:border-rose-500 text-rose-600 placeholder-rose-300 animate-shake"
                  : "border-nm-edge focus:border-rose-500/50 text-nm-text"
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
                className="flex-1 px-4 py-3.5 rounded-xl bg-nm-raise text-nm-muted hover:text-nm-text hover:bg-nm-line border border-nm-edge transition-all font-medium active:scale-[0.98] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                disabled={isResetting}
                className="flex-1 px-4 py-3.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-all font-medium shadow-nm-glow active:scale-[0.98] disabled:opacity-50 flex justify-center items-center"
              >
                {isResetting ? (
                  <div className="w-5 h-5 border-2 border-nm-edge border-t-white rounded-full animate-spin"></div>
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
