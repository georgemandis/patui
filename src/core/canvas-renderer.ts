import type { RGB } from "./image-buffer.js";

export class CanvasRenderer {
  private offsetX: number; // terminal column where canvas starts
  private offsetY: number; // terminal row where canvas starts
  private width: number;
  private height: number;
  private lastFrame: RGB[][] | null = null;

  constructor(offsetX: number, offsetY: number, width: number, height: number) {
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.width = width;
    this.height = height;
  }

  private lastCursorCol: number = -1;
  private lastCursorRow: number = -1;

  private lastBrushSize: number = 1;

  /** Render a full grid, only writing cells that changed from last frame */
  render(grid: RGB[][], cursorCol?: number, cursorRow?: number, cursorVisible: boolean = true, brushSize: number = 1) {
    let output = "";
    const half = Math.floor(brushSize / 2);

    for (let row = 0; row < Math.min(grid.length, this.height); row++) {
      for (let col = 0; col < Math.min(grid[row].length, this.width); col++) {
        const pixel = grid[row][col];
        const prev = this.lastFrame?.[row]?.[col];

        const inCursor = cursorCol !== undefined && cursorRow !== undefined
          && col >= cursorCol - half && col < cursorCol - half + brushSize
          && row >= cursorRow - half && row < cursorRow - half + brushSize;
        const inLastCursor = col >= this.lastCursorCol - Math.floor(this.lastBrushSize / 2)
          && col < this.lastCursorCol - Math.floor(this.lastBrushSize / 2) + this.lastBrushSize
          && row >= this.lastCursorRow - Math.floor(this.lastBrushSize / 2)
          && row < this.lastCursorRow - Math.floor(this.lastBrushSize / 2) + this.lastBrushSize;
        const changed = !prev || prev.r !== pixel.r || prev.g !== pixel.g || prev.b !== pixel.b || inCursor || inLastCursor;

        if (changed) {
          // Move cursor to position
          output += `\x1b[${this.offsetY + row + 1};${this.offsetX + col + 1}H`;
          if (inCursor && cursorVisible) {
            // Rainbow cursor — cycle hue, render as ▒ with bright FG over pixel BG
            const hue = (Date.now() / 4) % 360;
            const rgb = hslToRgb(hue, 100, 60);
            output += `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]};48;2;${pixel.r};${pixel.g};${pixel.b}m\u2592\x1b[0m`;
          } else {
            output += `\x1b[38;2;${pixel.r};${pixel.g};${pixel.b}m\u2588\x1b[0m`;
          }
        }
      }
    }

    this.lastCursorCol = cursorCol ?? -1;
    this.lastCursorRow = cursorRow ?? -1;
    this.lastBrushSize = brushSize;

    if (output) {
      process.stdout.write(output);
    }

    this.lastFrame = grid.map(row => row.map(c => ({ ...c })));
  }

  /** Force full redraw on next render */
  invalidate() {
    this.lastFrame = null;
  }

  updatePosition(offsetX: number, offsetY: number, width: number, height: number) {
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.width = width;
    this.height = height;
    this.invalidate();
  }
}

/** Convert HSL (h: 0-360, s: 0-100, l: 0-100) to [r, g, b] (0-255) */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
