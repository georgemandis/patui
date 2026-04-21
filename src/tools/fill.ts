import type { Tool, ToolContext, ToolResult } from "./types.js";
import type { RGB } from "../core/image-buffer.js";
import { cellToSource, cellToSourceRegion } from "./types.js";

export class FillTool implements Tool {
  name = "fill";

  apply(ctx: ToolContext): ToolResult {
    if (!ctx.cropRegion) return {};
    const crop = ctx.cropRegion;

    // Get the color at cursor position from the source image
    const cursorSrc = cellToSource(crop, ctx.col, ctx.row);
    const editColor = ctx.editLayer.getPixel(cursorSrc.x, cursorSrc.y);
    const targetColor = editColor ?? ctx.image.getPixel(
      Math.min(cursorSrc.x, ctx.image.width - 1),
      Math.min(cursorSrc.y, ctx.image.height - 1),
    );

    if (targetColor.r === ctx.fgColor.r && targetColor.g === ctx.fgColor.g && targetColor.b === ctx.fgColor.b) {
      return {};
    }

    const newLayer = ctx.editLayer.clone();
    const visited = new Set<string>();
    const stack: [number, number][] = [[ctx.col, ctx.row]];
    const tolerance = 30;

    while (stack.length > 0) {
      const [c, r] = stack.pop()!;
      const key = `${c},${r}`;
      if (visited.has(key)) continue;
      if (c < 0 || c >= crop.gridW || r < 0 || r >= crop.gridH) continue;

      // Get color at this grid cell
      const src = cellToSource(crop, c, r);
      const cellEditColor = ctx.editLayer.getPixel(src.x, src.y);
      const cellColor = cellEditColor ?? ctx.image.getPixel(
        Math.min(src.x, ctx.image.width - 1),
        Math.min(src.y, ctx.image.height - 1),
      );

      if (!this.colorsMatch(cellColor, targetColor, tolerance)) continue;

      visited.add(key);
      const region = cellToSourceRegion(crop, c, r);
      newLayer.paintRegion(region.x, region.y, region.w, region.h, ctx.fgColor);

      stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
    }

    return { editLayer: newLayer };
  }

  private colorsMatch(a: RGB, b: RGB, tolerance: number): boolean {
    return Math.abs(a.r - b.r) <= tolerance
      && Math.abs(a.g - b.g) <= tolerance
      && Math.abs(a.b - b.b) <= tolerance;
  }
}
