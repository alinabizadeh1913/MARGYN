"use client";

import React, { useState, useEffect } from "react";
import { getRecentFiles, clearRecentFiles, deleteRecentFile } from "@/db";
import {
  BookOpen,
  Trash2,
  Clock,
  FileText,
  AlertTriangle,
  Download,
  Upload,
} from "lucide-react";
import Typography from "@/typography";

interface RecentFile {
  id: string;
  name: string;
  filePath: string;
  lastOpened: number;
  completed: number;
}

export default function LibraryView({
  onSelectFile,
  onImportProject,
}: {
  onSelectFile: (path: string) => void;
  onImportProject: () => void;
}) {
  const [files, setFiles] = useState<RecentFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const loadFiles = async () => {
    setIsLoading(true);
    const data = await getRecentFiles();
    setFiles(data as RecentFile[]);
    setIsLoading(false);
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleClearHistory = async () => {
    await clearRecentFiles();
    setShowConfirmClear(false);
    loadFiles();
  };

  const handleDeleteSingle = async (
    e: React.MouseEvent,
    id: string,
    path: string,
  ) => {
    e.stopPropagation();
    await deleteRecentFile(id, path);
    loadFiles();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] p-10 overflow-y-auto relative">
      <div className="max-w-4xl w-full mx-auto">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <BookOpen className="text-[#38bdf8]" size={28} />
              <Typography
                variant="pageTitle"
                as="h1"
                className="text-[#fafafa]"
              >
                Library
              </Typography>
            </div>
            <Typography
              variant="body"
              as="p"
              className="text-[#a1a1aa] max-w-xl"
            >
              Quickly jump back into your recent documents. Your annotations
              will be exactly where you left them.
            </Typography>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onImportProject}
              className="flex items-center gap-2 px-4 py-2 text-sm text-[#38bdf8] bg-[#38bdf8]/10 border border-[#38bdf8]/20 rounded-xl hover:bg-[#38bdf8]/20 transition-all font-medium"
            >
              <Upload size={16} />
              Import Project
            </button>
            {files.length > 0 && (
              <button
                onClick={() => setShowConfirmClear(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl hover:bg-rose-500/20 transition-all font-medium"
              >
                <Trash2 size={16} />
                Clear History
              </button>
            )}
          </div>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-white/10 border-t-[#38bdf8] rounded-full animate-spin"></div>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 bg-[#121214] border border-[#27272a] rounded-3xl">
            <FileText size={48} className="text-[#3f3f46] mb-4" />
            <Typography
              variant="cardTitle"
              className="text-[#fafafa] mb-2 block"
            >
              No recent files
            </Typography>
            <Typography variant="body" className="text-[#a1a1aa] block">
              Open a PDF to see it appear here.
            </Typography>
          </div>
        ) : (
          <div className="grid gap-3">
            {files.map((file) => (
              <div
                key={file.id}
                onClick={() => onSelectFile(file.filePath)}
                className="group flex items-center justify-between p-5 bg-[#121214] border border-[#27272a] rounded-2xl cursor-pointer hover:bg-[#18181b] hover:border-[#38bdf8]/50 transition-all duration-300 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-[#38bdf8]/0 via-[#38bdf8]/0 to-[#38bdf8]/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                <div className="flex items-center gap-5 relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-[#09090b] border border-[#27272a] flex items-center justify-center group-hover:border-[#38bdf8]/30 transition-colors">
                    <FileText
                      size={20}
                      className="text-[#a1a1aa] group-hover:text-[#38bdf8] transition-colors"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Typography
                        variant="cardTitle"
                        className="text-[#fafafa] group-hover:text-[#38bdf8] transition-colors line-clamp-1"
                      >
                        {file.name}
                      </Typography>
                      {file.completed === 1 && (
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-full border border-emerald-500/20">
                          Completed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[#52525b]">
                      <Clock size={12} />
                      <Typography variant="caption" className="text-[#52525b]">
                        {formatDate(file.lastOpened)}
                      </Typography>
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => handleDeleteSingle(e, file.id, file.filePath)}
                  className="p-3 text-[#52525b] hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 relative z-10"
                  title="Remove from history"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showConfirmClear && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm transition-all duration-300">
          <div className="bg-[#121214] border border-[#27272a] p-8 rounded-3xl shadow-2xl w-full max-w-md flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle size={32} className="text-rose-500" />
            </div>
            <Typography
              variant="pageTitle"
              as="h2"
              className="text-[#fafafa] mb-2"
            >
              Clear History?
            </Typography>
            <Typography variant="body" as="p" className="text-[#a1a1aa] mb-8">
              This will remove all files from your library. Your actual PDF
              files on your computer will not be deleted.
            </Typography>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowConfirmClear(false)}
                className="flex-1 px-4 py-3 rounded-xl bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] transition-colors font-medium border border-[#27272a]"
              >
                Cancel
              </button>
              <button
                onClick={handleClearHistory}
                className="flex-1 px-4 py-3 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-colors font-medium shadow-[0_0_15px_rgba(244,63,94,0.3)]"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
