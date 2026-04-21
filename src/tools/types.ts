import type { RGB } from "../core/image-buffer.js";
import type { EditLayer } from "../core/edit-layer.js";
import type { Viewport } from "../core/viewport.js";
import type { ImageBuffer } from "../core/image-buffer.js";

export interface CropRegion {
  x: number; y: number; w: number; h: number;
  gridW: number; gridH: number;
}

export interface ToolContext {
  image: ImageBuffer;
  editLayer: EditLayer;
  viewport: Viewport;
  fgColor: RGB;
  bgColor: RGB;
  brushSize: number;
  /** The viewport cell the cursor is on */
  col: number;
  row: number;
  /** Current crop region for mapping grid → source coords */
  cropRegion: CropRegion | null;
}

/** Map a grid cell to source pixel coordinates via the crop region */
export function cellToSource(crop: CropRegion, col: number, row: number): { x: number; y: number } {
  return {
    x: Math.floor(crop.x + (col / crop.gridW) * crop.w),
    y: Math.floor(crop.y + (row / crop.gridH) * crop.h),
  };
}

/** Map a grid cell to source region (for brush size > 1, use brushSize param) */
export function cellToSourceRegion(crop: CropRegion, col: number, row: number, brushSize: number = 1): { x: number; y: number; w: number; h: number } {
  const srcPixelW = crop.w / crop.gridW;
  const srcPixelH = crop.h / crop.gridH;
  const half = Math.floor(brushSize / 2);
  const startCol = col - half;
  const startRow = row - half;
  return {
    x: Math.floor(crop.x + (startCol / crop.gridW) * crop.w),
    y: Math.floor(crop.y + (startRow / crop.gridH) * crop.h),
    w: Math.ceil(srcPixelW * brushSize),
    h: Math.ceil(srcPixelH * brushSize),
  };
}

export interface ToolResult {
  editLayer?: EditLayer;
  fgColor?: RGB;
  switchToPreviousTool?: boolean;
}

export interface Tool {
  name: string;
  /** Called when the tool is activated (space/enter, or cursor move in paint mode) */
  apply(ctx: ToolContext): ToolResult;
}
