import { Box, Text, useStdout } from "ink";
import { useEffect } from "react";
import { useStore } from "./state/store.js";
import { MenuBar } from "./components/MenuBar.js";
import { ToolSidebar } from "./components/ToolSidebar.js";
import { Canvas } from "./components/Canvas.js";
import { ColorPalette } from "./components/ColorPalette.js";
import { StatusBar } from "./components/StatusBar.js";
import { CommandLine } from "./components/CommandLine.js";
import { HelpScreen } from "./components/HelpScreen.js";
import { useInputHandler } from "./hooks/useInputHandler.js";
import { ImageBuffer } from "./core/image-buffer.js";
import { EditLayer } from "./core/edit-layer.js";
import { Viewport } from "./core/viewport.js";
import { undoStack } from "./state/undo.js";

export function App({ source }: { source: string | null }) {
  const { stdout } = useStdout();
  const mode = useStore((s) => s.mode);
  const loading = useStore((s) => s.loading);

  useInputHandler();

  useEffect(() => {
    (async () => {
      const store = useStore.getState();
      store.setLoading(true);
      try {
        let image: ImageBuffer;
        let name: string | null;

        if (source) {
          const isUrl = source.startsWith("http://") || source.startsWith("https://");
          image = isUrl
            ? await ImageBuffer.fromUrl(source)
            : await ImageBuffer.fromFile(source);
          name = isUrl ? source.split("/").pop() || "url" : source;
        } else {
          // Default blank canvas — 1:1 with terminal grid
          const defCols = (stdout?.columns || 80) - 6;
          const defRows = (stdout?.rows || 24) - 5;
          image = await ImageBuffer.blankAsync(defCols, defRows * 2, { r: 255, g: 255, b: 255 });
          name = null;
        }

        const cols = (stdout?.columns || 80) - 6;
        const rows = (stdout?.rows || 24) - 5;
        const viewport = new Viewport(image.width, image.height, cols, rows);
        const editLayer = new EditLayer(image.width, image.height);
        undoStack.clear();
        store.setImage(image, name);
        store.setViewport(viewport);
        store.setEditLayer(editLayer);
        store.setMessage(source ? `Loaded ${image.width}x${image.height}` : `New canvas ${image.width}x${image.height}`);
      } catch (e: any) {
        store.setMessage(`Error: ${e.message}`);
      }
      store.setLoading(false);
    })();
  }, [source]);

  if (mode === "help") {
    return (
      <Box flexDirection="column" width="100%" height="100%">
        <HelpScreen />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%" height="100%">
      <MenuBar />
      <Box flexGrow={1}>
        <ToolSidebar />
        {loading ? (
          <Box flexGrow={1} justifyContent="center" alignItems="center">
            <Text color="yellow">Loading...</Text>
          </Box>
        ) : (
          <Canvas />
        )}
      </Box>
      <ColorPalette />
      {mode === "command" ? <CommandLine /> : <StatusBar />}
    </Box>
  );
}
