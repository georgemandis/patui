import { useInput } from "ink";
import { useStore, MS_PAINT_PALETTE } from "../state/store.js";
import { BrushTool } from "../tools/brush.js";
import { EraserTool } from "../tools/eraser.js";
import { FillTool } from "../tools/fill.js";
import { EyedropperTool } from "../tools/eyedropper.js";
import { undoStack } from "../state/undo.js";
import { rasterizeText } from "../tools/text.js";
import { cellToSource, cellToSourceRegion } from "../tools/types.js";
import { HELP_LINE_COUNT } from "../components/HelpScreen.js";
import type { Tool, ToolContext } from "../tools/types.js";
import type { ToolName } from "../state/store.js";
import type { EditLayer } from "../core/edit-layer.js";

// Base edit layer saved when entering text mode, so live preview can re-rasterize cleanly
let textBaseLayer: EditLayer | null = null;

// Vim state machine
let vimCount = ""; // numeric prefix accumulator
let vimPending: "d" | "y" | "g" | null = null; // pending operator or g prefix
let yankBuffer: { colors: (import("../core/image-buffer.js").RGB | null)[][] } | null = null;

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
    brushW: s.brushW,
    brushH: s.brushH,
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

function resetVimState() {
  vimCount = "";
  vimPending = null;
  useStore.setState({ vimDisplay: "" });
}

function updateVimDisplay() {
  useStore.setState({ vimDisplay: `${vimCount}${vimPending ?? ""}` });
}

function getCount(): number {
  return vimCount ? parseInt(vimCount) : 1;
}

function getGridSize(): { cols: number; rows: number } {
  const s = useStore.getState();
  if (s.cropRegion) return { cols: s.cropRegion.gridW, rows: s.cropRegion.gridH };
  const ts = s.viewport?.getTermSize();
  return { cols: ts?.w ?? 80, rows: ts?.h ?? 24 };
}

function pushUndo() {
  const s = useStore.getState();
  if (!s.editLayer) return;
  undoStack.push({
    editLayer: s.editLayer,
    grayscale: s.grayscale,
    palette: s.palette,
    dither: s.dither,
  });
}

/** Delete (paint with bg color) for a range of grid rows */
function deleteRows(startRow: number, count: number) {
  const store = useStore.getState();
  if (!store.editLayer || !store.cropRegion) return;
  const crop = store.cropRegion;
  pushUndo();
  const newLayer = store.editLayer.clone();
  for (let r = startRow; r < startRow + count && r < crop.gridH; r++) {
    for (let c = 0; c < crop.gridW; c++) {
      const region = cellToSourceRegion(crop, c, r);
      newLayer.paintRegion(region.x, region.y, region.w, region.h, store.bgColor);
    }
  }
  store.setEditLayer(newLayer);
}

/** Delete from cursor to end of row */
function deleteToEndOfRow() {
  const store = useStore.getState();
  if (!store.editLayer || !store.cropRegion) return;
  const crop = store.cropRegion;
  pushUndo();
  const newLayer = store.editLayer.clone();
  for (let c = store.cursorCol; c < crop.gridW; c++) {
    const region = cellToSourceRegion(crop, c, store.cursorRow);
    newLayer.paintRegion(region.x, region.y, region.w, region.h, store.bgColor);
  }
  store.setEditLayer(newLayer);
}

/** Delete single cell at cursor */
function deleteCell() {
  const store = useStore.getState();
  if (!store.editLayer || !store.cropRegion) return;
  pushUndo();
  const newLayer = store.editLayer.clone();
  const n = getCount();
  for (let i = 0; i < n; i++) {
    const col = Math.min(store.cursorCol + i, store.cropRegion.gridW - 1);
    const region = cellToSourceRegion(store.cropRegion, col, store.cursorRow);
    newLayer.paintRegion(region.x, region.y, region.w, region.h, store.bgColor);
  }
  store.setEditLayer(newLayer);
}

/** Yank (copy) rows of pixel data from the composite image */
function yankRows(startRow: number, count: number) {
  const store = useStore.getState();
  if (!store.image || !store.cropRegion) return;
  const crop = store.cropRegion;
  const rows: (import("../core/image-buffer.js").RGB | null)[][] = [];
  for (let r = startRow; r < startRow + count && r < crop.gridH; r++) {
    const row: (import("../core/image-buffer.js").RGB | null)[] = [];
    for (let c = 0; c < crop.gridW; c++) {
      const src = cellToSource(crop, c, r);
      const editColor = store.editLayer?.getPixel(src.x, src.y);
      if (editColor) {
        row.push(editColor);
      } else {
        row.push(store.image.getPixel(
          Math.min(src.x, store.image.width - 1),
          Math.min(src.y, store.image.height - 1),
        ));
      }
    }
    rows.push(row);
  }
  yankBuffer = { colors: rows };
  store.setMessage(`Yanked ${count} row${count > 1 ? "s" : ""}`);
}

