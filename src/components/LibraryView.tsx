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
  ArrowUpRight,
  CheckCircle2,
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

  const pdfCount = files.filter((f) => !f.projectPath).length;
  const projectCount = files.length - pdfCount;

  const nameOf = (file: RecentFile) => {
    const isProject = !!file.projectPath;
    const projectName = isProject
      ? file.projectPath!.split(/[/\\]/).pop()?.replace(".margyn", "")
      : null;
    return projectName || file.name || "Untitled Project";
  };

  const openFileMenu = (e: React.MouseEvent, file: RecentFile) => {
    e.preventDefault();
    e.stopPropagation();
    const isProject = !!file.projectPath;
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
  };

  const featured = filteredFiles[0];
  const rest = filteredFiles.slice(1);

  return (
    <div className="flex flex-col h-full w-full bg-nm-deep overflow-y-auto relative">
      {/* Hero */}
      <div className="mg-aurora border-b border-nm-edge">
        <div className="max-w-6xl w-full mx-auto px-10 pt-10 pb-7">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="text-nm-accent" size={16} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-nm-dim">
                  Your shelf
                </span>
              </div>
              <Typography
                variant="pageTitle"
                as="h1"
                className="text-nm-text"
              >
                Library
              </Typography>
              <Typography
                variant="body"
                as="p"
                className="text-nm-muted max-w-xl mt-2"
              >
                Quickly jump back into your recent documents. Your annotations
                will be exactly where you left them.
              </Typography>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onImportProject}
                className="flex items-center gap-2 px-4 py-2 text-sm text-nm-accent bg-nm-accent/10 border border-nm-accent/25 rounded-xl hover:bg-nm-accent/20 transition-colors font-medium"
              >
                <Download size={16} />
                Import Project
              </button>
              {files.length > 0 && (
                <button
                  onClick={() => setShowConfirmClear(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-nm-muted border border-nm-edge rounded-xl hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-colors font-medium"
                >
                  <Trash2 size={16} />
                  Clear History
                </button>
              )}
            </div>
          </div>

          {/* Underline tabs */}
          <div className="flex items-center gap-6 mt-8">
            {(
              [
                { id: "pdfs", label: "PDF Documents", icon: FileText, n: pdfCount },
                { id: "projects", label: "Projects", icon: FolderArchive, n: projectCount },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`relative flex items-center gap-2 pb-3 text-sm font-medium transition-colors ${
                  activeTab === t.id
                    ? "text-nm-text"
                    : "text-nm-dim hover:text-nm-muted"
                }`}
              >
                <t.icon size={15} />
                {t.label}
                <span
                  className={`px-1.5 py-px rounded-md text-[10px] font-bold tabular-nums ${
                    activeTab === t.id
                      ? "bg-nm-accent/15 text-nm-hot"
                      : "bg-nm-raise text-nm-dim"
                  }`}
                >
                  {t.n}
                </span>
                {activeTab === t.id && (
                  <span className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-nm-accent" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl w-full mx-auto px-10 py-8">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-7 h-7 border-[3px] border-nm-line border-t-nm-accent rounded-full animate-spin"></div>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="mg-dots flex flex-col items-center justify-center text-center py-24 rounded-3xl border border-dashed border-nm-edge-strong">
            <div className="w-16 h-16 rounded-2xl bg-nm-panel border border-nm-edge flex items-center justify-center mb-5">
              {activeTab === "pdfs" ? (
                <FileText size={28} className="text-nm-dim" />
              ) : (
                <FolderArchive size={28} className="text-nm-dim" />
              )}
            </div>
            <Typography
              variant="cardTitle"
              className="text-nm-text mb-2 block"
            >
              No recent {activeTab === "pdfs" ? "PDFs" : "Projects"}
            </Typography>
            <Typography variant="body" className="text-nm-muted block">
              {activeTab === "pdfs"
                ? "Open a PDF to see it appear here."
                : "Export or Import a project to see it here."}
            </Typography>
          </div>
        ) : (
          <>
            {/* Continue reading */}
            {featured && (
              <div
                onClick={() => onSelectFile(featured.filePath)}
                onContextMenu={(e) => openFileMenu(e, featured)}
                className="mg-card group cursor-pointer p-6 mb-8 flex items-center justify-between gap-6 overflow-hidden"
              >
                <div className="flex items-center gap-5 min-w-0">
                  <div className="w-16 h-20 rounded-xl bg-nm-deep border border-nm-edge-strong flex items-center justify-center shrink-0">
                    {featured.projectPath ? (
                      <FolderArchive size={26} className="text-emerald-400" />
                    ) : (
                      <FileText size={26} className="text-rose-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-nm-accent">
                      Continue reading
                    </span>
                    <Typography
                      variant="cardTitle"
                      className="text-nm-text block line-clamp-1 mt-1.5"
                    >
                      {nameOf(featured)}
                    </Typography>
                    <div className="flex items-center gap-2 text-nm-dim mt-1.5">
                      <Clock size={12} />
                      <Typography variant="caption" className="text-nm-dim">
                        {formatDate(featured.lastOpened)}
                      </Typography>
                      {featured.completed === 1 && (
                        <span className="inline-flex items-center gap-1 ml-2 text-[10px] font-bold text-emerald-500">
                          <CheckCircle2 size={12} /> Completed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-nm-accent text-white text-sm font-medium">
                    Open <ArrowUpRight size={15} />
                  </span>
                  <button
                    onClick={(e) =>
                      handleDeleteSingle(e, featured.id, featured.filePath)
                    }
                    className="p-2.5 text-nm-dim hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove from history"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            )}

            {rest.length > 0 && (
              <div className="grid gap-4 grid-cols-1 min-[1000px]:grid-cols-2 min-[1500px]:grid-cols-3">
                {rest.map((file) => {
                  const isProject = !!file.projectPath;
                  return (
                    <div
                      key={file.id}
                      onClick={() => onSelectFile(file.filePath)}
                      onContextMenu={(e) => openFileMenu(e, file)}
                      className="mg-card mg-cv group cursor-pointer p-4 flex items-center gap-4 overflow-hidden"
                    >
                      <div className="w-11 h-14 rounded-lg bg-nm-deep border border-nm-edge flex items-center justify-center shrink-0 group-hover:border-nm-accent/30 transition-colors">
                        {isProject ? (
                          <FolderArchive
                            size={18}
                            className="text-emerald-400"
                          />
                        ) : (
                          <FileText size={18} className="text-rose-400" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <Typography
                          variant="cardTitle"
                          className="text-nm-text group-hover:text-nm-hot transition-colors line-clamp-1 block"
                        >
                          {nameOf(file)}
                        </Typography>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider shrink-0 ${isProject ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"}`}
                          >
                            {isProject ? "MARGYN" : "PDF"}
                          </span>
                          {file.completed === 1 && (
                            <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 text-[9px] font-bold rounded border border-emerald-500/20">
                              Completed
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-nm-dim min-w-0">
                            <Clock size={11} className="shrink-0" />
                            <Typography
                              variant="caption"
                              className="text-nm-dim truncate"
                            >
                              {formatDate(file.lastOpened)}
                            </Typography>
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={(e) =>
                          handleDeleteSingle(e, file.id, file.filePath)
                        }
                        className="p-2 text-nm-dim hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                        title="Remove from history"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {showConfirmClear && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60">
          <div className="bg-nm-panel border border-nm-edge-strong p-8 rounded-3xl shadow-nm-float w-full max-w-md flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mb-6">
              <AlertTriangle size={28} className="text-rose-500" />
            </div>
            <Typography
              variant="pageTitle"
              as="h2"
              className="text-nm-text mb-2"
            >
              Clear History?
            </Typography>
            <Typography variant="body" as="p" className="text-nm-muted mb-8">
              This will remove all files from your library. Your actual PDF
              files on your computer will not be deleted.
            </Typography>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setShowConfirmClear(false)}
                className="flex-1 px-4 py-3 rounded-xl bg-nm-raise text-nm-muted hover:text-nm-text hover:bg-nm-line transition-colors font-medium border border-nm-edge"
              >
                Cancel
              </button>
              <button
                onClick={handleClearHistory}
                className="flex-1 px-4 py-3 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-colors font-medium"
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
