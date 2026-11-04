"use client";

import React, { useState, useEffect, useRef } from "react";
import Typography from "@/typography";

interface ShortcutInputProps {
  value: string;
  onChange: (value: string) => void;
}

export default function ShortcutInput({ value, onChange }: ShortcutInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault(); // Stop browser default (e.g., Ctrl+S saving page)
      
      const keys = [];
      if (e.ctrlKey || e.metaKey) keys.push("ctrl");
      if (e.altKey) keys.push("alt");
      if (e.shiftKey) keys.push("shift");
      
      const key = e.key.toLowerCase();
      
      // Ignore if only modifiers are pressed
      if (["control", "shift", "alt", "meta"].includes(key)) {
        return;
      }
      
      keys.push(key);
      onChange(keys.join("+"));
      setIsRecording(false);
    };

    // Capture the event in the capture phase to override global listeners
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isRecording, onChange]);

  return (
    <button
      ref={inputRef}
      onClick={() => setIsRecording(true)}
      onBlur={() => setIsRecording(false)}
      className={`min-w-[100px] px-3 py-1.5 rounded-md border text-sm font-mono transition-colors ${
        isRecording 
          ? "bg-emerald-500/20 border-emerald-500 text-emerald-500 animate-pulse" 
          : "bg-[#18181b] border-[#27272a] text-[#a1a1aa] hover:border-[#52525b]"
      }`}
    >
      {isRecording ? (
        <Typography variant="chip" className="text-emerald-500">Listening...</Typography>
      ) : (
        value.toUpperCase()
      )}
    </button>
  );
}