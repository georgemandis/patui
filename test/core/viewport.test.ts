import { describe, it, expect } from "bun:test";
import { Viewport } from "../../src/core/viewport.js";

describe("Viewport", () => {
  // Source image: 100x80, terminal viewport: 20x10
  it("at min zoom, maps entire image to viewport", () => {
    const vp = new Viewport(100, 80, 20, 10);
    vp.setZoom(1); // min zoom = fit entire image
    expect(vp.cellWidth()).toBe(5);  // 100/20 = 5 source px per cell
    expect(vp.cellHeight()).toBe(8); // 80/10 = 8 source px per cell
  });

  it("zoom in increases detail (fewer source px per cell)", () => {
    const vp = new Viewport(100, 80, 20, 10);
    vp.setZoom(2);
    expect(vp.cellWidth()).toBeLessThan(5);
  });

  it("maps a viewport cell to source region", () => {
    const vp = new Viewport(100, 80, 20, 10);
    vp.setZoom(1);
    const region = vp.cellToSourceRegion(0, 0);
    expect(region.x).toBe(0);
    expect(region.y).toBe(0);
    expect(region.w).toBe(5);
    expect(region.h).toBe(8);
  });

  it("panning offsets the source region", () => {
    const vp = new Viewport(100, 80, 20, 10);
    vp.setZoom(2);
    vp.panTo(50, 40); // center on (50, 40)
    const region = vp.cellToSourceRegion(0, 0);
    expect(region.x).toBeGreaterThan(0);
  });

  it("clamps pan to image bounds", () => {
    const vp = new Viewport(100, 80, 20, 10);
    vp.setZoom(1);
    vp.panTo(999, 999);
    const region = vp.cellToSourceRegion(19, 9);
    expect(region.x + region.w).toBeLessThanOrEqual(100);
    expect(region.y + region.h).toBeLessThanOrEqual(80);
  });
});
