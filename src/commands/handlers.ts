import { resolve } from "path";
import { parseCommand } from "./parser.js";
import { useStore, MS_PAINT_PALETTE } from "../state/store.js";
import { resolveColor, fuzzyColorMatch } from "../core/colors.js";
import { ImageBuffer } from "../core/image-buffer.js";
import { EditLayer } from "../core/edit-layer.js";
import { Viewport } from "../core/viewport.js";
import { undoStack } from "../state/undo.js";

/** Resolve a file path relative to the user's original cwd (for Homebrew installs that cd to libexec) */
export function resolvePath(p: string): string {
  return resolve(process.env.PATUI_CWD || process.cwd(), p);
}

export { parseCommand };

function executeSubstitution(input: string, store: ReturnType<typeof useStore.getState>) {
  // Parse: %s/from/to/g
  const match = input.match(/^%s\/([^/]+)\/([^/]+)\/g$/);
  if (!match) {
    store.setMessage("Usage: :%s/color/color/g (add ~ prefix for fuzzy: :%s/~blue/red/g)");
    return;
  }

  const [, fromStr, toStr] = match;
  const fuzzy = fromStr.startsWith("~");
  const fromName = fuzzy ? fromStr.slice(1) : fromStr;

  const fromColor = resolveColor(fromName);
  const toColor = resolveColor(toStr);

  if (!fromColor) {
    store.setMessage(`Unknown color: ${fromName} (use a CSS name or palette number 1-16)`);
    return;
  }
  if (!toColor) {
    store.setMessage(`Unknown color: ${toStr} (use a CSS name or palette number 1-16)`);
    return;
  }

  if (!store.image || !store.editLayer) {
    store.setMessage("No image loaded");
    return;
  }

  // Push undo snapshot (undoStack.push clones the edit layer internally)
  undoStack.push({
    editLayer: store.editLayer,
    grayscale: store.grayscale,
    palette: store.palette,
    dither: store.dither,
  });

  const { image, editLayer } = store;
  const newLayer = editLayer.clone();
  let count = 0;

  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      // Read composited view from original: edit layer pixel if present, else source
      const pixel = editLayer.getPixel(x, y) ?? image.getPixel(x, y);

      const isMatch = fuzzy
        ? fuzzyColorMatch(pixel, fromColor)
        : pixel.r === fromColor.r && pixel.g === fromColor.g && pixel.b === fromColor.b;

      if (isMatch) {
        newLayer.paintRegion(x, y, 1, 1, toColor);
        count++;
      }
    }
  }

  store.setEditLayer(newLayer);
  store.setMessage(count > 0 ? `Replaced ${count.toLocaleString()} pixels` : "No matching pixels found");
}

