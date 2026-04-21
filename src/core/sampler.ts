import type { RGB } from "./image-buffer.js";
import type { ImageBuffer } from "./image-buffer.js";
import type { Viewport } from "./viewport.js";
import type { EditLayer } from "./edit-layer.js";

export class Sampler {
  static sample(
    image: ImageBuffer,
    viewport: Viewport,
    edits: EditLayer | null,
  ): RGB[][] {
    const { w: cols, h: rows } = viewport.getTermSize();
    const grid: RGB[][] = [];

    for (let row = 0; row < rows; row++) {
      const rowData: RGB[] = [];
      for (let col = 0; col < cols; col++) {
        const region = viewport.cellToSourceRegion(col, row);

        // Check if any edit covers this region
        if (edits) {
          const editColor = edits.getRegionColor(region.x, region.y, region.w, region.h);
          if (editColor) {
            rowData.push(editColor);
            continue;
          }
        }

        rowData.push(image.averageRegion(region.x, region.y, region.w, region.h));
      }
      grid.push(rowData);
    }

    return grid;
  }
}
