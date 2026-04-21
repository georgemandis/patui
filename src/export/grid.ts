import type { RGB } from "../core/image-buffer.js";
import { useStore } from "../state/store.js";

/**
 * Build an export grid using cropAndResize — matches what Canvas shows.
 * Overlays edit layer on top.
 */
export async function buildExportGrid(): Promise<RGB[][]> {
  const { image, editLayer, cropRegion } = useStore.getState();
  if (!image || !cropRegion) throw new Error("No image loaded");

  const resized = await image.cropAndResize(
    cropRegion.x, cropRegion.y, cropRegion.w, cropRegion.h,
    cropRegion.gridW, cropRegion.gridH,
  );

  const grid: RGB[][] = [];
  for (let row = 0; row < resized.height; row++) {
    const rowData: RGB[] = [];
    for (let col = 0; col < resized.width; col++) {
      // Check edit layer
      const srcX = Math.floor(cropRegion.x + (col / cropRegion.gridW) * cropRegion.w);
      const srcY = Math.floor(cropRegion.y + (row / cropRegion.gridH) * cropRegion.h);
      const editColor = editLayer?.getPixel(srcX, srcY);
      if (editColor) {
        rowData.push(editColor);
      } else {
        rowData.push(resized.getPixel(col, row));
      }
    }
    grid.push(rowData);
  }
  return grid;
}
