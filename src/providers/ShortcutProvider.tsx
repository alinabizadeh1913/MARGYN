"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { getSetting, setSetting } from "@/db";

export type ShortcutAction =
  | "pen"
  | "eraser"
  | "startSession"
  | "endSession"
  | "openPdf"
  | "clearPage"
  | "clearAll"
  | "toggleMargin"
  | "saveProject";

export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  pen: "p",
  eraser: "e",
  startSession: "ctrl+enter",
  endSession: "ctrl+shift+enter",
  openPdf: "ctrl+o",
  clearPage: "delete",
  clearAll: "shift+delete",
  toggleMargin: "ctrl+b",
  saveProject: "ctrl+s",
};

interface ShortcutContextType {
  shortcuts: Record<ShortcutAction, string>;
  updateShortcut: (action: ShortcutAction, keys: string) => Promise<void>;
  resetShortcuts: () => Promise<void>;
}

const ShortcutContext = createContext<ShortcutContextType | undefined>(
  undefined,
);

export function ShortcutProvider({ children }: { children: ReactNode }) {
  const [shortcuts, setShortcuts] =
    useState<Record<ShortcutAction, string>>(DEFAULT_SHORTCUTS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadShortcuts = async () => {
      try {
        const saved = await getSetting("shortcuts");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            const validShortcuts = Object.keys(DEFAULT_SHORTCUTS).reduce(
              (acc, key) => {
                const k = key as ShortcutAction;
                let val = parsed[k] || DEFAULT_SHORTCUTS[k];

                if (val.includes("shiftleft") || val.includes("shiftright")) {
                  val = val
                    .replace("shiftleft", "shift")
                    .replace("shiftright", "shift");
                }
                if (
                  val.includes("controlleft") ||
                  val.includes("controlright")
                ) {
                  val = val
                    .replace("controlleft", "ctrl")
                    .replace("controlright", "ctrl");
                }
                acc[k] = val;
                return acc;
              },
              {} as Record<ShortcutAction, string>,
            );

            setShortcuts(validShortcuts);
            await setSetting("shortcuts", JSON.stringify(validShortcuts));
          } catch (parseError) {
            console.error("Corrupted shortcuts data, resetting to default.");
            await setSetting("shortcuts", JSON.stringify(DEFAULT_SHORTCUTS));
          }
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

  useEffect(() => {
    if (!isLoaded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const keys = [];
      if (e.ctrlKey || e.metaKey) keys.push("ctrl");
      if (e.altKey) keys.push("alt");
      if (e.shiftKey) keys.push("shift");

      let key = e.code;
      if (key.startsWith("Key")) key = key.replace("Key", "").toLowerCase();
      else if (key.startsWith("Digit")) key = key.replace("Digit", "");
      else if (key.startsWith("Numpad")) key = key.replace("Numpad", "");
      else if (key === "Delete") key = "delete";
      else if (key === "Backspace") key = "backspace";
      else if (key === "Space") key = "space";
      else if (key === "Enter") key = "enter";
      else key = key.toLowerCase();

      if (
        ![
          "control",
          "shift",
          "alt",
          "meta",
          "controlleft",
          "controlright",
          "shiftleft",
          "shiftright",
          "altleft",
          "altright",
          "metaleft",
          "metaright",
        ].includes(key)
      ) {
        keys.push(key);
      }

      const pressedString = keys.join("+");

      if (
        pressedString === "ctrl+o" ||
        pressedString === "ctrl+enter" ||
        pressedString === "ctrl+shift+enter" ||
        pressedString === "ctrl+b" ||
        pressedString === "ctrl+s"
      ) {
        e.preventDefault();
      }

      const event = new CustomEvent("margyn-shortcut", {
        detail: pressedString,
      });
      window.dispatchEvent(event);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoaded]);

  return (
    <ShortcutContext.Provider
      value={{ shortcuts, updateShortcut, resetShortcuts }}
    >
      {children}
    </ShortcutContext.Provider>
  );
}

export function useShortcuts() {
  const context = useContext(ShortcutContext);
  if (!context)
    throw new Error("useShortcuts must be used within ShortcutProvider");
  return context;
}

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
    return () =>
      window.removeEventListener(
        "margyn-shortcut",
        handleShortcut as EventListener,
      );
  }, [expectedKey, callback]);
}
