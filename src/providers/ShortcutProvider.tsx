"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import { getSetting, setSetting } from "@/db";

export type ShortcutAction =
  | "pen"
  | "eraser"
  | "increaseSize"
  | "decreaseSize"
  | "startSession"
  | "endSession"
  | "openPdf"
  | "closePdf"
  | "switchTab"
  | "clearPage"
  | "clearAll"
  | "toggleMargin"
  | "saveProject"
  | "importProject"
  | "exportProject"
  | "newBlank"
  | "note";

export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  pen: "p",
  eraser: "e",
  increaseSize: "add",
  decreaseSize: "subtract",
  startSession: "ctrl+enter",
  endSession: "ctrl+shift+enter",
  openPdf: "ctrl+o",
  closePdf: "ctrl+w",
  switchTab: "ctrl+tab",
  clearPage: "delete",
  clearAll: "shift+delete",
  toggleMargin: "ctrl+b",
  saveProject: "ctrl+s",
  importProject: "ctrl+i",
  exportProject: "ctrl+e",
  newBlank: "ctrl+n",
  note: "ctrl+t",
};

interface ShortcutContextType {
  shortcuts: Record<ShortcutAction, string>;
  updateShortcut: (
    action: ShortcutAction,
    keys: string,
  ) => Promise<{ success: boolean; error?: string }>;
  resetShortcuts: () => Promise<void>;
  isShortcutsEnabled: boolean;
  setShortcutsEnabled: (enabled: boolean) => void;
}

const ShortcutContext = createContext<ShortcutContextType | undefined>(
  undefined,
);

export function ShortcutProvider({ children }: { children: ReactNode }) {
  const [shortcuts, setShortcuts] =
    useState<Record<ShortcutAction, string>>(DEFAULT_SHORTCUTS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isShortcutsEnabled, setIsShortcutsEnabled] = useState(true);
  const isShortcutsEnabledRef = useRef(isShortcutsEnabled);

  useEffect(() => {
    isShortcutsEnabledRef.current = isShortcutsEnabled;
  }, [isShortcutsEnabled]);

  useEffect(() => {
    const loadShortcuts = async () => {
      try {
        const saved = await getSetting("shortcuts");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            const normalized: Record<string, string> = {};
            for (const [k, v] of Object.entries(parsed)) {
              if (typeof v === "string") normalized[k] = v.toLowerCase();
            }
            const validShortcuts = { ...DEFAULT_SHORTCUTS, ...normalized };
            setShortcuts(validShortcuts as Record<ShortcutAction, string>);
            await setSetting("shortcuts", JSON.stringify(validShortcuts));
          } catch {
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

  const updateShortcut = useCallback(
    async (action: ShortcutAction, keys: string) => {
      const isDuplicate = Object.entries(shortcuts).some(
        ([k, v]) => k !== action && v.toLowerCase() === keys.toLowerCase(),
      );

      if (isDuplicate) {
        return {
          success: false,
          error: `Shortcut ${keys.toUpperCase()} is already in use.`,
        };
      }

      const updated = { ...shortcuts, [action]: keys };
      setShortcuts(updated);
      await setSetting("shortcuts", JSON.stringify(updated));
      return { success: true };
    },
    [shortcuts],
  );

  const resetShortcuts = useCallback(async () => {
    setShortcuts(DEFAULT_SHORTCUTS);
    await setSetting("shortcuts", JSON.stringify(DEFAULT_SHORTCUTS));
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    const cleanup = window.electronAPI?.onShortcutTriggered((shortcut) => {
      if (!isShortcutsEnabledRef.current) return;
      window.dispatchEvent(
        new CustomEvent("margyn-shortcut", { detail: shortcut }),
      );
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isShortcutsEnabledRef.current) return;
      // ✅ FIX: اگه یه لیسنر دیگه (مثل useInkCanvas) این کلید رو هندل کرده
      // و preventDefault زده، دیگه شورتکات رو شلیک نکن.
      // (جلوگیری از باگ: Delete روی stroke انتخاب‌شده → کل صفحه پاک می‌شد)
      if (e.defaultPrevented) return;

      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      const keys: string[] = [];
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
      else if (key === "Tab") key = "tab";
      else if (key === "Equal") key = "equal";
      else if (key === "Minus") key = "minus";
      else key = key.toLowerCase();

      key = key.toLowerCase();

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

      let pressedString = keys.join("+");

      if (pressedString === "shift+equal") pressedString = "equal";
      if (pressedString === "shift+minus") pressedString = "minus";

      if (isInput && pressedString.toLowerCase() !== "ctrl+w") {
        return;
      }

      if (
        pressedString === "ctrl+o" ||
        pressedString === "ctrl+w" ||
        pressedString === "ctrl+n" ||
        pressedString === "ctrl+t" ||
        pressedString === "ctrl+tab" ||
        pressedString === "ctrl+enter" ||
        pressedString === "ctrl+shift+enter" ||
        pressedString === "ctrl+b" ||
        pressedString === "ctrl+s" ||
        pressedString === "ctrl+i" ||
        pressedString === "ctrl+e" ||
        pressedString === "equal" ||
        pressedString === "minus" ||
        pressedString === "add" ||
        pressedString === "subtract"
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

  const value = useMemo<ShortcutContextType>(
    () => ({
      shortcuts,
      updateShortcut,
      resetShortcuts,
      isShortcutsEnabled,
      setShortcutsEnabled: setIsShortcutsEnabled,
    }),
    [shortcuts, updateShortcut, resetShortcuts, isShortcutsEnabled],
  );

  return (
    <ShortcutContext.Provider value={value}>
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
  const cbRef = useRef(callback);

  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handleShortcut = (e: CustomEvent<string>) => {
      if (e.detail === expectedKey) cbRef.current();
    };
    window.addEventListener("margyn-shortcut", handleShortcut as EventListener);
    return () =>
      window.removeEventListener(
        "margyn-shortcut",
        handleShortcut as EventListener,
      );
  }, [expectedKey]);
}
