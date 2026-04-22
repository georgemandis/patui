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
  brushW: number;
  brushH: number;
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

/** Map a grid cell to source region with separate width/height brush dimensions */
export function cellToSourceRegion(crop: CropRegion, col: number, row: number, brushW: number = 1, brushH: number = 1): { x: number; y: number; w: number; h: number } {
  const srcPixelW = crop.w / crop.gridW;
  const srcPixelH = crop.h / crop.gridH;
  const halfW = Math.floor(brushW / 2);
  const halfH = Math.floor(brushH / 2);
  const startCol = col - halfW;
  const startRow = row - halfH;
  return {
    x: Math.floor(crop.x + (startCol / crop.gridW) * crop.w),
    y: Math.floor(crop.y + (startRow / crop.gridH) * crop.h),
    w: Math.ceil(srcPixelW * brushW),
    h: Math.ceil(srcPixelH * brushH),
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
