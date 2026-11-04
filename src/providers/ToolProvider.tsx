"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { getSetting, setSetting } from "@/db";

type ToolType = "pen" | "eraser";

export const DEFAULT_COLORS = [
  "#ffffff", // 1 - White
  "#000000", // 2 - Black
  "#38bdf8", // 3 - Sky Blue
  "#f43f5e", // 4 - Rose
  "#10b981", // 5 - Emerald
  "#f59e0b", // 6 - Amber
  "#a855f7", // 7 - Purple
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

  // رنگ‌ها با کلیدهای 1 تا 7
  useEffect(() => {
    const handleColorKeys = (e: KeyboardEvent) => {
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
