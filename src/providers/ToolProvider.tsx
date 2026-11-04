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

interface ToolContextType {
  tool: ToolType;
  setTool: (t: ToolType) => void;
  color: string;
  setColor: (c: string) => void;
  customColor: string;
  updateCustomColor: (c: string) => Promise<void>;
  size: number;
  setSize: (s: number) => void;
}

const ToolContext = createContext<ToolContextType | undefined>(undefined);

export function ToolProvider({ children }: { children: ReactNode }) {
  const [tool, setTool] = useState<ToolType>("pen");
  const [color, setColor] = useState("#38bdf8");
  const [customColor, setCustomColor] = useState("#ff00ff"); // Default fallback
  const [size, setSize] = useState(12); // Default size changed to match new range

  // Load custom color on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedColor = await getSetting("customColor");
        if (savedColor) {
          setCustomColor(savedColor);
        }
      } catch (err) {
        console.error("Failed to load settings", err);
      }
    };
    loadSettings();
  }, []);

  const updateCustomColor = async (newColor: string) => {
    setCustomColor(newColor);
    setColor(newColor); // Automatically select the new custom color
    await setSetting("customColor", newColor);
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
