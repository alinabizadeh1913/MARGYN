"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { getSetting, setSetting } from "@/db";
import { useShortcuts } from "./ShortcutProvider"; // ✅ ایمپورت شد

type ToolType = "pen" | "eraser";

export const DEFAULT_COLORS = [
  "#ffffff",
  "#000000",
  "#38bdf8",
  "#f43f5e",
  "#10b981",
  "#f59e0b",
  "#a855f7",
];

interface ToolContextType {
  tool: ToolType;
  setTool: (t: ToolType) => void;
  color: string;
  setColor: (c: string) => void;
  customColor: string;
  updateCustomColor: (c: string) => Promise<void>;
  size: number;
  setSize: (s: number) => void;
  canvasBg: string;
  setCanvasBg: (c: string) => void;
}

const ToolContext = createContext<ToolContextType | undefined>(undefined);

export function ToolProvider({ children }: { children: ReactNode }) {
  const [tool, setTool] = useState<ToolType>("pen");
  const [color, setColor] = useState("#38bdf8");
  const [customColor, setCustomColor] = useState("#ff00ff");
  const [size, setSize] = useState(12);
  const [canvasBg, setCanvasBgState] = useState("#ffffff");

  // ✅ گرفتن استیت فعال بودن شورت‌کات‌ها
  const { isShortcutsEnabled } = useShortcuts();
  const isShortcutsEnabledRef = useRef(isShortcutsEnabled);

  useEffect(() => {
    isShortcutsEnabledRef.current = isShortcutsEnabled;
  }, [isShortcutsEnabled]);

  useEffect(() => {
    const handleColorKeys = (e: KeyboardEvent) => {
      // ✅ اگر شورت‌کات‌ها غیرفعال باشن، تغییر رنگ با اعداد کار نکنه
      if (!isShortcutsEnabledRef.current) return;

      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      if (e.code.startsWith("Digit")) {
        const num = parseInt(e.code.replace("Digit", ""), 10);
        if (num >= 1 && num <= DEFAULT_COLORS.length) {
          setTool("pen");
          setColor(DEFAULT_COLORS[num - 1]);
        }
      }
    };
    window.addEventListener("keydown", handleColorKeys);
    return () => window.removeEventListener("keydown", handleColorKeys);
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedColor = await getSetting("customColor");
        if (savedColor) {
          setCustomColor(savedColor);
        }
        const savedBg = localStorage.getItem("margyn_canvas_bg");
        if (savedBg) setCanvasBgState(savedBg);
      } catch (err) {
        console.error("Failed to load settings", err);
      }
    };
    loadSettings();
  }, []);

  const updateCustomColor = async (newColor: string) => {
    setCustomColor(newColor);
    setColor(newColor);
    await setSetting("customColor", newColor);
  };

  const setCanvasBg = (newColor: string) => {
    setCanvasBgState(newColor);
    localStorage.setItem("margyn_canvas_bg", newColor);
  };

  return (
    <ToolContext.Provider
      value={{
        tool,
        setTool,
        color,
        setColor,
        customColor,
        updateCustomColor,
        size,
        setSize,
        canvasBg,
        setCanvasBg,
      }}
    >
      {children}
    </ToolContext.Provider>
  );
}

export function useTool() {
  const context = useContext(ToolContext);
  if (!context) throw new Error("useTool must be used within ToolProvider");
  return context;
}
