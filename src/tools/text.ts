import sharp from "sharp";
import type { RGB } from "../core/image-buffer.js";
import type { EditLayer } from "../core/edit-layer.js";

/**
 * Rasterize a text string onto the edit layer at source-pixel coordinates.
 * Uses sharp's SVG overlay to render text into pixels.
 *
 * @param editLayer - The layer to paint onto
 * @param text - The string to render
 * @param srcX - Source X pixel position (top-left of text)
 * @param srcY - Source Y pixel position (top-left of text)
 * @param fontSize - Font size in source pixels
 * @param color - Text color
 * @returns A new EditLayer with the text painted on
 */
export async function rasterizeText(
  editLayer: EditLayer,
  text: string,
  srcX: number,
  srcY: number,
  fontSize: number,
  color: RGB,
): Promise<EditLayer> {
  if (!text) return editLayer;

  const fs = Math.max(8, Math.round(fontSize));

  // Escape XML special characters
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  // Estimate dimensions — generous width to avoid clipping
  const estWidth = Math.ceil(fs * text.length * 0.7) + fs;
  const estHeight = Math.ceil(fs * 1.5);

  const svg = `<svg width="${estWidth}" height="${estHeight}" xmlns="http://www.w3.org/2000/svg">
    <text x="0" y="${Math.round(fs)}"
      font-family="monospace"
      font-size="${fs}px"
      fill="rgb(${Math.round(color.r)},${Math.round(color.g)},${Math.round(color.b)})"
    >${escaped}</text>
  </svg>`;

  const { data, info } = await sharp(Buffer.from(svg))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const newLayer = editLayer.clone();
  for (let py = 0; py < info.height; py++) {
    for (let px = 0; px < info.width; px++) {
      const idx = (py * info.width + px) * 4;
      const a = data[idx + 3];
      // Only paint pixels with meaningful alpha (text foreground)
      if (a > 64) {
        const destX = srcX + px;
        const destY = srcY + py;
        newLayer.paintRegion(destX, destY, 1, 1, {
          r: data[idx],
          g: data[idx + 1],
          b: data[idx + 2],
        });
      }
    }
  }

  return newLayer;
}
