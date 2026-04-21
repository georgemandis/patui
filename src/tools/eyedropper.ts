import type { Tool, ToolContext, ToolResult } from "./types.js";
import { cellToSource } from "./types.js";

export class EyedropperTool implements Tool {
  name = "eyedropper";

  apply(ctx: ToolContext): ToolResult {
    if (!ctx.cropRegion) return {};
    const src = cellToSource(ctx.cropRegion, ctx.col, ctx.row);
    // Try edit layer first, then source image
    const editColor = ctx.editLayer.getPixel(src.x, src.y);
    const color = editColor ?? ctx.image.getPixel(
      Math.min(src.x, ctx.image.width - 1),
      Math.min(src.y, ctx.image.height - 1),
    );
    return { fgColor: color, switchToPreviousTool: true };
  }
}
