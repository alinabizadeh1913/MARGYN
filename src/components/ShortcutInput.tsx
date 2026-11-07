"use client";

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

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const keys = [];
      if (e.ctrlKey || e.metaKey) keys.push("ctrl");
      if (e.altKey) keys.push("alt");
      if (e.shiftKey) keys.push("shift");

      let key = e.code;
      if (key.startsWith("Key")) key = key.replace("Key", "").toLowerCase();
      else if (key.startsWith("Digit")) key = key.replace("Digit", "");
      else if (key.startsWith("Numpad")) key = key.replace("Numpad", "");
      else if (key === "Delete") key = "delete";
      else if (key === "Backspace") key = "backspace";
      else if (key === "Space") key = "space";
      else key = key.toLowerCase();

      // ✅ FIX: همیشه lowercase کن تا با مقدار پیش‌فرض (add / subtract) هم‌خوان بمونه
      key = key.toLowerCase();

      if (
        [
          "control",
          "shift",
          "alt",
          "meta",
          "controlleft",
          "controlright",
          "shiftleft",
          "shiftright",
          "altleft",
          "altright",
          "metaleft",
          "metaright",
        ].includes(key)
      ) {
        return;
      }

      keys.push(key);
      onChange(keys.join("+"));
      setIsRecording(false);
      window.electronAPI?.setRecordingShortcut(false);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
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
            : "bg-[#18181b] border-[#27272a] text-[#a1a1aa] hover:border-[#52525b]"
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
