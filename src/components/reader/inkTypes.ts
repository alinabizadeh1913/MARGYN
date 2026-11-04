import type { ToolType } from "@/providers/ToolProvider";

export type Anchor = "top" | "right" | "bottom" | "left";

export interface Binding {
  id: string;
  anchor: Anchor;
}

export type StrokeTool = ToolType | "highlight-rect";

/**
 * Every drawn object. `points` are in "stored space"
 * (normalised 0..1 for PDF pages, raw px for the margin canvas).
 *  - pen:            N points
 *  - rectangle/circle/line/arrow: 2 points (opposite corners / endpoints)
 *  - highlight-rect: pairs of points  [left,top],[right,bottom], ...
 */
export interface Stroke {
  id?: string;
  points: number[][];
  color: string;
  size: number;
  tool?: StrokeTool;
  isEraser?: boolean; // legacy data only
  start?: Binding | null; // arrow start glued to a shape
  end?: Binding | null; // arrow end glued to a shape
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A horizontal run of text with the x position of every character boundary. */
export interface TextRun {
  left: number;
  right: number;
  xs: number[];
}

/** One visual line of text, in PDF-page CSS pixels. */
export interface TextLine {
  top: number;
  bottom: number;
  h: number;
  rtl: boolean;
  runs: TextRun[];
}

export type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
