import { useInput } from "ink";
import { useStore, MS_PAINT_PALETTE } from "../state/store.js";
import { BrushTool } from "../tools/brush.js";
import { EraserTool } from "../tools/eraser.js";
import { FillTool } from "../tools/fill.js";
import { EyedropperTool } from "../tools/eyedropper.js";
import { undoStack } from "../state/undo.js";
import { rasterizeText } from "../tools/text.js";
import { cellToSource } from "../tools/types.js";
import { HELP_LINE_COUNT } from "../components/HelpScreen.js";
import type { Tool, ToolContext } from "../tools/types.js";
import type { ToolName } from "../state/store.js";
import type { EditLayer } from "../core/edit-layer.js";

// Base edit layer saved when entering text mode, so live preview can re-rasterize cleanly
let textBaseLayer: EditLayer | null = null;

const tools: Record<string, Tool> = {
  brush: new BrushTool(),
  eraser: new EraserTool(),
  fill: new FillTool(),
  eyedropper: new EyedropperTool(),
};

function getDirection(input: string, key: any): { dx: number; dy: number } | null {
  if (key.leftArrow || input === "h") return { dx: -1, dy: 0 };
  if (key.rightArrow || input === "l") return { dx: 1, dy: 0 };
  if (key.upArrow || input === "k") return { dx: 0, dy: -1 };
  if (key.downArrow || input === "j") return { dx: 0, dy: 1 };
  return null;
}

function buildToolContext(): ToolContext | null {
  const s = useStore.getState();
  if (!s.image || !s.editLayer || !s.viewport) return null;
  return {
    image: s.image,
    editLayer: s.editLayer,
    viewport: s.viewport,
    fgColor: s.fgColor,
    bgColor: s.bgColor,
    brushSize: s.brushSize,
    col: s.cursorCol,
    row: s.cursorRow,
    cropRegion: s.cropRegion,
  };
}

function applyTool(toolName: ToolName) {
  const tool = tools[toolName];
  if (!tool) return;
  const ctx = buildToolContext();
  if (!ctx) return;

  const store = useStore.getState();
  undoStack.push({
    editLayer: store.editLayer!,
    grayscale: store.grayscale,
    palette: store.palette,
    dither: store.dither,
  });

  const result = tool.apply(ctx);
  if (result.editLayer) store.setEditLayer(result.editLayer);
  if (result.fgColor) {
    store.setFgColor(result.fgColor);
    store.addRecentColor(result.fgColor);
  }
  if (result.switchToPreviousTool) {
    useStore.setState((s) => ({ tool: s.previousTool }));
  }
}

