"use client";

import React, { useState, useEffect } from "react";
import { getRecentFiles, clearRecentFiles, deleteRecentFile } from "@/db";
import { useContextMenu } from "@/providers/ContextMenuProvider";
import {
  BookOpen,
  Trash2,
  Clock,
  FileText,
  AlertTriangle,
  Download,
  FolderArchive,
  FolderOpen,
} from "lucide-react";
import Typography from "@/typography";
import { playDeleteSound } from "@/lib/audio";

interface RecentFile {
  id: string;
  name: string;
  filePath: string;
  lastOpened: number;
  completed: number;
  projectPath: string | null;
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
  const [activeTab, setActiveTab] = useState<"pdfs" | "projects">("pdfs");

  const { openMenu } = useContextMenu();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showConfirmClear) setShowConfirmClear(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showConfirmClear]);

  const loadFiles = async () => {
    setIsLoading(true);
    const data = await getRecentFiles();

    const uniqueFiles: RecentFile[] = [];
    const seen = new Set();

    for (const file of data as RecentFile[]) {
      const key = file.projectPath ? file.projectPath : file.name;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueFiles.push(file);
      }
    }

    setFiles(uniqueFiles);
    setIsLoading(false);
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleClearHistory = async () => {
    await clearRecentFiles();
    playDeleteSound();
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
    playDeleteSound();
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

  const filteredFiles = files.filter((file) => {
    if (activeTab === "projects") return !!file.projectPath;
    return !file.projectPath;
  });

  return (
    <div className="flex flex-col h-full w-full bg-[#09080b] p-10 overflow-y-auto relative">
      <div className="max-w-4xl w-full mx-auto">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <BookOpen className="text-[#ef2b3a]" size={28} />
              <Typography
                variant="pageTitle"
                as="h1"
                className="text-[#fbf8f9]"
              >
                Library
              </Typography>
            </div>
            <Typography
              variant="body"
              as="p"
              className="text-[#aaa3b4] max-w-xl"
            >
              Quickly jump back into your recent documents. Your annotations
              will be exactly where you left them.
            </Typography>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onImportProject}
              className="flex items-center gap-2 px-4 py-2 text-sm text-[#ef2b3a] bg-[#ef2b3a]/10 border border-[#ef2b3a]/20 rounded-xl hover:bg-[#ef2b3a]/20 transition-all font-medium"
            >
              <Download size={16} />
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

        <div className="flex items-center gap-2 mb-6 bg-[#121015] p-1.5 rounded-2xl w-fit border border-[#2b2630]">
          <button
            onClick={() => setActiveTab("pdfs")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm ${
              activeTab === "pdfs"
                ? "bg-[#2b2630] text-white shadow-md border border-white/10"
                : "text-[#aaa3b4] hover:text-white hover:bg-white/5"
            }`}
          >
            <FileText size={16} />
            PDF Documents
          </button>
          <button
            onClick={() => setActiveTab("projects")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all duration-300 font-medium text-sm ${
              activeTab === "projects"
                ? "bg-[#2b2630] text-white shadow-md border border-white/10"
                : "text-[#aaa3b4] hover:text-white hover:bg-white/5"
            }`}
          >
            <FolderArchive size={16} />
            Projects
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-white/10 border-t-[#ef2b3a] rounded-full animate-spin"></div>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 bg-[#121015] border border-[#2b2630] rounded-3xl">
            {activeTab === "pdfs" ? (
              <FileText size={48} className="text-[#443d4b] mb-4" />
            ) : (
              <FolderArchive size={48} className="text-[#443d4b] mb-4" />
            )}
            <Typography
              variant="cardTitle"
              className="text-[#fbf8f9] mb-2 block"
            >
              No recent {activeTab === "pdfs" ? "PDFs" : "Projects"}
            </Typography>
            <Typography variant="body" className="text-[#aaa3b4] block">
              {activeTab === "pdfs"
                ? "Open a PDF to see it appear here."
                : "Export or Import a project to see it here."}
            </Typography>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredFiles.map((file) => {
              const isProject = !!file.projectPath;
              const projectName = isProject
                ? file.projectPath!.split(/[/\\]/).pop()?.replace(".margyn", "")
                : null;
              const displayName =
                projectName || file.name || "Untitled Project";

              return (
                <div
                  key={file.id}
                  onClick={() => onSelectFile(file.filePath)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    openMenu(e.clientX, e.clientY, [
                      {
                        label: isProject ? "Open Project" : "Open PDF",
                        icon: FolderOpen,
                        onClick: () => onSelectFile(file.filePath),
                      },
                      { separator: true },
                      {
                        label: "Remove from Library",
                        icon: Trash2,
                        danger: true,
                        onClick: () =>
                          handleDeleteSingle(
                            { stopPropagation: () => {} } as any,
                            file.id,
                            file.filePath,
                          ),
                      },
                    ]);
                  }}
                  className="group flex items-center justify-between p-5 bg-[#121015] border border-[#2b2630] rounded-2xl cursor-pointer hover:bg-[#19161c] hover:border-[#ef2b3a]/50 transition-all duration-300 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[#ef2b3a]/0 via-[#ef2b3a]/0 to-[#ef2b3a]/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                  <div className="flex items-center gap-5 relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-[#09080b] border border-[#2b2630] flex items-center justify-center group-hover:border-[#ef2b3a]/30 transition-colors shrink-0">
                      {isProject ? (
                        <FolderArchive
                          size={20}
                          className="text-emerald-400 group-hover:text-emerald-300 transition-colors"
                        />
                      ) : (
                        <FileText
                          size={20}
                          className="text-rose-400 group-hover:text-rose-300 transition-colors"
                        />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Typography
                          variant="cardTitle"
                          className="text-[#fbf8f9] group-hover:text-[#ef2b3a] transition-colors line-clamp-1"
                        >
                          {displayName}
                        </Typography>

                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider shrink-0 ${isProject ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"}`}
                        >
                          {isProject ? "MARGYN" : "PDF"}
                        </span>

                        {file.completed === 1 && (
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded-full border border-emerald-500/20">
                            Completed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[#6f6878]">
                        <Clock size={12} />
                        <Typography
                          variant="caption"
                          className="text-[#6f6878]"
                        >
                          {formatDate(file.lastOpened)}
                        </Typography>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) =>
                      handleDeleteSingle(e, file.id, file.filePath)
                    }
                    className="p-3 text-[#6f6878] hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100 relative z-10"
                    title="Remove from history"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showConfirmClear && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 transition-all duration-300">
          <div className="bg-[#121015] border border-[#2b2630] p-8 rounded-3xl shadow-2xl w-full max-w-md flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle size={32} className="text-rose-500" />
            </div>
            <Typography
              variant="pageTitle"
              as="h2"
              className="text-[#fbf8f9] mb-2"
            >
              Clear History?
            </Typography>
            <Typography variant="body" as="p" className="text-[#aaa3b4] mb-8">
              This will remove all files from your library. Your actual PDF
              files on your computer will not be deleted.
            </Typography>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowConfirmClear(false)}
                className="flex-1 px-4 py-3 rounded-xl bg-[#19161c] text-[#aaa3b4] hover:text-[#fbf8f9] hover:bg-[#2b2630] transition-colors font-medium border border-[#2b2630]"
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
