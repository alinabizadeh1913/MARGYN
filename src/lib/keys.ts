/**
 * Robust keyboard identification.
 *
 * Drawing-tablet / pen drivers (Vinsa, Huion, XP-Pen, Gaomon, ...) usually
 * inject keystrokes by *virtual-key* only, with scancode 0. Chromium derives
 * `KeyboardEvent.code` from the scancode, so for those events `code` is an
 * empty string while `key` is still correct. Code that relies on `e.code`
 * therefore never sees pen-button shortcuts.
 *
 * `getKeyCode(e)` returns a value in the same format as `e.code`
 * ("KeyP", "Digit1", "Delete", "Space", "Minus", "Equal", ...), falling back to
 * `e.key` whenever `e.code` is missing.
 */
const NAMED: Record<string, string> = {
  " ": "Space",
  Spacebar: "Space",
  Delete: "Delete",
  Del: "Delete",
  Backspace: "Backspace",
  Enter: "Enter",
  Tab: "Tab",
  Escape: "Escape",
  Esc: "Escape",
  PageUp: "PageUp",
  PageDown: "PageDown",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  Home: "Home",
  End: "End",
  "-": "Minus",
  _: "Minus",
  "=": "Equal",
  "+": "Equal",
  Subtract: "Minus",
  Add: "Equal",
  Control: "ControlLeft",
  Shift: "ShiftLeft",
  Alt: "AltLeft",
  Meta: "MetaLeft",
};

export function getKeyCode(e: KeyboardEvent): string {
  if (e.code && e.code !== "Unidentified") return e.code;
  const k = e.key;
  if (!k || k === "Unidentified") return "";
  if (NAMED[k]) return NAMED[k];
  if (k.length === 1) {
    if (/[a-zA-Z]/.test(k)) return "Key" + k.toUpperCase();
    if (/[0-9]/.test(k)) return "Digit" + k;
  }
  if (/^F\d{1,2}$/.test(k)) return k;
  return k;
}

/** True for events that should never be treated as a shortcut by themselves. */
export function isModifierCode(code: string): boolean {
  return /^(Control|Shift|Alt|Meta)(Left|Right)?$/.test(code);
}

export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}
