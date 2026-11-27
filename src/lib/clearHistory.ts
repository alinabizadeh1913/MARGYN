/**
 * Undo/redo support for "clear page" and "clear all pages".
 *
 * Every mounted ink canvas keeps its own undo history. A clear operation is
 * stored there as a normal history entry (so Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z
 * work), and is tagged with a shared *group id* so that undoing it on one
 * canvas restores every other canvas / page that was cleared by the same
 * action. For "clear all" we also keep a snapshot of the DB rows so pages
 * that are not currently mounted are restored too.
 */
import { restoreDrawings, clearAllDrawings } from "@/db";

export interface ClearGroup {
  id: string;
  filePath: string;
  /** DB rows of the whole document taken right before "clear all". */
  rows: any[];
  /** true while the clear is in effect (false after it was undone). */
  active: boolean;
}

const MAX_GROUPS = 10;
const groups = new Map<string, ClearGroup>();

/** history entry (array of strokes) -> group id, for the "before clear" state */
export const undoMarks = new WeakMap<object, string>();
/** history entry -> group id, for the "after clear" (empty) state */
export const redoMarks = new WeakMap<object, string>();

export function newGroupId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function registerClearGroup(g: ClearGroup) {
  groups.set(g.id, g);
  while (groups.size > MAX_GROUPS) {
    const first = groups.keys().next().value;
    if (first === undefined) break;
    groups.delete(first);
  }
}

export function getActiveClearGroup(filePath: string): ClearGroup | null {
  let found: ClearGroup | null = null;
  for (const g of groups.values()) {
    if (g.filePath === filePath && g.active) found = g;
  }
  return found;
}

/** Called after a canvas undid a tagged entry: restore everything else. */
export async function undoClearGroup(gid: string, origin: object) {
  const g = groups.get(gid);
  try {
    if (g) {
      g.active = false;
      await restoreDrawings(g.rows, g.filePath);
    }
  } catch (e) {
    console.error("Failed to restore cleared drawings", e);
  }
  window.dispatchEvent(
    new CustomEvent("margyn-group-undo", { detail: { gid, origin } }),
  );
}

/** Called after a canvas redid a tagged entry: clear everything else again. */
export async function redoClearGroup(gid: string, origin: object) {
  const g = groups.get(gid);
  try {
    if (g) {
      g.active = true;
      await clearAllDrawings(g.filePath);
    }
  } catch (e) {
    console.error("Failed to re-clear drawings", e);
  }
  window.dispatchEvent(
    new CustomEvent("margyn-group-redo", { detail: { gid, origin } }),
  );
}
