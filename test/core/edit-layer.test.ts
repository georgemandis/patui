import { describe, it, expect } from "bun:test";
import { EditLayer } from "../../src/core/edit-layer.js";

describe("EditLayer", () => {
  it("starts empty", () => {
    const layer = new EditLayer(100, 80);
    expect(layer.getRegionColor(0, 0, 10, 10)).toBeNull();
  });

  it("stores a painted region and retrieves it", () => {
    const layer = new EditLayer(100, 80);
    layer.paintRegion(0, 0, 10, 10, { r: 255, g: 0, b: 0 });
    const color = layer.getRegionColor(0, 0, 10, 10);
    expect(color).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("returns null for unpainted regions", () => {
    const layer = new EditLayer(100, 80);
    layer.paintRegion(0, 0, 10, 10, { r: 255, g: 0, b: 0 });
    expect(layer.getRegionColor(50, 50, 10, 10)).toBeNull();
  });

  it("clone creates an independent copy", () => {
    const layer = new EditLayer(100, 80);
    layer.paintRegion(0, 0, 10, 10, { r: 255, g: 0, b: 0 });
    const clone = layer.clone();
    layer.paintRegion(0, 0, 10, 10, { r: 0, g: 255, b: 0 });
    expect(clone.getRegionColor(0, 0, 10, 10)).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("clear removes all edits", () => {
    const layer = new EditLayer(100, 80);
    layer.paintRegion(0, 0, 10, 10, { r: 255, g: 0, b: 0 });
    layer.clear();
    expect(layer.getRegionColor(0, 0, 10, 10)).toBeNull();
  });
});
