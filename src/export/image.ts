import sharp from "sharp";
import { useStore } from "../state/store.js";
import { applyFilters } from "./filters.js";
import { buildExportGrid } from "./grid.js";

export async function exportImage(filename: string, blockSize = 16) {
  const grid = await buildExportGrid();
  const { grayscale: gs, palette, dither } = useStore.getState();
  const filtered = applyFilters(grid, { grayscale: gs, palette, dither });

  const rows = filtered.length;
  const cols = filtered[0]?.length ?? 0;
  // Terminal cells are ~2x taller than wide. Match that ratio so the export
  // looks like what you see on screen: each cell → blockSize wide × blockSize*2 tall.
  const cellW = blockSize;
  const cellH = blockSize * 2;
  const outW = cols * cellW;
  const outH = rows * cellH;

  const pixels = Buffer.alloc(outW * outH * 3);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const color = filtered[r][c];
      for (let dy = 0; dy < cellH; dy++) {
        for (let dx = 0; dx < cellW; dx++) {
          const idx = ((r * cellH + dy) * outW + (c * cellW + dx)) * 3;
          pixels[idx] = Math.round(color.r);
          pixels[idx + 1] = Math.round(color.g);
          pixels[idx + 2] = Math.round(color.b);
        }
      }
    }
  }

  await sharp(pixels, { raw: { width: outW, height: outH, channels: 3 } })
    .toFile(filename);
}
