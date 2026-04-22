import { describe, it, expect } from "bun:test";
import { resolveColor } from "../../src/core/colors.js";

describe("resolveColor", () => {
  it("resolves a CSS color name to RGB", () => {
    expect(resolveColor("red")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("is case-insensitive", () => {
    expect(resolveColor("Red")).toEqual({ r: 255, g: 0, b: 0 });
    expect(resolveColor("CORNFLOWERBLUE")).toEqual({ r: 100, g: 149, b: 237 });
  });

  it("resolves a palette number string (1-16)", () => {
    // Palette color 1 is black {0,0,0}
    expect(resolveColor("1")).toEqual({ r: 0, g: 0, b: 0 });
    // Palette color 11 is bright red {255,0,0}
    expect(resolveColor("11")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("returns null for invalid input", () => {
    expect(resolveColor("notacolor")).toBeNull();
    expect(resolveColor("0")).toBeNull();
    expect(resolveColor("17")).toBeNull();
    expect(resolveColor("")).toBeNull();
  });

  it("prefers CSS name over palette number when both could match", () => {
    // CSS names are checked first; numbers only match as palette indices
    expect(resolveColor("red")).toEqual({ r: 255, g: 0, b: 0 });
  });
});
