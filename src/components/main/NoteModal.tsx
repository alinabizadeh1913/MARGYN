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
  ChevronDown,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import Typography from "@/typography";
import { getNote, saveNote } from "@/db";
import { playSuccessSound, playDeleteSound, playErrorSound } from "@/lib/audio";

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

  const [isSizeMenuOpen, setIsSizeMenuOpen] = useState(false);
  const [currentSize, setCurrentSize] = useState("3");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const sizeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && filePath && pageNumber) {
      setIsEditing(false);
      setShowDeleteConfirm(false);
      loadNote();
    }
  }, [isOpen, filePath, pageNumber]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sizeMenuRef.current &&
        !sizeMenuRef.current.contains(event.target as Node)
      ) {
        setIsSizeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, value || undefined);
    editorRef.current?.focus();
  };

  const handleSizeChange = (value: string) => {
    execCommand("fontSize", value);
    setCurrentSize(value);
    setIsSizeMenuOpen(false);
  };

  const handleSave = async () => {
    if (!editorRef.current) return;
    try {
      const html = editorRef.current.innerHTML;
      await saveNote(filePath, pageNumber, html);
      setIsEditing(false);
      playSuccessSound();
      if (onSave) onSave();
    } catch (err) {
      playErrorSound();
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }
    setHasContent(false);
    setIsEditing(false);
    try {
      await saveNote(filePath, pageNumber, "");
      playDeleteSound();
      if (onSave) onSave();
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      playErrorSound();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-md transition-all duration-300 p-4 sm:p-8">
        <div className="bg-[#121214] border border-[#27272a] rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
              {hasContent && (
                <button
                  onClick={handleDeleteClick}
                  className="flex items-center gap-2 px-3 py-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/30 rounded-xl transition-all font-medium text-sm mr-2"
                  title="Delete Note"
                >
                  <Trash2 size={16} />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              )}

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

              <div className="w-px h-6 bg-[#27272a] mx-1 shrink-0" />

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

              <div className="w-px h-6 bg-[#27272a] mx-1 shrink-0" />

              <div className="flex items-center gap-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => execCommand("foreColor", c)}
                    className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition-all shrink-0"
                    style={{ backgroundColor: c }}
                    title="Text Color"
                  />
                ))}
                <div className="relative w-5 h-5 ml-1 flex items-center justify-center shrink-0">
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

              <div className="w-px h-6 bg-[#27272a] mx-1 shrink-0" />

              <div className="relative shrink-0" ref={sizeMenuRef}>
                <button
                  onClick={() => setIsSizeMenuOpen(!isSizeMenuOpen)}
                  className="flex items-center justify-between w-[120px] bg-[#121214] text-[#a1a1aa] text-sm rounded-lg px-3 py-1.5 border border-[#27272a] hover:bg-[#27272a] hover:text-white transition-colors"
                >
                  <span className="flex-1 text-center truncate">
                    {FONT_SIZES.find((s) => s.value === currentSize)?.label ||
                      "Normal"}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`ml-2 shrink-0 transition-transform duration-200 ${
                      isSizeMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isSizeMenuOpen && (
                  <div className="absolute top-full left-0 mt-2 w-[120px] bg-[#121214] border border-[#27272a] rounded-xl shadow-2xl flex flex-col z-[999] py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {FONT_SIZES.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => handleSizeChange(s.value)}
                        className={`px-4 py-2 text-sm text-left transition-colors ${
                          currentSize === s.value
                            ? "bg-[#38bdf8]/20 text-[#38bdf8] font-medium"
                            : "text-[#a1a1aa] hover:text-white hover:bg-white/5"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-6 relative bg-[#09090b]">
            <div
              ref={editorRef}
              contentEditable={isEditing}
              onInput={handleInput}
              onBlur={handleInput}
              data-placeholder="Write your notes here..."
              dir="auto"
              className={`note-editor-content w-full h-full min-h-full outline-none text-[#fafafa] text-[15px] leading-[2] break-words whitespace-pre-wrap ${
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
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 backdrop-blur-md transition-all duration-300">
          <div className="bg-[#121214] border border-rose-500/30 p-8 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] w-full max-w-md flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <AlertTriangle size={32} className="text-rose-500" />
            </div>
            <Typography
              variant="pageTitle"
              as="h2"
              className="text-[#fafafa] mb-2 font-semibold tracking-tight"
            >
              Delete Note?
            </Typography>
            <Typography
              variant="body"
              as="p"
              className="text-[#a1a1aa] mb-8 leading-relaxed"
            >
              This will permanently remove this note from the page. This action
              cannot be undone.
            </Typography>
            <div className="flex gap-3 w-full mt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-3.5 rounded-xl bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] border border-[#27272a] transition-all font-medium active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-3.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-all font-medium shadow-[0_0_15px_rgba(244,63,94,0.3)] active:scale-[0.98]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #52525b;
          pointer-events: none;
          display: block;
        }

        .note-editor-content strike,
        .note-editor-content s,
        .note-editor-content [style*="line-through"],
        .note-editor-content span[style*="line-through"] {
          text-decoration: line-through !important;
          text-decoration-thickness: max(1.5px, 0.08em);
          text-decoration-skip-ink: none;
        }
      `}</style>
    </>
  );
}