export async function executeCommand(input: string) {
  // Handle :%s/from/to/g substitution syntax
  const trimmed = input.trim();
  if (trimmed.startsWith("%s/")) {
    executeSubstitution(trimmed, useStore.getState());
    return;
  }

  const { command, args } = parseCommand(input);
  const store = useStore.getState();

  switch (command) {
    case "q":
      process.exit(0);
      break;

    case "q!":
      process.exit(0);
      break;

    case "o": {
      const source = args[0];
      if (!source) {
        store.setMessage("Usage: :o <file-or-url>");
        return;
      }
      store.setLoading(true);
      try {
        const isUrl = source.startsWith("http://") || source.startsWith("https://");
        const image = isUrl
          ? await ImageBuffer.fromUrl(source)
          : await ImageBuffer.fromFile(resolvePath(source));
        const cols = (process.stdout.columns || 80) - 5;
        const rows = (process.stdout.rows || 24) - 4;
        const viewport = new Viewport(image.width, image.height, cols, rows);
        const editLayer = new EditLayer(image.width, image.height);
        undoStack.clear();
        store.setImage(image, isUrl ? source.split("/").pop() || "url" : source);
        store.setViewport(viewport);
        store.setEditLayer(editLayer);
        store.setMessage(`Loaded ${image.width}x${image.height}`);
      } catch (e: any) {
        store.setMessage(`Error: ${e.message}`);
      }
      store.setLoading(false);
      break;
    }

    case "new": {
      const termCols = (process.stdout.columns || 80) - 5;
      const termRows = (process.stdout.rows || 24) - 4;
      const w = parseInt(args[0]) || termCols;
      const h = parseInt(args[1]) || termRows * 2;
      const image = await ImageBuffer.blankAsync(w, h, store.bgColor);
      const viewport = new Viewport(w, h, Math.min(w, termCols), Math.min(h, termRows));
      const editLayer = new EditLayer(w, h);
      undoStack.clear();
      store.setImage(image, null);
      store.setViewport(viewport);
      store.setEditLayer(editLayer);
      store.setMessage(`New canvas ${w}x${h}`);
      break;
    }

    case "w":
    case "w!": {
      const filename = args[0];
      if (!filename) {
        store.setMessage("Usage: :w <filename.png|.ans|.txt>");
        return;
      }
      try {
        const outPath = resolvePath(filename);
        if (filename.endsWith(".png") || filename.endsWith(".jpg")) {
          const { exportImage } = await import("../export/image.js");
          await exportImage(outPath);
        } else if (filename.endsWith(".ans")) {
          const { exportAnsi } = await import("../export/ansi.js");
          await exportAnsi(outPath, true);
        } else if (filename.endsWith(".txt")) {
          const { exportAnsi } = await import("../export/ansi.js");
          await exportAnsi(outPath, false);
        } else {
          const { exportImage } = await import("../export/image.js");
          await exportImage(outPath + ".png");
        }
        store.setMessage(`Saved: ${filename}`);
      } catch (e: any) {
        store.setMessage(`Error: ${e.message}`);
      }
      break;
    }

    case "wc": {
      try {
        const { copyToClipboard } = await import("../export/clipboard.js");
        await copyToClipboard();
        store.setMessage("Copied to clipboard!");
      } catch (e: any) {
        store.setMessage(`Error: ${e.message}`);
      }
      break;
    }

    case "wq": {
      const filename = args[0] || "output.png";
      try {
        const { exportImage } = await import("../export/image.js");
        await exportImage(resolvePath(filename));
      } catch {}
      process.exit(0);
      break;
    }

    case "set": {
      const [prop, value] = args;
      if (prop === "zoom" && store.viewport) {
        store.viewport.zoomAt(store.cursorCol, store.cursorRow, parseInt(value));
        // Clone viewport so zustand detects the change
        store.setViewport(Object.assign(Object.create(Object.getPrototypeOf(store.viewport)), store.viewport));
      } else if (prop === "brush") {
        // Accept "N" for NxN or "W,H" for WxH
        const parts = (value || "1").split(",");
        const w = Math.max(1, parseInt(parts[0]) || 1);
        const h = parts.length > 1 ? Math.max(1, parseInt(parts[1]) || 1) : w;
        useStore.setState({ brushSize: Math.max(w, h), brushW: w, brushH: h });
      } else if (prop === "fg") {
        const color = resolveColor(value || "");
        if (color) {
          store.setFgColor(color);
          store.setMessage(`FG: ${value}`);
        } else {
          store.setMessage("Usage: :set fg <name-or-number>");
        }
      } else if (prop === "bg") {
        const color = resolveColor(value || "");
        if (color) {
          store.setBgColor(color);
          store.setMessage(`BG: ${value}`);
        } else {
          store.setMessage("Usage: :set bg <name-or-number>");
        }
      }
      break;
    }

    case "gray":
      if (store.editLayer) {
        undoStack.push({ editLayer: store.editLayer, grayscale: store.grayscale, palette: store.palette, dither: store.dither });
      }
      useStore.setState((s) => ({ grayscale: !s.grayscale }));
      store.setMessage(`Grayscale: ${!store.grayscale ? "on" : "off"}`);
      break;

    case "palette": {
      if (store.editLayer) {
        undoStack.push({ editLayer: store.editLayer, grayscale: store.grayscale, palette: store.palette, dither: store.dither });
      }
      const name = args[0] || null;
      useStore.setState({ palette: name });
      store.setMessage(name ? `Palette: ${name}` : "Palette: true color");
      break;
    }

    case "dither":
      if (store.editLayer) {
        undoStack.push({ editLayer: store.editLayer, grayscale: store.grayscale, palette: store.palette, dither: store.dither });
      }
      useStore.setState((s) => ({ dither: !s.dither }));
      store.setMessage(`Dither: ${!store.dither ? "on" : "off"}`);
      break;

    case "goto":
    case "g": {
      if (!args[0] || !args[1]) {
        store.setMessage("Usage: :goto <x> <y>  (pixels or percentages like 50%)");
        break;
      }
      if (!store.image || !store.viewport) {
        store.setMessage("No image loaded");
        break;
      }
      // Parse value — supports "50%" or plain pixel number
      const parseCoord = (val: string, max: number): number => {
        if (val.endsWith("%")) {
          return Math.round((parseFloat(val) / 100) * max);
        }
        return parseInt(val);
      };
      const x = parseCoord(args[0], store.image.width);
      const y = parseCoord(args[1], store.image.height);
      if (isNaN(x) || isNaN(y)) {
        store.setMessage("Usage: :goto <x> <y>  (pixels or percentages like 50%)");
        break;
      }
      // Clamp to image bounds
      const px = Math.max(0, Math.min(x, store.image.width - 1));
      const py = Math.max(0, Math.min(y, store.image.height - 1));
      // Map source pixel to grid cursor position using current crop
      const crop = store.cropRegion;
      if (crop) {
        const col = Math.round(((px - crop.x) / crop.w) * crop.gridW);
        const row = Math.round(((py - crop.y) / crop.h) * crop.gridH);
        useStore.setState({
          cursorCol: Math.max(0, Math.min(col, crop.gridW - 1)),
          cursorRow: Math.max(0, Math.min(row, crop.gridH - 1)),
        });
      }
      store.setMessage(`Goto ${px},${py}`);
      break;
    }

    case "reset":
      if (store.editLayer) {
        undoStack.push({ editLayer: store.editLayer, grayscale: store.grayscale, palette: store.palette, dither: store.dither });
      }
      useStore.setState({ grayscale: false, palette: null, dither: false });
      store.setMessage("Filters reset");
      break;

    case "color":
    case "c": {
      const color = resolveColor(args[0] || "");
      if (!color) {
        store.setMessage("Usage: :color <name-or-number> (CSS name or 1-16)");
        break;
      }
      store.setFgColor(color);
      store.setMessage(`Color: ${args[0]}`);
      break;
    }

    case "help":
      useStore.setState({ mode: "help", helpScroll: 0 });
      break;

    default:
      store.setMessage(`Unknown command: ${command}`);
  }
}
