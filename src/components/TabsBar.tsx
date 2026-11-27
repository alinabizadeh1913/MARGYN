"use client";

import React, { useRef, useState, useEffect } from "react";
import { useContextMenu } from "@/providers/ContextMenuProvider";
import { ToolState } from "@/providers/ToolProvider";
import {
  FileText,
  FolderArchive,
  X,
  MoreHorizontal,
  Files,
  Save,
  Upload,
  FilePlus,
  ArrowRight,
  Move, // ✅ NEW
} from "lucide-react";
import Typography from "@/typography";

export interface OpenTab {
  id: string;
  name: string;
  filePath: string;
  pdfData: Uint8Array;
  projectPath: string | null;
  isDirty: boolean;
  totalPages: number;
  currentPage: number;
  isCompleted: boolean;
  scale: number;
  canvasBg: string;
  isBlank?: boolean;
  isInfinite?: boolean; // ✅ NEW
  toolState?: ToolState;
  snapshot?: {
    drawings: any[];
    recentFile: any;
    sessions: any[];
  };
}

interface TabsBarProps {
  tabs: OpenTab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (e: React.MouseEvent, id: string) => void;
  onCloseMultipleTabs: (tabIds: string[]) => void;
  onReorderTabs: (draggedIndex: number, hoveredIndex: number) => void;
}