export function useInputHandler() {
  const mode = useStore((s) => s.mode);

  useInput((input, key) => {
    // Command mode is handled by CommandLine component
    if (mode === "command") return;

    // Help mode: scroll or dismiss
    if (mode === "help") {
      if (key.escape || input === "q") {
        useStore.setState({ mode: "normal" });
        return;
      }
      const termH = (process.stdout.rows || 24) - 2;
      const maxScroll = Math.max(0, HELP_LINE_COUNT - termH);
      if (input === "j" || key.downArrow) {
        useStore.setState((s) => ({ helpScroll: Math.min(s.helpScroll + 1, maxScroll) }));
      } else if (input === "k" || key.upArrow) {
        useStore.setState((s) => ({ helpScroll: Math.max(s.helpScroll - 1, 0) }));
      } else if (input === "d" && key.ctrl) {
        useStore.setState((s) => ({ helpScroll: Math.min(s.helpScroll + Math.floor(termH / 2), maxScroll) }));
      } else if (input === "u" && key.ctrl) {
        useStore.setState((s) => ({ helpScroll: Math.max(s.helpScroll - Math.floor(termH / 2), 0) }));
      } else if (input === "g") {
        useStore.setState({ helpScroll: 0 });
      } else if (input === "G") {
        useStore.setState({ helpScroll: maxScroll });
      }
      return;
    }

    const store = useStore.getState();

    // Global: Escape returns to normal (commit text if in text mode)
    if (key.escape) {
      if (store.mode === "text") {
        if (store.textBuffer && store.cropRegion) {
          commitText();
        } else {
          // No text typed — restore base layer (discard any preview artifacts)
          if (textBaseLayer) {
            store.setEditLayer(textBaseLayer);
            textBaseLayer = null;
          }
        }
      }
      store.setMode("normal");
      store.setMessage(null);
      return;
    }

    if (mode === "normal") {
      // Movement
      const dir = getDirection(input, key);
      if (dir) {
        store.moveCursor(dir.dx, dir.dy);
        return;
      }

      // Tool selection
      const toolMap: Record<string, ToolName> = {
        b: "brush", e: "eraser", f: "fill", d: "eyedropper",
      };
      if (toolMap[input]) {
        store.setTool(toolMap[input]);
        return;
      }

      // Enter paint mode
      if (input === "i" || input === "p") {
        store.setMode("paint");
        return;
      }

      // Enter text mode
      if (input === "t") {
        textBaseLayer = store.editLayer?.clone() ?? null;
        useStore.setState({
          mode: "text",
          textBuffer: "",
          textStartCol: store.cursorCol,
          textStartRow: store.cursorRow,
        });
        store.setMessage("-- TEXT -- (type to insert, Esc to finish)");
        return;
      }

      // Command mode
      if (input === ":") {
        store.setMode("command");
        return;
      }

      // Zoom (clone viewport so zustand detects the change)
      if (input === "+" || input === "=") {
        if (store.viewport) {
          const cur = store.viewport.getZoom();
          const step = cur < 1 ? 0.25 : 1;
          store.viewport.zoomAt(store.cursorCol, store.cursorRow, cur + step);
          store.setViewport(Object.assign(Object.create(Object.getPrototypeOf(store.viewport)), store.viewport));
        }
        return;
      }
      if (input === "-") {
        if (store.viewport) {
          const cur = store.viewport.getZoom();
          const step = cur <= 1 ? 0.25 : 1;
          store.viewport.zoomAt(store.cursorCol, store.cursorRow, cur - step);
          store.setViewport(Object.assign(Object.create(Object.getPrototypeOf(store.viewport)), store.viewport));
        }
        return;
      }

      // Undo
      if (input === "u") {
        if (store.editLayer) {
          const prev = undoStack.undo({
            editLayer: store.editLayer,
            grayscale: store.grayscale,
            palette: store.palette,
            dither: store.dither,
          });
          if (prev) {
            store.setEditLayer(prev.editLayer);
            useStore.setState({
              grayscale: prev.grayscale,
              palette: prev.palette,
              dither: prev.dither,
            });
          }
        }
        return;
      }

      // Redo (Ctrl+R)
      if (key.ctrl && input === "r") {
        if (store.editLayer) {
          const next = undoStack.redo({
            editLayer: store.editLayer,
            grayscale: store.grayscale,
            palette: store.palette,
            dither: store.dither,
          });
          if (next) {
            store.setEditLayer(next.editLayer);
            useStore.setState({
              grayscale: next.grayscale,
              palette: next.palette,
              dither: next.dither,
            });
          }
        }
        return;
      }

      // Quick palette: 1-9, 0, then !@#$%^ for all 16 colors
      const paletteKeyMap: Record<string, number> = {
        "1": 0, "2": 1, "3": 2, "4": 3, "5": 4, "6": 5, "7": 6, "8": 7, "9": 8,
        "0": 9, "!": 10, "@": 11, "#": 12, "$": 13, "%": 14, "^": 15,
      };
      if (input in paletteKeyMap) {
        const idx = paletteKeyMap[input];
        if (MS_PAINT_PALETTE[idx]) {
          store.setFgColor(MS_PAINT_PALETTE[idx]);
        }
        return;
      }

      // Apply tool at cursor (space/enter)
      if (input === " " || key.return) {
        applyTool(store.tool);
        return;
      }
    }

    if (mode === "paint") {
      const dir = getDirection(input, key);
      if (dir) {
        store.moveCursor(dir.dx, dir.dy);
        applyTool(store.tool);
        return;
      }
    }

    if (mode === "text") {
      // Backspace
      if (key.backspace || key.delete) {
        const buf = store.textBuffer;
        if (buf.length > 0) {
          const newBuf = buf.slice(0, -1);
          useStore.setState({ textBuffer: newBuf });
          for (let i = 0; i < store.brushSize; i++) store.moveCursor(-1, 0);
          store.setMessage(`-- TEXT -- ${newBuf}|`);
          if (newBuf) {
            previewText(newBuf);
          } else if (textBaseLayer) {
            // Restore base layer when all text deleted
            store.setEditLayer(textBaseLayer.clone());
          }
        }
        return;
      }

      // Enter commits current line and moves down
      if (key.return) {
        if (store.textBuffer && store.cropRegion) {
          // Commit commits onto textBaseLayer. After commit, update
          // textBaseLayer to include the committed text for the next line.
          commitText().then(() => {
            const s = useStore.getState();
            textBaseLayer = s.editLayer?.clone() ?? null;
          });
          useStore.setState((s) => ({
            textBuffer: "",
            textStartCol: s.textStartCol,
            textStartRow: s.cursorRow + 1,
            cursorRow: Math.min(s.cursorRow + 1, (s.cropRegion?.gridH ?? s.cursorRow + 1) - 1),
            cursorCol: s.textStartCol,
          }));
          store.setMessage("-- TEXT -- |");
        }
        return;
      }

      // Printable character
      if (input && !key.ctrl && !key.meta) {
        const newBuf = store.textBuffer + input;
        useStore.setState({ textBuffer: newBuf });
        // Advance cursor rightward by brushSize cells (matches font width)
        for (let i = 0; i < store.brushSize; i++) store.moveCursor(1, 0);
        store.setMessage(`-- TEXT -- ${newBuf}|`);

        // Live preview: rasterize as we type
        if (store.editLayer && store.cropRegion) {
          previewText(newBuf);
        }
        return;
      }
    }
  });
}

