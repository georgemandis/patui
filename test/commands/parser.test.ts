import { describe, it, expect } from "bun:test";
import { parseCommand } from "../../src/commands/parser.js";

describe("parseCommand", () => {
  it("parses :q", () => {
    expect(parseCommand("q")).toEqual({ command: "q", args: [] });
  });

  it("parses :w filename.png", () => {
    expect(parseCommand("w filename.png")).toEqual({ command: "w", args: ["filename.png"] });
  });

  it("parses :o with URL", () => {
    expect(parseCommand("o https://example.com/img.png")).toEqual({
      command: "o", args: ["https://example.com/img.png"],
    });
  });

  it("parses :set zoom 4", () => {
    expect(parseCommand("set zoom 4")).toEqual({ command: "set", args: ["zoom", "4"] });
  });

  it("parses :new 80 40", () => {
    expect(parseCommand("new 80 40")).toEqual({ command: "new", args: ["80", "40"] });
  });

  it("parses :wq", () => {
    expect(parseCommand("wq")).toEqual({ command: "wq", args: [] });
  });

  it("parses :w! with bang", () => {
    expect(parseCommand("w! file.png")).toEqual({ command: "w!", args: ["file.png"] });
  });

  it("parses :palette gameboy", () => {
    expect(parseCommand("palette gameboy")).toEqual({ command: "palette", args: ["gameboy"] });
  });
});
