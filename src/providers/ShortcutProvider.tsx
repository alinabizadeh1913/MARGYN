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
import {
  comboFromEvent,
  canonicalCombo,
  isTextEntryTarget,
} from "@/lib/keys";

// Bookkeeping that lets the DOM path and the Electron raw-key fallback path
// cooperate without ever firing the same key press twice.
const lastDomKey = { combo: "", t: 0 };
const lastFallbackKey = { combo: "", t: 0 };

export type ShortcutAction =
  | "pen"
  | "eraser"
  | "pan"
  | "increaseSize"
  | "decreaseSize"
  | "startSession"
  | "endSession"
  | "openPdf"
  | "closePdf"
  | "switchTab"
  | "nextTab" // ✅ NEW
  | "prevTab" // ✅ NEW
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
  pan: "g",
  increaseSize: "equal",
  decreaseSize: "minus",
  startSession: "ctrl+enter",
  endSession: "ctrl+shift+enter",
  openPdf: "ctrl+o",
  closePdf: "ctrl+w",
  switchTab: "ctrl+tab",
  nextTab: "ctrl+pagedown", // ✅ NEW
  prevTab: "ctrl+pageup", // ✅ NEW
  clearPage: "delete",
  clearAll: "ctrl+shift+delete",
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
              if (typeof v === "string") normalized[k] = canonicalCombo(v);
            }
            // migrate the old default (shift+delete) to ctrl+shift+delete
            if (normalized.clearAll === "shift+delete")
              normalized.clearAll = DEFAULT_SHORTCUTS.clearAll;
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
      const canon = canonicalCombo(keys);
      const isDuplicate = Object.entries(shortcuts).some(
        ([k, v]) => k !== action && canonicalCombo(v) === canon,
      );

      if (isDuplicate) {
        return {
          success: false,
          error: `Shortcut ${keys.toUpperCase()} is already in use.`,
        };
      }

      const updated = { ...shortcuts, [action]: canon };
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

  // Fallback path: the Electron main process forwards EVERY key press it sees
  // (before-input-event). If the DOM never delivered the same key (pen driver
  // quirks while the pen is touching the screen, odd focus state, ...), the
  // shortcut is dispatched from here instead.
  useEffect(() => {
    if (!isLoaded) return;
    const off = window.electronAPI?.onRawKey?.((k) => {
      if (k.repeat) return;
      const combo = comboFromEvent(k);
      if (!combo) return;
      const arrivedAt = performance.now();
      window.setTimeout(() => {
        if (!isShortcutsEnabledRef.current) return;
        if (
          lastDomKey.combo === combo &&
          Math.abs(lastDomKey.t - arrivedAt) < 200
        )
          return; // the DOM already saw (and handled) this key press
        if (isTextEntryTarget(document.activeElement)) return;
        lastFallbackKey.combo = combo;
        lastFallbackKey.t = performance.now();
        window.dispatchEvent(
          new CustomEvent("margyn-shortcut", { detail: combo }),
        );
      }, 80);
    });
    return () => {
      if (off) off();
    };
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const pressedString = comboFromEvent(e);
      if (!pressedString) return;

      // Record BEFORE any early return so the fallback path never duplicates us.
      lastDomKey.combo = pressedString;
      lastDomKey.t = performance.now();

      if (!isShortcutsEnabledRef.current) return;
      if (e.defaultPrevented) return;

      if (isTextEntryTarget(e.target) && pressedString !== "ctrl+w") return;

      if (
        pressedString === "ctrl+o" ||
        pressedString === "ctrl+w" ||
        pressedString === "ctrl+n" ||
        pressedString === "ctrl+t" ||
        pressedString === "ctrl+tab" ||
        pressedString === "ctrl+pagedown" ||
        pressedString === "ctrl+pageup" ||
        pressedString === "ctrl+enter" ||
        pressedString === "ctrl+shift+enter" ||
        pressedString === "ctrl+b" ||
        pressedString === "ctrl+s" ||
        pressedString === "ctrl+i" ||
        pressedString === "ctrl+e" ||
        pressedString === "equal" ||
        pressedString === "minus"
      ) {
        e.preventDefault();
      }

      // The fallback already fired this exact press (DOM event arrived late).
      if (
        lastFallbackKey.combo === pressedString &&
        performance.now() - lastFallbackKey.t < 300
      ) {
        return;
      }

      window.dispatchEvent(
        new CustomEvent("margyn-shortcut", { detail: pressedString }),
      );
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
  const expectedKey = canonicalCombo(shortcuts[action]);
  const cbRef = useRef(callback);

  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const handleShortcut = (e: CustomEvent<string>) => {
      if (canonicalCombo(e.detail) === expectedKey) cbRef.current();
    };
    window.addEventListener("margyn-shortcut", handleShortcut as EventListener);
    return () =>
      window.removeEventListener(
        "margyn-shortcut",
        handleShortcut as EventListener,
      );
  }, [expectedKey]);
}