/**
 * Font size in source pixels, scaled by brushSize.
 * At brushSize=1, each character is ~1 cell wide on screen.
 * Increase brushSize to make text bigger (brushSize=5 → 5 cells per char).
 * Monospace glyphs are roughly 0.6× font-size wide.
 */
function getTextFontSize(): number {
  const store = useStore.getState();
  if (!store.cropRegion) return 16;
  const srcPerCellW = store.cropRegion.w / store.cropRegion.gridW;
  return Math.round((srcPerCellW * store.brushSize) / 0.6);
}

/** Preview text by rasterizing onto the base layer (before text mode started) */
async function previewText(text: string) {
  const store = useStore.getState();
  if (!textBaseLayer || !store.cropRegion) return;

  const src = cellToSource(store.cropRegion, store.textStartCol, store.textStartRow);
  const fontSize = getTextFontSize();

  const newLayer = await rasterizeText(
    textBaseLayer, text, src.x, src.y, fontSize, store.fgColor,
  );
  // Only apply if still in text mode (user might have escaped)
  if (useStore.getState().mode === "text") {
    store.setEditLayer(newLayer);
  }
}

/** Commit text: push undo with pre-text state, rasterize final text */
async function commitText() {
  const store = useStore.getState();
  if (!textBaseLayer || !store.cropRegion || !store.textBuffer) return;

  undoStack.push({
    editLayer: textBaseLayer,
    grayscale: store.grayscale,
    palette: store.palette,
    dither: store.dither,
  });

  const src = cellToSource(store.cropRegion, store.textStartCol, store.textStartRow);
  const fontSize = getTextFontSize();

  const newLayer = await rasterizeText(
    textBaseLayer, store.textBuffer, src.x, src.y, fontSize, store.fgColor,
  );
  store.setEditLayer(newLayer);
  useStore.setState({ textBuffer: "" });
  textBaseLayer = null;
}
