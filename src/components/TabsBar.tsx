"use client";

import React, { useRef, useState, useEffect } from "react";
import { FileText, FolderArchive, X, MoreHorizontal } from "lucide-react";
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
  // ✅ اسنپ‌شات کامل شامل سشن‌ها
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
  onReorderTabs: (draggedIndex: number, hoveredIndex: number) => void;
}

export default function TabsBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onReorderTabs,
}: TabsBarProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLDivElement>(null);

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
    <div className="w-full h-12 bg-[#09090b] border-b border-[#27272a] flex items-center relative z-[60] select-none shrink-0">
      <div
        ref={scrollContainerRef}
        onWheel={handleWheel}
        className="flex-1 flex items-center overflow-x-auto overflow-y-hidden h-full gap-1 px-2 py-1 tabs-scrollbar"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const isProject = !!tab.projectPath;

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
              className={`group flex items-center gap-2 px-3 h-9 rounded-lg cursor-pointer transition-all duration-200 border max-w-[240px] shrink-0 ${
                isActive
                  ? "bg-[#18181b] border-[#27272a] text-[#fafafa]"
                  : "bg-transparent border-transparent text-[#a1a1aa] hover:bg-[#121214] hover:border-[#27272a]"
              } ${draggedIndex === index ? "opacity-50" : ""}`}
            >
              <div
                className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                  isProject
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-rose-500/20 text-rose-400"
                }`}
              >
                {isProject ? (
                  <FolderArchive size={12} />
                ) : (
                  <FileText size={12} />
                )}
              </div>

              <Typography
                variant="caption"
                className={`truncate font-medium flex-1 ${isActive ? "text-[#fafafa]" : "text-[#a1a1aa]"}`}
                title={displayName}
              >
                {displayName}
              </Typography>

              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider shrink-0 ${isProject ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"}`}
              >
                {isProject ? "MARGYN" : "PDF"}
              </span>

              {tab.isDirty && (
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              )}

              <button
                onClick={(e) => onCloseTab(e, tab.id)}
                className={`p-1 rounded-md transition-colors shrink-0 hover:bg-rose-500/20 text-[#52525b] hover:text-rose-400`}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <div
        className="pl-2 pr-2 border-l border-[#27272a] h-6 flex items-center shrink-0"
        ref={dropdownRef}
      >
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`p-1.5 rounded-md transition-colors ${
            showDropdown
              ? "bg-[#27272a] text-white"
              : "text-[#a1a1aa] hover:bg-[#18181b] hover:text-white"
          }`}
        >
          <MoreHorizontal size={18} />
        </button>

        {showDropdown && (
          <div className="absolute top-12 right-2 w-64 bg-[#121214] border border-[#27272a] rounded-xl shadow-2xl py-2 z-[100] flex flex-col max-h-64 overflow-y-auto">
            <div className="px-3 pb-2 mb-2 border-b border-[#27272a]">
              <Typography variant="microLabel" className="text-[#52525b]">
                Open Tabs ({tabs.length})
              </Typography>
            </div>
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              const isProject = !!tab.projectPath;
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
                    isActive ? "bg-[#18181b]" : "hover:bg-[#18181b]"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${isProject ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}
                  >
                    {isProject ? (
                      <FolderArchive size={14} />
                    ) : (
                      <FileText size={14} />
                    )}
                  </div>
                  <Typography
                    variant="caption"
                    className={`truncate flex-1 ${isActive ? "text-[#fafafa] font-medium" : "text-[#a1a1aa]"}`}
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
