"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getSetting, setSetting } from "@/db";

// Define available actions
export type ShortcutAction = 
  | "pen" 
  | "eraser" 
  | "toggleSession" 
  | "openPdf" 
  | "clearPage" 
  | "clearAll";

export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  pen: "p",
  eraser: "e",
  toggleSession: "s",
  openPdf: "o",
  clearPage: "delete",
  clearAll: "shift+delete",
};

interface ShortcutContextType {
  shortcuts: Record<ShortcutAction, string>;
  updateShortcut: (action: ShortcutAction, keys: string) => Promise<void>;
  resetShortcuts: () => Promise<void>;
}

const ShortcutContext = createContext<ShortcutContextType | undefined>(undefined);

export function ShortcutProvider({ children }: { children: ReactNode }) {
  const [shortcuts, setShortcuts] = useState<Record<ShortcutAction, string>>(DEFAULT_SHORTCUTS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load shortcuts from DB
  useEffect(() => {
    const loadShortcuts = async () => {
      try {
        const saved = await getSetting("shortcuts");
        if (saved) {
          setShortcuts({ ...DEFAULT_SHORTCUTS, ...JSON.parse(saved) });
        }
      } catch (err) {
        console.error("Failed to load shortcuts", err);
      } finally {
        setIsLoaded(true);
      }
    };
    loadShortcuts();
  }, []);

  const updateShortcut = async (action: ShortcutAction, keys: string) => {
    const updated = { ...shortcuts, [action]: keys };
    setShortcuts(updated);
    await setSetting("shortcuts", JSON.stringify(updated));
  };

  const resetShortcuts = async () => {
    setShortcuts(DEFAULT_SHORTCUTS);
    await setSetting("shortcuts", JSON.stringify(DEFAULT_SHORTCUTS));
  };

  // Global Listener for Shortcuts
  useEffect(() => {
    if (!isLoaded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Build the pressed key string (e.g., "shift+delete", "p")
      const keys = [];
      if (e.ctrlKey || e.metaKey) keys.push("ctrl");
      if (e.altKey) keys.push("alt");
      if (e.shiftKey) keys.push("shift");
      
      const key = e.key.toLowerCase();
      if (!["control", "shift", "alt", "meta"].includes(key)) {
        keys.push(key);
      }

      const pressedString = keys.join("+");

      // Dispatch a custom event that components can listen to
      const event = new CustomEvent("margyn-shortcut", { detail: pressedString });
      window.dispatchEvent(event);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoaded]);

  return (
    <ShortcutContext.Provider value={{ shortcuts, updateShortcut, resetShortcuts }}>
      {children}
    </ShortcutContext.Provider>
  );
}

export function useShortcuts() {
  const context = useContext(ShortcutContext);
  if (!context) throw new Error("useShortcuts must be used within ShortcutProvider");
  return context;
}

// Hook to register a specific shortcut
export function useShortcut(action: ShortcutAction, callback: () => void) {
  const { shortcuts } = useShortcuts();
  const expectedKey = shortcuts[action];

  useEffect(() => {
    const handleShortcut = (e: CustomEvent<string>) => {
      if (e.detail === expectedKey) {
        callback();
      }
    };
    window.addEventListener("margyn-shortcut", handleShortcut as EventListener);
    return () => window.removeEventListener("margyn-shortcut", handleShortcut as EventListener);
  }, [expectedKey, callback]);
}