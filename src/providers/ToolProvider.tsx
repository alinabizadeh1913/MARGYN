"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

type ToolType = "pen" | "eraser";

interface ToolContextType {
  tool: ToolType;
  setTool: (t: ToolType) => void;
  color: string;
  setColor: (c: string) => void;
  size: number;
  setSize: (s: number) => void;
}

const ToolContext = createContext<ToolContextType | undefined>(undefined);

export function ToolProvider({ children }: { children: ReactNode }) {
  const [tool, setTool] = useState<ToolType>("pen");
  const [color, setColor] = useState("#38bdf8");
  const [size, setSize] = useState(4);

  return (
    <ToolContext.Provider
      value={{ tool, setTool, color, setColor, size, setSize }}
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