export default function TabsBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onCloseMultipleTabs,
  onReorderTabs,
}: TabsBarProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLDivElement>(null);

  const { openMenu } = useContextMenu();

  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  }, [activeTabId]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft += e.deltaY;
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => {
      if (e.target instanceof HTMLElement) e.target.style.opacity = "0.5";
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.target instanceof HTMLElement) e.target.style.opacity = "1";
    setDraggedIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    onReorderTabs(draggedIndex, index);
    setDraggedIndex(index);
  };

  if (tabs.length === 0) return null;

  return (
    <div className="w-full h-12 bg-gradient-to-b from-nm-deep to-nm-deep border-b border-nm-edge flex items-center relative z-[60] select-none shrink-0 group/tabs transition-colors duration-300">
      <div
        ref={scrollContainerRef}
        onWheel={handleWheel}
        className="flex-1 min-w-0 flex items-center overflow-x-auto overflow-y-hidden h-full gap-1 px-2 py-1 tabs-scrollbar opacity-60 group-hover/tabs:opacity-100 transition-opacity duration-300"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const isProject = !!tab.projectPath;
          const isBlank = !!tab.isBlank;
          const isInfinite = !!tab.isInfinite;

          const projectName = isProject
            ? tab.projectPath!.split(/[/\\]/).pop()?.replace(".margyn", "")
            : null;
          const displayName = projectName || tab.name || "Untitled";

          return (
            <div
              key={tab.id}
              ref={isActive ? activeTabRef : null}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onClick={() => onSelectTab(tab.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (tab.id !== activeTabId) onSelectTab(tab.id);

                const tabIndex = tabs.findIndex((t) => t.id === tab.id);
                const tabsToRight = tabs.slice(tabIndex + 1).map((t) => t.id);
                const otherTabs = tabs
                  .filter((t) => t.id !== tab.id)
                  .map((t) => t.id);

                openMenu(e.clientX, e.clientY, [
                  {
                    label: "Close Tab",
                    icon: X,
                    shortcut: "Ctrl+W",
                    onClick: () =>
                      onCloseTab(
                        { stopPropagation: () => {} } as React.MouseEvent,
                        tab.id,
                      ),
                  },
                  {
                    label: "Close Other Tabs",
                    icon: Files,
                    onClick: () => {
                      onCloseMultipleTabs(otherTabs);
                    },
                  },
                  {
                    label: "Close Tabs to the Right",
                    icon: ArrowRight,
                    disabled: tabsToRight.length === 0,
                    onClick: () => {
                      onCloseMultipleTabs(tabsToRight);
                    },
                  },
                  { separator: true },
                  {
                    label: "Save Project",
                    icon: Save,
                    shortcut: "Ctrl+S",
                    onClick: () =>
                      window.dispatchEvent(
                        new CustomEvent("margyn-shortcut", {
                          detail: "ctrl+s",
                        }),
                      ),
                  },
                  {
                    label: "Export Project",
                    icon: Upload,
                    shortcut: "Ctrl+E",
                    onClick: () =>
                      window.dispatchEvent(
                        new CustomEvent("margyn-shortcut", {
                          detail: "ctrl+e",
                        }),
                      ),
                  },
                ]);
              }}
              className={`group flex items-center gap-2 px-3 h-9 rounded-lg cursor-pointer transition-all duration-200 border max-w-[240px] shrink-0 ${
                isActive
                  ? "bg-nm-raise border-nm-edge text-nm-text shadow-nm-float translate-y-[-1px]"
                  : "bg-transparent border-transparent text-nm-muted hover:bg-nm-panel hover:border-nm-edge"
              } ${draggedIndex === index ? "opacity-50" : ""}`}
            >
              <div
                className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                  isInfinite
                    ? "bg-nm-ember/20 text-nm-ember"
                    : isBlank
                      ? "bg-nm-accent/20 text-nm-accent"
                      : isProject
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-rose-500/20 text-rose-400"
                }`}
              >
                {isInfinite ? (
                  <Move size={12} />
                ) : isBlank ? (
                  <FilePlus size={12} />
                ) : isProject ? (
                  <FolderArchive size={12} />
                ) : (
                  <FileText size={12} />
                )}
              </div>

              <Typography
                variant="caption"
                className={`truncate font-medium flex-1 ${isActive ? "text-nm-text" : "text-nm-muted"}`}
                title={displayName}
              >
                {displayName}
              </Typography>

              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider shrink-0 ${
                  isInfinite
                    ? "bg-nm-ember/10 text-nm-ember border border-nm-ember/20"
                    : isBlank
                      ? "bg-nm-accent/10 text-nm-accent border border-nm-accent/20"
                      : isProject
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                }`}
              >
                {isInfinite
                  ? "CANVAS"
                  : isBlank
                    ? "BLANK"
                    : isProject
                      ? "MARGYN"
                      : "PDF"}
              </span>

              {tab.isDirty && (
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              )}

              <button
                onClick={(e) => onCloseTab(e, tab.id)}
                className={`p-1 rounded-md transition-colors shrink-0 hover:bg-rose-500/20 text-nm-dim hover:text-rose-400`}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <div
        className="pl-2 pr-2 border-l border-nm-edge h-6 flex items-center shrink-0 bg-nm-deep z-10 opacity-60 group-hover/tabs:opacity-100 transition-opacity duration-300"
        ref={dropdownRef}
      >
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`p-1.5 rounded-md transition-colors ${
            showDropdown
              ? "bg-nm-line text-white"
              : "text-nm-muted hover:bg-nm-raise hover:text-white"
          }`}
        >
          <MoreHorizontal size={18} />
        </button>

        {showDropdown && (
          <div className="absolute top-12 right-2 w-64 bg-nm-panel border border-nm-edge rounded-xl shadow-2xl py-2 z-[100] flex flex-col max-h-64 overflow-y-auto">
            <div className="px-3 pb-2 mb-2 border-b border-nm-edge">
              <Typography variant="microLabel" className="text-nm-dim">
                Open Tabs ({tabs.length})
              </Typography>
            </div>
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const isProject = !!tab.projectPath;
              const isBlank = !!tab.isBlank;
              const isInfinite = !!tab.isInfinite;
              const projectName = isProject
                ? tab.projectPath!.split(/[/\\]/).pop()?.replace(".margyn", "")
                : null;
              const displayName = projectName || tab.name || "Untitled";

              return (
                <div
                  key={tab.id}
                  onClick={() => {
                    onSelectTab(tab.id);
                    setShowDropdown(false);
                  }}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                    isActive ? "bg-nm-raise" : "hover:bg-nm-raise"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                      isInfinite
                        ? "bg-nm-ember/20 text-nm-ember"
                        : isBlank
                          ? "bg-nm-accent/20 text-nm-accent"
                          : isProject
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-rose-500/20 text-rose-400"
                    }`}
                  >
                    {isInfinite ? (
                      <Move size={14} />
                    ) : isBlank ? (
                      <FilePlus size={14} />
                    ) : isProject ? (
                      <FolderArchive size={14} />
                    ) : (
                      <FileText size={14} />
                    )}
                  </div>
                  <Typography
                    variant="caption"
                    className={`truncate flex-1 ${isActive ? "text-nm-text font-medium" : "text-nm-muted"}`}
                  >
                    {displayName}
                  </Typography>
                  {tab.isDirty && (
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .tabs-scrollbar::-webkit-scrollbar {
          height: 4px;
        }
        .tabs-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .tabs-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .tabs-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
