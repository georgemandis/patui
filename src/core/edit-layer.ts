import type { RGB } from "./image-buffer.js";

export class EditLayer {
  private width: number;
  private height: number;
  // Sparse storage: Map<"x,y" -> RGB> for each painted source pixel
  private pixels: Map<string, RGB>;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.pixels = new Map();
  }

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }

  /** Paint a rectangular region of source pixels with a solid color */
  paintRegion(x: number, y: number, w: number, h: number, color: RGB) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px < this.width && py < this.height) {
          this.pixels.set(this.key(px, py), { ...color });
        }
      }
    }
  }

  /** Check if a region is fully painted; if so return the average color, else null */
  getRegionColor(x: number, y: number, w: number, h: number): RGB | null {
    let totalR = 0, totalG = 0, totalB = 0;
    let painted = 0;
    let total = 0;

    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px < this.width && py < this.height) {
          total++;
          const color = this.pixels.get(this.key(px, py));
          if (color) {
            totalR += color.r;
            totalG += color.g;
            totalB += color.b;
            painted++;
          }
        }
      }
    }

    // Only return a color if the region is fully covered by edits
    if (painted === 0 || painted < total) return null;
    return { r: Math.round(totalR / painted), g: Math.round(totalG / painted), b: Math.round(totalB / painted) };
  }

  /** Get color of a single source pixel */
  getPixel(x: number, y: number): RGB | null {
    return this.pixels.get(this.key(x, y)) ?? null;
  }

  clone(): EditLayer {
    const copy = new EditLayer(this.width, this.height);
    for (const [key, color] of this.pixels) {
      copy.pixels.set(key, { ...color });
    }
    return copy;
  }

  clear() {
    this.pixels.clear();
  }
}
