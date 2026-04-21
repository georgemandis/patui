import { parseCommand } from "./parser.js";
import { useStore, MS_PAINT_PALETTE } from "../state/store.js";
import { ImageBuffer } from "../core/image-buffer.js";
import { EditLayer } from "../core/edit-layer.js";
import { Viewport } from "../core/viewport.js";
import { undoStack } from "../state/undo.js";

export { parseCommand };

export async function executeCommand(input: string) {
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
          : await ImageBuffer.fromFile(source);
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
        // Dynamic imports to avoid circular dependencies — export modules don't exist yet (Task 10)
        if (filename.endsWith(".png") || filename.endsWith(".jpg")) {
          const { exportImage } = await import("../export/image.js");
          await exportImage(filename);
        } else if (filename.endsWith(".ans")) {
          const { exportAnsi } = await import("../export/ansi.js");
          await exportAnsi(filename, true);
        } else if (filename.endsWith(".txt")) {
          const { exportAnsi } = await import("../export/ansi.js");
          await exportAnsi(filename, false);
        } else {
          const { exportImage } = await import("../export/image.js");
          await exportImage(filename + ".png");
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
        await exportImage(filename);
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
        useStore.setState({ brushSize: parseInt(value) || 1 });
      } else if (prop === "fg") {
        const n = parseInt(value);
        if (n >= 1 && n <= 16 && MS_PAINT_PALETTE[n - 1]) {
          store.setFgColor(MS_PAINT_PALETTE[n - 1]);
          store.setMessage(`FG color ${n}`);
        } else {
          store.setMessage("Usage: :set fg 1-16");
        }
      } else if (prop === "bg") {
        const n = parseInt(value);
        if (n >= 1 && n <= 16 && MS_PAINT_PALETTE[n - 1]) {
          store.setBgColor(MS_PAINT_PALETTE[n - 1]);
          store.setMessage(`BG color ${n}`);
        } else {
          store.setMessage("Usage: :set bg 1-16");
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
      const n = parseInt(args[0]);
      if (isNaN(n) || n < 1 || n > 16) {
        store.setMessage("Usage: :color 1-16");
        break;
      }
      store.setFgColor(MS_PAINT_PALETTE[n - 1]);
      store.setMessage(`Color ${n}`);
      break;
    }

    case "help":
      useStore.setState({ mode: "help", helpScroll: 0 });
      break;

    default:
      store.setMessage(`Unknown command: ${command}`);
  }
}