/** Paste yanked rows at cursor position */
function pasteYank() {
  const store = useStore.getState();
  if (!yankBuffer || !store.editLayer || !store.cropRegion) return;
  pushUndo();
  const crop = store.cropRegion;
  const newLayer = store.editLayer.clone();
  for (let ri = 0; ri < yankBuffer.colors.length; ri++) {
    const targetRow = store.cursorRow + ri;
    if (targetRow >= crop.gridH) break;
    const rowColors = yankBuffer.colors[ri];
    for (let c = 0; c < rowColors.length && c < crop.gridW; c++) {
      const color = rowColors[c];
      if (color) {
        const region = cellToSourceRegion(crop, c, targetRow);
        newLayer.paintRegion(region.x, region.y, region.w, region.h, color);
      }
    }
  }
  store.setEditLayer(newLayer);
  store.setMessage(`Pasted ${yankBuffer.colors.length} row${yankBuffer.colors.length > 1 ? "s" : ""}`);
}

function handleNormalMode(input: string, key: any, store: ReturnType<typeof useStore.getState>) {
  const grid = getGridSize();

  // --- g prefix ---
  if (vimPending === "g") {
    if (input === "g") {
      // gg — go to top-left
      useStore.setState({ cursorCol: 0, cursorRow: 0 });
    }
    resetVimState();
    return;
  }

  // --- d operator pending ---
  if (vimPending === "d") {
    const n = getCount();
    if (input === "d") {
      // dd — delete N rows
      deleteRows(store.cursorRow, n);
      store.setMessage(`Deleted ${n} row${n > 1 ? "s" : ""}`);
    } else if (input === "G") {
      // dG — delete from cursor row to bottom
      const count = grid.rows - store.cursorRow;
      deleteRows(store.cursorRow, count);
      store.setMessage(`Deleted ${count} rows to end`);
    } else if (input === "g") {
      // Wait for second g (dgg — delete from top to cursor row)
      vimPending = null;
      // Handle dgg inline
      const count = store.cursorRow + 1;
      deleteRows(0, count);
      useStore.setState({ cursorRow: 0 });
      store.setMessage(`Deleted ${count} rows from top`);
    }
    resetVimState();
    return;
  }

  // --- y operator pending ---
  if (vimPending === "y") {
    const n = getCount();
    if (input === "y") {
      // yy — yank N rows
      yankRows(store.cursorRow, n);
    }
    resetVimState();
    return;
  }

  // --- Accumulate count digits ---
  // Digits 1-9 start count, 0 continues count (if count already started)
  if (input >= "1" && input <= "9" && !vimPending) {
    vimCount += input;
    updateVimDisplay();
    return;
  }
  if (input === "0" && vimCount.length > 0 && !vimPending) {
    vimCount += input;
    updateVimDisplay();
    return;
  }

  // --- Movement with count ---
  const dir = getDirection(input, key);
  if (dir) {
    const n = getCount();
    for (let i = 0; i < n; i++) store.moveCursor(dir.dx, dir.dy);
    resetVimState();
    return;
  }

  // --- Vim motions ---

  // G — go to bottom
  if (input === "G" && !key.shift) {
    // Actually G is always shift+g, but ink sends capital G
    useStore.setState({ cursorRow: grid.rows - 1 });
    resetVimState();
    return;
  }
  // g prefix (gg, etc.)
  if (input === "g" && !vimPending) {
    vimPending = "g";
    updateVimDisplay();
    return;
  }

  // 0 — start of row (when not accumulating count)
  if (input === "0" && !vimCount) {
    useStore.setState({ cursorCol: 0 });
    resetVimState();
    return;
  }
  // ^ — start of row
  if (input === "^") {
    useStore.setState({ cursorCol: 0 });
    resetVimState();
    return;
  }
  // $ — end of row
  if (input === "$") {
    useStore.setState({ cursorCol: grid.cols - 1 });
    resetVimState();
    return;
  }

  // w — next color boundary (forward)
  if (input === "w") {
    jumpToColorBoundary(1, getCount());
    resetVimState();
    return;
  }
  // b — prev color boundary (backward)  — but also brush tool...
  // We'll keep b as brush tool since it's more useful. Users can use B for back.
  // Actually let's use W/B for word motions to avoid conflict with brush
  if (input === "W") {
    jumpToColorBoundary(1, getCount());
    resetVimState();
    return;
  }
  if (input === "B") {
    jumpToColorBoundary(-1, getCount());
    resetVimState();
    return;
  }

  // Ctrl+D / Ctrl+U — half page
  if (key.ctrl && input === "d") {
    const half = Math.floor(grid.rows / 2);
    for (let i = 0; i < half; i++) store.moveCursor(0, 1);
    resetVimState();
    return;
  }
  if (key.ctrl && input === "u") {
    const half = Math.floor(grid.rows / 2);
    for (let i = 0; i < half; i++) store.moveCursor(0, -1);
    resetVimState();
    return;
  }

  // --- Operators ---

  // d — start delete operator
  if (input === "d" && !vimPending) {
    vimPending = "d";
    updateVimDisplay();
    return;
  }
  // D — delete to end of row (like vim)
  if (input === "D") {
    deleteToEndOfRow();
    store.setMessage("Deleted to end of row");
    resetVimState();
    return;
  }
  // x — delete cell(s) at cursor
  if (input === "x") {
    deleteCell();
    resetVimState();
    return;
  }

  // y — start yank operator
  if (input === "y" && !vimPending) {
    vimPending = "y";
    updateVimDisplay();
    return;
  }
  // p — paste
  if (input === "p") {
    pasteYank();
    resetVimState();
    return;
  }
  // X — swap fg/bg colors
  if (input === "X") {
    const fg = store.fgColor;
    const bg = store.bgColor;
    store.setFgColor(bg);
    store.setBgColor(fg);
    store.setMessage("Swapped FG/BG");
    resetVimState();
    return;
  }

  // --- Everything else (non-vim) ---
  resetVimState();

  // Tool selection (only non-conflicting keys now)
  const toolMap: Record<string, ToolName> = {
    b: "brush", e: "eraser", f: "fill",
  };
  if (toolMap[input]) {
    store.setTool(toolMap[input]);
    return;
  }

  // Eyedropper — use 'c' since 'd' is now delete operator
  // Actually let's keep both: 'd' without a following 'd'/'G' already fell through
  // But 'd' sets vimPending, so we need a different key. Let's use 'c' for color picker.
  if (input === "c") {
    store.setTool("eyedropper");
    return;
  }

  // Enter paint mode (i only — p is now paste)
  if (input === "i") {
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

  // Zoom
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

  // Quick palette: shift+number keys for 16 colors
  // !@#$%^&*() = colors 1-10, then F1-F6 style: use `:color N` for 11-16
  const shiftPaletteMap: Record<string, number> = {
    "!": 0, "@": 1, "#": 2, "$": 3, "%": 4, "^": 5, "&": 6, "*": 7,
    "(": 8, ")": 9,
  };
  if (input in shiftPaletteMap) {
    store.setFgColor(MS_PAINT_PALETTE[shiftPaletteMap[input]]);
    store.setMessage(`Color ${shiftPaletteMap[input] + 1}`);
    return;
  }

  // Apply tool at cursor (space/enter)
  if (input === " " || key.return) {
    applyTool(store.tool);
    return;
  }
}

/** Jump cursor to the next color boundary in the given direction */
function jumpToColorBoundary(direction: 1 | -1, count: number) {
  const store = useStore.getState();
  if (!store.image || !store.cropRegion) return;
  const crop = store.cropRegion;
  let col = store.cursorCol;
  const row = store.cursorRow;

  function getColorAt(c: number): string {
    const src = cellToSource(crop, c, row);
    const edit = store.editLayer?.getPixel(src.x, src.y);
    const px = edit ?? store.image!.getPixel(
      Math.min(src.x, store.image!.width - 1),
      Math.min(src.y, store.image!.height - 1),
    );
    return `${px.r},${px.g},${px.b}`;
  }

  for (let n = 0; n < count; n++) {
    const startColor = getColorAt(col);
    // Skip past current color run
    while (col + direction >= 0 && col + direction < crop.gridW) {
      col += direction;
      if (getColorAt(col) !== startColor) break;
    }
  }

  useStore.setState({ cursorCol: Math.max(0, Math.min(col, crop.gridW - 1)) });
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
      handleNormalMode(input, key, store);
      return;
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
          for (let i = 0; i < store.brushW; i++) store.moveCursor(-1, 0);
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
        // Advance cursor rightward by brushW cells (matches font width)
        for (let i = 0; i < store.brushW; i++) store.moveCursor(1, 0);
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
 * Font size in source pixels, scaled by brushW.
 * At brushW=1, each character is ~1 cell wide on screen.
 * Monospace glyphs are roughly 0.6× font-size wide.
 */
function getTextFontSize(): number {
  const store = useStore.getState();
  if (!store.cropRegion) return 16;
  const srcPerCellW = store.cropRegion.w / store.cropRegion.gridW;
  return Math.round((srcPerCellW * store.brushW) / 0.6);
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
