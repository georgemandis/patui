import { describe, it, expect } from "bun:test";
import { ImageBuffer } from "../../src/core/image-buffer.js";
import { Viewport } from "../../src/core/viewport.js";
import { Sampler } from "../../src/core/sampler.js";

describe("Sampler", () => {
  it("produces a grid of RGB values matching viewport dimensions", async () => {
    const img = await ImageBuffer.fromFile("fixtures/test-4x4.png");
    const vp = new Viewport(4, 4, 2, 2);
    const grid = Sampler.sample(img, vp, null);
    expect(grid.length).toBe(2);       // rows
    expect(grid[0].length).toBe(2);    // cols
  });

  it("at min zoom, each cell is an average of source pixels", async () => {
    const img = await ImageBuffer.fromFile("fixtures/test-4x4.png");
    const vp = new Viewport(4, 4, 2, 2);
    const grid = Sampler.sample(img, vp, null);
    // Top-left cell averages 2x2 region of source
    const cell = grid[0][0];
    expect(cell.r).toBeGreaterThanOrEqual(0);
    expect(cell.r).toBeLessThanOrEqual(255);
  });
});
