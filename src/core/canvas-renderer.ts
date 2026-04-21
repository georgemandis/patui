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

  /** Render a full grid, only writing cells that changed from last frame */
  render(grid: RGB[][], cursorCol?: number, cursorRow?: number, cursorVisible: boolean = true) {
    let output = "";

    for (let row = 0; row < Math.min(grid.length, this.height); row++) {
      for (let col = 0; col < Math.min(grid[row].length, this.width); col++) {
        const pixel = grid[row][col];
        const prev = this.lastFrame?.[row]?.[col];

        const isCursor = col === cursorCol && row === cursorRow;
        const wasCursor = col === this.lastCursorCol && row === this.lastCursorRow;
        const changed = !prev || prev.r !== pixel.r || prev.g !== pixel.g || prev.b !== pixel.b || isCursor || wasCursor;

        if (changed) {
          // Move cursor to position
          output += `\x1b[${this.offsetY + row + 1};${this.offsetX + col + 1}H`;
          if (isCursor && cursorVisible) {
            // Invert colors for cursor + use a different character for visibility
            output += `\x1b[7;38;2;${pixel.r};${pixel.g};${pixel.b}m\u2592\x1b[0m`;
          } else {
            output += `\x1b[38;2;${pixel.r};${pixel.g};${pixel.b}m\u2588\x1b[0m`;
          }
        }
      }
    }

    this.lastCursorCol = cursorCol ?? -1;
    this.lastCursorRow = cursorRow ?? -1;

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
