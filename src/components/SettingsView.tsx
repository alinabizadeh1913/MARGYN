"use client";

import React, { useState } from "react";
import { Shield, Trash2, Info, Volume2 } from "lucide-react";
import Typography from "@/typography";
import { resetDatabase } from "@/db";

export default function SettingsView() {
  const [isResetting, setIsResetting] = useState(false);

  const handleResetData = async () => {
    const confirmed = window.confirm(
      "Are you sure? This will permanently delete all your reading sessions and margins. This action cannot be undone.",
    );

    if (confirmed) {
      setIsResetting(true);
      try {
        await resetDatabase();
        alert("All data has been cleared.");
        window.location.reload(); // Reload to ensure clean state
      } catch (error) {
        console.error("Failed to reset database:", error);
        alert("Failed to reset data. Check console for details.");
      } finally {
        setIsResetting(false);
      }
    }
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
            <div className="flex items-center justify-between py-3 border-b border-[#27272a]/50">
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
              <div className="w-10 h-6 bg-emerald-500/20 rounded-full relative cursor-pointer border border-emerald-500/30">
                <div className="absolute right-1 top-1 w-4 h-4 bg-emerald-500 rounded-full" />
              </div>
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
