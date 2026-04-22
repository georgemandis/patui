import type { Tool, ToolContext, ToolResult } from "./types.js";
import { cellToSourceRegion } from "./types.js";

export class EraserTool implements Tool {
  name = "eraser";

  apply(ctx: ToolContext): ToolResult {
    if (!ctx.cropRegion) return {};
    const region = cellToSourceRegion(ctx.cropRegion, ctx.col, ctx.row, ctx.brushW, ctx.brushH);
    const newLayer = ctx.editLayer.clone();
    newLayer.paintRegion(region.x, region.y, region.w, region.h, ctx.bgColor);
    return { editLayer: newLayer };
  }
}
