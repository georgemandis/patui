import { useStore } from "../state/store.js";
import { applyFilters } from "./filters.js";
import { buildExportGrid } from "./grid.js";

export function generateAnsi(withColor: boolean): string {
  const { grayscale: gs, palette, dither, cropRegion, image, editLayer } = useStore.getState();
  if (!image || !cropRegion) throw new Error("No image loaded");

  // Build grid synchronously from the current resized state
  // For sync export, we just read pixels directly from source at crop resolution
  const grid = buildExportGridSync();
  const filtered = applyFilters(grid, { grayscale: gs, palette, dither });

  let output = "";
  for (const row of filtered) {
    for (const pixel of row) {
      const r = Math.round(pixel.r);
      const g = Math.round(pixel.g);
      const b = Math.round(pixel.b);
      if (withColor) {
        output += `\x1b[38;2;${r};${g};${b}m\u2588`;
      } else {
        output += "\u2588";
      }
    }
    output += withColor ? "\x1b[0m\n" : "\n";
  }
  return output;
}

export async function exportAnsi(filename: string, withColor: boolean) {
  // Use async grid builder for better quality
  const grid = await buildExportGrid();
  const { grayscale: gs, palette, dither } = useStore.getState();
  const filtered = applyFilters(grid, { grayscale: gs, palette, dither });

  let output = "";
  for (const row of filtered) {
    for (const pixel of row) {
      const r = Math.round(pixel.r);
      const g = Math.round(pixel.g);
      const b = Math.round(pixel.b);
      if (withColor) {
        output += `\x1b[38;2;${r};${g};${b}m\u2588`;
      } else {
        output += "\u2588";
      }
    }
    output += withColor ? "\x1b[0m\n" : "\n";
  }
  await Bun.write(filename, output);
}

import type { RGB } from "../core/image-buffer.js";

/** Sync fallback: sample from source image using cropRegion */
function buildExportGridSync(): RGB[][] {
  const { image, editLayer, cropRegion } = useStore.getState();
  if (!image || !cropRegion) throw new Error("No image loaded");

  const grid: RGB[][] = [];
  for (let row = 0; row < cropRegion.gridH; row++) {
    const rowData: RGB[] = [];
    for (let col = 0; col < cropRegion.gridW; col++) {
      const srcX = Math.floor(cropRegion.x + (col / cropRegion.gridW) * cropRegion.w);
      const srcY = Math.floor(cropRegion.y + (row / cropRegion.gridH) * cropRegion.h);
      const editColor = editLayer?.getPixel(srcX, srcY);
      if (editColor) {
        rowData.push(editColor);
      } else {
        rowData.push(image.getPixel(
          Math.min(srcX, image.width - 1),
          Math.min(srcY, image.height - 1),
        ));
      }
    }
    grid.push(rowData);
  }
  return grid;
}
