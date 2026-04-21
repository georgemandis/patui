import { useInput } from "ink";
import { useStore, MS_PAINT_PALETTE } from "../state/store.js";
import { BrushTool } from "../tools/brush.js";
import { EraserTool } from "../tools/eraser.js";
import { FillTool } from "../tools/fill.js";
import { EyedropperTool } from "../tools/eyedropper.js";
import { undoStack } from "../state/undo.js";
import type { Tool, ToolContext } from "../tools/types.js";
import type { ToolName } from "../state/store.js";

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
  };
}

function applyTool(toolName: ToolName) {
  const tool = tools[toolName];
  if (!tool) return;
  const ctx = buildToolContext();
  if (!ctx) return;

  const store = useStore.getState();
  undoStack.push(store.editLayer!);

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

    const store = useStore.getState();

    // Global: Escape returns to normal
    if (key.escape) {
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
        b: "brush", e: "eraser", f: "fill", d: "eyedropper", s: "select", z: "zoom",
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

      // Enter visual mode
      if (input === "v") {
        store.setMode("visual");
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
          store.viewport.zoomAt(store.cursorCol, store.cursorRow, store.viewport.getZoom() + 1);
          store.setViewport(Object.assign(Object.create(Object.getPrototypeOf(store.viewport)), store.viewport));
        }
        return;
      }
      if (input === "-") {
        if (store.viewport) {
          store.viewport.zoomAt(store.cursorCol, store.cursorRow, store.viewport.getZoom() - 1);
          store.setViewport(Object.assign(Object.create(Object.getPrototypeOf(store.viewport)), store.viewport));
        }
        return;
      }

      // Undo
      if (input === "u") {
        if (store.editLayer) {
          const prev = undoStack.undo(store.editLayer);
          if (prev) store.setEditLayer(prev);
        }
        return;
      }

      // Redo (Ctrl+R)
      if (key.ctrl && input === "r") {
        if (store.editLayer) {
          const next = undoStack.redo(store.editLayer);
          if (next) store.setEditLayer(next);
        }
        return;
      }

      // Quick palette (1-9)
      const num = parseInt(input);
      if (num >= 1 && num <= 9) {
        if (MS_PAINT_PALETTE[num - 1]) {
          store.setFgColor(MS_PAINT_PALETTE[num - 1]);
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
  });
}
