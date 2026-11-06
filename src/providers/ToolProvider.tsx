"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
  useCallback,
} from "react";
import { getSetting, setSetting } from "@/db";
import { useShortcuts } from "./ShortcutProvider";

export type ToolType =
  | "select"
  | "pen"
  | "eraser"
  | "highlighter"
  | "rectangle"
  | "circle"
  | "line"
  | "arrow";

export const DEFAULT_COLORS = [
  "#ffffff",
  "#000000",
  "#38bdf8",
  "#f43f5e",
  "#10b981",
  "#f59e0b",
  "#a855f7",
];

export interface ToolState {
  tool: ToolType;
  color: string;
  size: number;
  customColor: string;
}

const DEFAULT_STATE: ToolState = {
  tool: "pen",
  color: "#38bdf8",
  size: 12,
  customColor: "#ff00ff",
};

/** layout-independent (works with Persian keyboards too) */
const TOOL_KEYS: Record<string, ToolType> = {
  KeyV: "select",
  KeyP: "pen",
  KeyH: "highlighter",
  KeyE: "eraser",
  KeyR: "rectangle",
  KeyO: "circle",
  KeyL: "line",
  KeyA: "arrow",
};

interface ToolContextType extends ToolState {
  setTool: (t: ToolType) => void;
  setColor: (c: string) => void;
  updateCustomColor: (c: string) => Promise<void>;
  setSize: (s: number) => void;
}

const ToolContext = createContext<ToolContextType | undefined>(undefined);

export function ToolProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ToolState>(DEFAULT_STATE);
  const activeTabIdRef = useRef<string | null>(null);

  const { isShortcutsEnabled } = useShortcuts();
  const isShortcutsEnabledRef = useRef(isShortcutsEnabled);

  useEffect(() => {
    isShortcutsEnabledRef.current = isShortcutsEnabled;
  }, [isShortcutsEnabled]);

  // لود کردن رنگ سفارشی به عنوان پیش‌فرض اولیه
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedColor = await getSetting("customColor");
        if (savedColor) {
          setState((prev) => ({ ...prev, customColor: savedColor }));
        }
      } catch (err) {}
    };
    loadSettings();
  }, []);

  // گوش دادن به رویداد تغییر تب
  useEffect(() => {
    const handleTabSwitch = (
      e: CustomEvent<{ tabId: string | null; toolState?: ToolState }>,
    ) => {
      const { tabId, toolState } = e.detail;
      activeTabIdRef.current = tabId;

      if (toolState) {
        setState((prev) => ({
          ...prev,
          ...toolState,
        }));
      } else {
        // اگر تب جدیدی باز شده و وضعیتی ندارد، به حالت پیش‌فرض برگرد
        setState((prev) => ({
          ...DEFAULT_STATE,
          customColor: prev.customColor, // رنگ سفارشی کلی را حفظ کن
        }));
      }
    };

    window.addEventListener(
      "margyn-tab-switched",
      handleTabSwitch as EventListener,
    );
    return () => {
      window.removeEventListener(
        "margyn-tab-switched",
        handleTabSwitch as EventListener,
      );
    };
  }, []);

  // آپدیت کردن وضعیت و اطلاع‌رسانی به AppContent برای ذخیره در دیتابیس
  const updateState = useCallback((updates: Partial<ToolState>) => {
    setState((prev) => {
      const next = { ...prev, ...updates };
      if (activeTabIdRef.current) {
        window.dispatchEvent(
          new CustomEvent("margyn-tool-state-changed", {
            detail: { tabId: activeTabIdRef.current, toolState: next },
          }),
        );
      }
      return next;
    });
  }, []);

  const setTool = useCallback(
    (t: ToolType) => updateState({ tool: t }),
    [updateState],
  );
  const setColor = useCallback(
    (c: string) => updateState({ color: c }),
    [updateState],
  );
  const setSize = useCallback(
    (s: number) => updateState({ size: s }),
    [updateState],
  );

  const updateCustomColor = useCallback(
    async (c: string) => {
      updateState({ customColor: c, color: c });
      await setSetting("customColor", c);
    },
    [updateState],
  );

  // شورتکات‌های کیبورد
  useEffect(() => {
    const handleColorKeys = (e: KeyboardEvent) => {
      if (!isShortcutsEnabledRef.current) return;

      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const t = TOOL_KEYS[e.code];
        if (t) {
          setTool(t);
          return;
        }
      }

      if (e.code.startsWith("Digit")) {
        const num = parseInt(e.code.replace("Digit", ""), 10);
        if (num >= 1 && num <= DEFAULT_COLORS.length) {
          setColor(DEFAULT_COLORS[num - 1]);
        }
      }
    };
    window.addEventListener("keydown", handleColorKeys);
    return () => window.removeEventListener("keydown", handleColorKeys);
  }, [setTool, setColor]);

  return (
    <ToolContext.Provider
      value={{
        ...state,
        setTool,
        setColor,
        updateCustomColor,
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
