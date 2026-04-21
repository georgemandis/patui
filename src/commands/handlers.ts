import { parseCommand } from "./parser.js";
import { useStore } from "../state/store.js";
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
      const w = parseInt(args[0]) || ((process.stdout.columns || 80) - 5);
      const h = parseInt(args[1]) || ((process.stdout.rows || 24) - 4);
      const image = ImageBuffer.blank(w, h, store.bgColor);
      const viewport = new Viewport(w, h, Math.min(w, (process.stdout.columns || 80) - 5), Math.min(h, (process.stdout.rows || 24) - 4));
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
      }
      break;
    }

    case "gray":
      useStore.setState((s) => ({ grayscale: !s.grayscale }));
      store.setMessage(`Grayscale: ${!store.grayscale ? "on" : "off"}`);
      break;

    case "palette": {
      const name = args[0] || null;
      useStore.setState({ palette: name });
      store.setMessage(name ? `Palette: ${name}` : "Palette: true color");
      break;
    }

    case "dither":
      useStore.setState((s) => ({ dither: !s.dither }));
      store.setMessage(`Dither: ${!store.dither ? "on" : "off"}`);
      break;

    case "reset":
      useStore.setState({ grayscale: false, palette: null, dither: false });
      store.setMessage("Filters reset");
      break;

    case "help":
      store.setMessage(":o :w :wc :new :q :set :gray :palette :dither :help");
      break;

    default:
      store.setMessage(`Unknown command: ${command}`);
  }
}
