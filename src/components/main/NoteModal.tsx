"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Edit3,
  Save,
  Palette,
} from "lucide-react";
import Typography from "@/typography";
import { getNote, saveNote } from "@/db";

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  filePath: string;
  pageNumber: number;
  onSave?: () => void;
}

const FONT_SIZES = [
  { label: "Small", value: "2" },
  { label: "Normal", value: "3" },
  { label: "Large", value: "5" },
  { label: "Huge", value: "7" },
];

const COLORS = [
  "#fafafa",
  "#a1a1aa",
  "#38bdf8",
  "#f43f5e",
  "#10b981",
  "#f59e0b",
  "#a855f7",
];

export default function NoteModal({
  isOpen,
  onClose,
  filePath,
  pageNumber,
  onSave,
}: NoteModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && filePath && pageNumber) {
      setIsEditing(false);
      loadNote();
    }
  }, [isOpen, filePath, pageNumber]);

  const loadNote = async () => {
    const html = await getNote(filePath, pageNumber);
    if (editorRef.current) {
      editorRef.current.innerHTML = html || "";
      setHasContent(!!html && html !== "<br>" && html !== "<div><br></div>");
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      setHasContent(editorRef.current.innerText.trim().length > 0);
    }
  };

  const execCommand = (command: string, value: string | null = null) => {
    document.execCommand(command, false, value || undefined);
    editorRef.current?.focus();
  };

  const handleSave = async () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    await saveNote(filePath, pageNumber, html);
    setIsEditing(false);
    if (onSave) onSave();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-md transition-all duration-300 p-4 sm:p-8">
      <div className="bg-[#121214] border border-[#27272a] rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#27272a] bg-[#09090b]/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Type size={20} className="text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <Typography
                variant="cardTitle"
                className="text-[#fafafa] text-lg"
              >
                Page Notes
              </Typography>
              <Typography
                variant="caption"
                className="text-[#52525b] text-sm font-medium"
              >
                Page {pageNumber}
              </Typography>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl transition-all font-medium text-sm shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              >
                <Save size={16} />
                Save Note
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsEditing(true);
                  setTimeout(() => editorRef.current?.focus(), 100);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-[#38bdf8]/10 text-[#38bdf8] hover:bg-[#38bdf8]/20 border border-[#38bdf8]/30 rounded-xl transition-all font-medium text-sm"
              >
                <Type size={16} />
                {/* ✅ تغییر متن دکمه بر اساس وجود متن */}
                {hasContent ? "Edit Note" : "Add Note"}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#52525b] hover:text-[#fafafa] hover:bg-[#27272a] transition-all ml-2"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        {isEditing && (
          <div className="flex flex-wrap items-center gap-1 p-2 bg-[#18181b] border-b border-[#27272a] shrink-0">
            <button
              onClick={() => execCommand("bold")}
              className="p-2 rounded-lg text-[#a1a1aa] hover:bg-[#27272a] hover:text-white transition-all"
              title="Bold"
            >
              <Bold size={16} />
            </button>
            <button
              onClick={() => execCommand("italic")}
              className="p-2 rounded-lg text-[#a1a1aa] hover:bg-[#27272a] hover:text-white transition-all"
              title="Italic"
            >
              <Italic size={16} />
            </button>
            <button
              onClick={() => execCommand("underline")}
              className="p-2 rounded-lg text-[#a1a1aa] hover:bg-[#27272a] hover:text-white transition-all"
              title="Underline"
            >
              <Underline size={16} />
            </button>
            <button
              onClick={() => execCommand("strikeThrough")}
              className="p-2 rounded-lg text-[#a1a1aa] hover:bg-[#27272a] hover:text-white transition-all"
              title="Strikethrough"
            >
              <Strikethrough size={16} />
            </button>

            <div className="w-px h-6 bg-[#27272a] mx-1" />

            <button
              onClick={() => execCommand("justifyLeft")}
              className="p-2 rounded-lg text-[#a1a1aa] hover:bg-[#27272a] hover:text-white transition-all"
              title="Align Left"
            >
              <AlignLeft size={16} />
            </button>
            <button
              onClick={() => execCommand("justifyCenter")}
              className="p-2 rounded-lg text-[#a1a1aa] hover:bg-[#27272a] hover:text-white transition-all"
              title="Align Center"
            >
              <AlignCenter size={16} />
            </button>
            <button
              onClick={() => execCommand("justifyRight")}
              className="p-2 rounded-lg text-[#a1a1aa] hover:bg-[#27272a] hover:text-white transition-all"
              title="Align Right"
            >
              <AlignRight size={16} />
            </button>

            <div className="w-px h-6 bg-[#27272a] mx-1" />

            <div className="flex items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => execCommand("foreColor", c)}
                  className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition-all"
                  style={{ backgroundColor: c }}
                  title="Text Color"
                />
              ))}
              <div className="relative w-5 h-5 ml-1 flex items-center justify-center">
                <input
                  type="color"
                  onChange={(e) => execCommand("foreColor", e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
                  title="Custom Color"
                />
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-rose-500 via-emerald-500 to-blue-500 p-[2px]">
                  <div className="w-full h-full bg-[#18181b] rounded-full flex items-center justify-center">
                    <Palette size={10} className="text-white" />
                  </div>
                </div>
              </div>
            </div>

            <div className="w-px h-6 bg-[#27272a] mx-1" />

            <select
              onChange={(e) => execCommand("fontSize", e.target.value)}
              className="bg-[#121214] text-[#a1a1aa] text-sm rounded-lg px-2 py-1.5 outline-none border border-[#27272a] cursor-pointer"
              defaultValue="3"
            >
              {FONT_SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Editor Area */}
        <div className="flex-1 overflow-y-auto p-6 relative bg-[#09090b]">
          <div
            ref={editorRef}
            contentEditable={isEditing}
            onInput={handleInput}
            onBlur={handleInput}
            data-placeholder="Write your notes here..."
            // ✅ استفاده از dir="auto" باعث می‌شود مرورگر خودش جهت هر خط را بر اساس زبان آن تشخیص دهد
            dir="auto"
            className={`w-full h-full min-h-full outline-none text-[#fafafa] text-[15px] leading-relaxed break-words whitespace-pre-wrap ${
              !isEditing && !hasContent ? "cursor-default" : ""
            } ${isEditing ? "ring-2 ring-[#38bdf8]/30 rounded-xl p-4 bg-[#121214] transition-all" : ""}`}
            style={{ textAlign: "start" }}
          />
          {!isEditing && !hasContent && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-50">
              <Type size={40} className="text-[#3f3f46] mb-3" />
              <Typography variant="body" className="text-[#52525b]">
                No notes on this page yet. Click "Add Note" to start.
              </Typography>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #52525b;
          pointer-events: none;
          display: block;
        }
      `}</style>
    </div>
  );
}
