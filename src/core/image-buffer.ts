import sharp from "sharp";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export class ImageBuffer {
  readonly width: number;
  readonly height: number;
  private data: Buffer; // Raw RGB pixels, 3 bytes per pixel
  private sourceBytes: Buffer; // Original file bytes for re-scaling via sharp

  private constructor(width: number, height: number, data: Buffer, sourceBytes: Buffer) {
    this.width = width;
    this.height = height;
    this.data = data;
    this.sourceBytes = sourceBytes;
  }

  static async fromFile(path: string): Promise<ImageBuffer> {
    const fileBytes = await Bun.file(path).arrayBuffer();
    const sourceBytes = Buffer.from(fileBytes);
    const image = sharp(sourceBytes);
    const metadata = await image.metadata();
    const raw = await image.removeAlpha().raw().toBuffer();
    return new ImageBuffer(metadata.width!, metadata.height!, raw, sourceBytes);
  }

  static async fromUrl(url: string): Promise<ImageBuffer> {
    const response = await fetch(url);
    const arrayBuf = await response.arrayBuffer();
    const sourceBytes = Buffer.from(arrayBuf);
    const image = sharp(sourceBytes);
    const metadata = await image.metadata();
    const raw = await image.removeAlpha().raw().toBuffer();
    return new ImageBuffer(metadata.width!, metadata.height!, raw, sourceBytes);
  }

  static blank(width: number, height: number, color: RGB): ImageBuffer {
    const data = Buffer.alloc(width * height * 3);
    for (let i = 0; i < width * height; i++) {
      data[i * 3] = color.r;
      data[i * 3 + 1] = color.g;
      data[i * 3 + 2] = color.b;
    }
    // Build valid PNG sourceBytes so cropAndResize works
    const sourceBytes = Buffer.from(
      sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer() as any
    );
    return new ImageBuffer(width, height, data, sourceBytes);
  }

  static async blankAsync(width: number, height: number, color: RGB): Promise<ImageBuffer> {
    const data = Buffer.alloc(width * height * 3);
    for (let i = 0; i < width * height; i++) {
      data[i * 3] = color.r;
      data[i * 3 + 1] = color.g;
      data[i * 3 + 2] = color.b;
    }
    const sourceBytes = await sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer();
    return new ImageBuffer(width, height, data, sourceBytes);
  }

  getPixel(x: number, y: number): RGB {
    const idx = (y * this.width + x) * 3;
    return { r: this.data[idx], g: this.data[idx + 1], b: this.data[idx + 2] };
  }

  /** Use sharp to resize the source image to exactly cols x rows pixels */
  async resizeTo(cols: number, rows: number): Promise<ImageBuffer> {
    const raw = await sharp(this.sourceBytes)
      .removeAlpha()
      .resize(cols, rows, { fit: "fill" })
      .raw()
      .toBuffer();
    return new ImageBuffer(cols, rows, raw, this.sourceBytes);
  }

  /**
   * Crop a region from the source, then resize to target dimensions.
   * cropX/cropY/cropW/cropH are in source pixel coordinates.
   */
  async cropAndResize(
    cropX: number, cropY: number, cropW: number, cropH: number,
    targetCols: number, targetRows: number,
  ): Promise<ImageBuffer> {
    // Clamp crop to source bounds
    const x = Math.max(0, Math.round(cropX));
    const y = Math.max(0, Math.round(cropY));
    const w = Math.min(this.width - x, Math.round(cropW));
    const h = Math.min(this.height - y, Math.round(cropH));
    if (w <= 0 || h <= 0) {
      return ImageBuffer.blank(targetCols, targetRows, { r: 0, g: 0, b: 0 });
    }
    const raw = await sharp(this.sourceBytes)
      .removeAlpha()
      .extract({ left: x, top: y, width: w, height: h })
      .resize(targetCols, targetRows, { fit: "fill" })
      .raw()
      .toBuffer();
    return new ImageBuffer(targetCols, targetRows, raw, this.sourceBytes);
  }

  averageRegion(x: number, y: number, w: number, h: number): RGB {
    let totalR = 0, totalG = 0, totalB = 0;
    let count = 0;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px >= 0 && px < this.width && py >= 0 && py < this.height) {
          const pixel = this.getPixel(px, py);
          totalR += pixel.r;
          totalG += pixel.g;
          totalB += pixel.b;
          count++;
        }
      }
    }
    if (count === 0) return { r: 0, g: 0, b: 0 };
    return { r: totalR / count, g: totalG / count, b: totalB / count };
  }
}
