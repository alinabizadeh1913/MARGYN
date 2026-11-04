"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  Trash2,
  Info,
  Volume2,
  Keyboard,
  RotateCcw,
} from "lucide-react";
import Typography from "@/typography";
import { resetDatabase, getSetting, setSetting } from "@/db";
import { useShortcuts, ShortcutAction } from "@/providers/ShortcutProvider";
import { setAudioEnabled } from "@/lib/audio";
import ShortcutInput from "./ShortcutInput";

export default function SettingsView() {
  const { shortcuts, updateShortcut, resetShortcuts } = useShortcuts();
  const [isResetting, setIsResetting] = useState(false);
  const [audioEnabled, setAudioEnabledState] = useState(true);

  // Load audio preference on mount
  useEffect(() => {
    const loadAudioSetting = async () => {
      const saved = await getSetting("audioEnabled");
      if (saved !== null) {
        const isEnabled = saved === "true";
        setAudioEnabledState(isEnabled);
        setAudioEnabled(isEnabled);
      }
    };
    loadAudioSetting();
  }, []);

  const toggleAudio = async () => {
    const newValue = !audioEnabled;
    setAudioEnabledState(newValue);
    setAudioEnabled(newValue);
    await setSetting("audioEnabled", newValue.toString());
  };

  const handleResetData = async () => {
    const confirmed = window.confirm(
      "Are you sure? This will permanently delete all your reading sessions and margins. This action cannot be undone.",
    );

    if (confirmed) {
      setIsResetting(true);
      try {
        // 1. Reset the SQLite database
        await resetDatabase();

        // 2. Clear the active PDF from the file system
        if (window.electronAPI) {
          await window.electronAPI.clearActivePdf();
        }

        alert("All data has been cleared.");
        window.location.reload();
      } catch (error) {
        console.error("Failed to reset database:", error);
        alert("Failed to reset data. Check console for details.");
      } finally {
        setIsResetting(false);
      }
    }
  };

  const shortcutLabels: Record<ShortcutAction, string> = {
    pen: "Select Pen Tool",
    eraser: "Select Eraser Tool",
    toggleSession: "Start / End Session",
    openPdf: "Open PDF File",
    clearPage: "Clear Current Page Drawings",
    clearAll: "Clear All Pages Drawings",
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] p-10 overflow-y-auto">
      <div className="max-w-3xl w-full mx-auto">
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
          {/* Preferences */}
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

          {/* Keyboard Shortcuts */}
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

          {/* Danger Zone */}
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
                  Permanently delete all your reading sessions and margins.
                </Typography>
              </div>
              <button
                onClick={handleResetData}
                disabled={isResetting}
                className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 size={16} />
                <Typography variant="button">
                  {isResetting ? "Resetting..." : "Reset Data"}
                </Typography>
              </button>
            </div>
          </section>

          {/* About */}
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
    </div>
  );
}
