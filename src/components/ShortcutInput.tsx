"use client";

import { comboFromEvent } from "@/lib/keys";
import React, { useState, useEffect, useRef } from "react";
import Typography from "@/typography";

interface ShortcutInputProps {
  value: string;
  onChange: (value: string) => void;
  hasError?: boolean;
}

export default function ShortcutInput({
  value,
  onChange,
  hasError,
}: ShortcutInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isRecording) return;

    window.electronAPI?.setRecordingShortcut(true);

    let done = false;
    const commit = (combo: string) => {
      if (done || !combo) return;
      done = true;
      onChange(combo);
      setIsRecording(false);
      window.electronAPI?.setRecordingShortcut(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      commit(comboFromEvent(e)); // "" for a lone modifier -> keep listening
    };

    // Same key as seen by the Electron main process: lets the recorder also
    // capture pen-button keystrokes that never reach the DOM.
    const offRaw = window.electronAPI?.onRawKey?.((k) => {
      if (k.repeat) return;
      const combo = comboFromEvent(k);
      if (!combo) return;
      window.setTimeout(() => commit(combo), 60);
    });

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      if (offRaw) offRaw();
      window.electronAPI?.setRecordingShortcut(false);
    };
  }, [isRecording, onChange]);

  return (
    <button
      ref={inputRef}
      onClick={() => setIsRecording(true)}
      onBlur={() => {
        setIsRecording(false);
        window.electronAPI?.setRecordingShortcut(false);
      }}
      className={`min-w-[100px] px-3 py-1.5 rounded-md border text-sm font-mono transition-colors ${
        hasError
          ? "bg-rose-500/20 border-rose-500 text-rose-500 animate-shake"
          : isRecording
            ? "bg-emerald-500/20 border-emerald-500 text-emerald-500 animate-pulse"
            : "bg-nm-raise border-nm-edge text-nm-muted hover:border-nm-dim"
      }`}
    >
      {isRecording ? (
        <Typography variant="chip" className="text-emerald-500">
          Listening...
        </Typography>
      ) : hasError ? (
        <Typography variant="chip" className="text-rose-500 font-bold">
          CONFLICT
        </Typography>
      ) : (
        value.toUpperCase()
      )}
    </button>
  );
}
