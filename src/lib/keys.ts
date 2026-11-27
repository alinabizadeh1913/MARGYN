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

/* -------------------------------------------------------------------------
 * Unified shortcut normalisation
 *
 * One single place that turns a keyboard event (DOM event OR the raw key
 * descriptor forwarded by the Electron main process) into a canonical combo
 * string such as "delete", "ctrl+delete", "p", "equal", "ctrl+shift+enter".
 *
 * Why named keys trust `e.key` and not `e.code`:
 * pen drivers often inject Del / + / - with a *keypad* scancode, so
 * `e.code` is "NumpadDecimal" / "NumpadAdd" / "NumpadSubtract" while `e.key`
 * is still "Delete" / "+" / "-". Using `code` for those keys produced combos
 * like "decimal" that never matched the stored "delete".
 * ---------------------------------------------------------------------- */

export interface KeyLike {
  key?: string;
  code?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}

const IGNORED_KEYS = new Set([
  "Unidentified",
  "Dead",
  "Process",
  "Compose",
  "Unknown",
]);

const MODIFIER_TOKENS = new Set([
  "control",
  "ctrl",
  "shift",
  "alt",
  "altgraph",
  "meta",
  "os",
  "cmd",
]);

const TOKEN_ALIASES: Record<string, string> = {
  add: "equal",
  plus: "equal",
  "+": "equal",
  "=": "equal",
  subtract: "minus",
  "-": "minus",
  _: "minus",
  del: "delete",
  esc: "escape",
  " ": "space",
  spacebar: "space",
  return: "enter",
  numpadenter: "enter",
  numpaddecimal: "decimal",
  pgup: "pageup",
  pgdn: "pagedown",
};

/** Canonical token for the main key of an event ("" for pure modifiers). */
export function keyToken(e: KeyLike): string {
  const key = e.key ?? "";
  const code = e.code ?? "";

  // 1. Multi-character `key` = named key (Delete, PageDown, Enter, F5 ...).
  if (key.length > 1 && !IGNORED_KEYS.has(key)) {
    const t = key.toLowerCase();
    if (MODIFIER_TOKENS.has(t)) return "";
    return TOKEN_ALIASES[t] ?? t;
  }

  // 2. Layout independent `code` for letters / digits / +-= / space.
  if (code) {
    let m: RegExpExecArray | null;
    if ((m = /^Key([A-Z])$/.exec(code))) return m[1].toLowerCase();
    if ((m = /^(?:Digit|Numpad)(\d)$/.exec(code))) return m[1];
    if (code === "NumpadAdd" || code === "Equal") return "equal";
    if (code === "NumpadSubtract" || code === "Minus") return "minus";
    if (code === "NumpadDecimal") return "decimal";
    if (code === "Space") return "space";
    if (/^(Control|Shift|Alt|Meta)(Left|Right)?$/.test(code)) return "";
  }

  // 3. Single character `key`.
  if (key && !IGNORED_KEYS.has(key)) {
    const t = key.toLowerCase();
    return TOKEN_ALIASES[t] ?? t;
  }

  // 4. Nothing but `code`.
  if (code) {
    const t = code.toLowerCase();
    return TOKEN_ALIASES[t] ?? t;
  }
  return "";
}

function buildCombo(
  ctrl: boolean,
  alt: boolean,
  shift: boolean,
  token: string,
): string {
  // "+" / "-" need Shift on many layouts; a plain press must still match.
  if (shift && !ctrl && !alt && (token === "equal" || token === "minus"))
    shift = false;
  const parts: string[] = [];
  if (ctrl) parts.push("ctrl");
  if (alt) parts.push("alt");
  if (shift) parts.push("shift");
  parts.push(token);
  return parts.join("+");
}

/** Canonical combo string for an event ("" when only a modifier is held). */
export function comboFromEvent(e: KeyLike): string {
  const token = keyToken(e);
  if (!token) return "";
  return buildCombo(
    !!(e.ctrlKey || e.metaKey),
    !!e.altKey,
    !!e.shiftKey,
    token,
  );
}

/**
 * Canonical form of a *stored* combo, so old values ("add", "subtract",
 * "ctrl+DELETE", ...) compare equal to what comboFromEvent produces.
 */
export function canonicalCombo(combo: string): string {
  const raw = (combo ?? "").toLowerCase().trim();
  if (!raw) return "";
  const m = raw.match(/^((?:(?:ctrl|control|alt|shift|meta|cmd)\+)*)(.*)$/);
  const mods = m ? m[1] : "";
  let token = m ? m[2] : raw;
  if (!token) return "";
  token = TOKEN_ALIASES[token] ?? token;
  return buildCombo(
    /(?:ctrl|control|meta|cmd)\+/.test(mods),
    /alt\+/.test(mods),
    /shift\+/.test(mods),
    token,
  );
}

/** Text-entry targets only: a focused slider / checkbox must not eat shortcuts. */
const TEXT_INPUT_TYPES = new Set([
  "",
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
]);

export function isTextEntryTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === "TEXTAREA") return !(el as HTMLTextAreaElement).readOnly;
  if (el.tagName === "INPUT") {
    const i = el as HTMLInputElement;
    return TEXT_INPUT_TYPES.has((i.type || "text").toLowerCase()) && !i.readOnly;
  }
  return false;
}
