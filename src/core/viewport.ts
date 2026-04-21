export interface SourceRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class Viewport {
  private sourceW: number;
  private sourceH: number;
  private termW: number;
  private termH: number;
  private zoom: number = 1;
  private panX: number = 0; // source coords of viewport top-left
  private panY: number = 0;

  constructor(sourceW: number, sourceH: number, termW: number, termH: number) {
    this.sourceW = sourceW;
    this.sourceH = sourceH;
    this.termW = termW;
    this.termH = termH;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
  }

  /** Source pixels per terminal cell (horizontal) */
  cellWidth(): number {
    return this.sourceW / (this.termW * this.zoom);
  }

  /** Source pixels per terminal cell (vertical) */
  cellHeight(): number {
    return this.sourceH / (this.termH * this.zoom);
  }

  setZoom(level: number) {
    // Allow zoom < 1 to "zoom out" — each cell covers more source pixels
    this.zoom = Math.max(0.1, level);
    this.clampPan();
  }

  getZoom(): number {
    return this.zoom;
  }

  /** Center viewport on source coordinate */
  panTo(srcX: number, srcY: number) {
    const visibleW = this.sourceW / this.zoom;
    const visibleH = this.sourceH / this.zoom;
    this.panX = srcX - visibleW / 2;
    this.panY = srcY - visibleH / 2;
    this.clampPan();
  }

  /** Map a viewport cell (col, row) to the source image region it represents */
  cellToSourceRegion(col: number, row: number): SourceRegion {
    const cw = this.cellWidth();
    const ch = this.cellHeight();
    return {
      x: Math.floor(this.panX + col * cw),
      y: Math.floor(this.panY + row * ch),
      w: Math.ceil(cw),
      h: Math.ceil(ch),
    };
  }

  /** Map a viewport cell to source coordinates (center of the cell) */
  cellToSource(col: number, row: number): { x: number; y: number } {
    const cw = this.cellWidth();
    const ch = this.cellHeight();
    return {
      x: Math.floor(this.panX + col * cw + cw / 2),
      y: Math.floor(this.panY + row * ch + ch / 2),
    };
  }

  /** Zoom centered on a specific viewport cell */
  zoomAt(col: number, row: number, newZoom: number) {
    const center = this.cellToSource(col, row);
    this.setZoom(newZoom);
    this.panTo(center.x, center.y);
  }

  getTermSize(): { w: number; h: number } {
    return { w: this.termW, h: this.termH };
  }

  private clampPan() {
    const visibleW = this.sourceW / this.zoom;
    const visibleH = this.sourceH / this.zoom;
    this.panX = Math.max(0, Math.min(this.panX, this.sourceW - visibleW));
    this.panY = Math.max(0, Math.min(this.panY, this.sourceH - visibleH));
  }
}
