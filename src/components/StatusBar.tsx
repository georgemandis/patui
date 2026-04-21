import { Box, Text } from "ink";
import { useStore } from "../state/store.js";

const MODE_LABELS: Record<string, string> = {
  normal: "-- NORMAL --",
  paint: "-- PAINT --",
  text: "-- TEXT --",
  command: ":",
};

export function StatusBar() {
  const mode = useStore((s) => s.mode);
  const tool = useStore((s) => s.tool);
  const brushSize = useStore((s) => s.brushSize);
  const viewport = useStore((s) => s.viewport);
  const image = useStore((s) => s.image);
  const filename = useStore((s) => s.filename);
  const message = useStore((s) => s.message);
  const commandText = useStore((s) => s.commandText);
  const cursorCol = useStore((s) => s.cursorCol);
  const cursorRow = useStore((s) => s.cursorRow);
  const cropRegion = useStore((s) => s.cropRegion);

  const zoom = viewport?.getZoom() ?? 1;

  // Map grid cursor to approximate source pixel
  let pixelInfo = "";
  if (cropRegion && image) {
    const srcX = Math.floor(cropRegion.x + (cursorCol / cropRegion.gridW) * cropRegion.w);
    const srcY = Math.floor(cropRegion.y + (cursorRow / cropRegion.gridH) * cropRegion.h);
    pixelInfo = `${srcX},${srcY}`;
  }

  const dims = image ? `${image.width}x${image.height}` : "";

  return (
    <Box justifyContent="space-between" paddingX={1}>
      <Text color="yellow">
        {mode === "command" ? `:${commandText}` : MODE_LABELS[mode]}
      </Text>
      {message ? (
        <Text color="gray">{message}</Text>
      ) : (
        <>
          <Text color="white">{tool}({brushSize})</Text>
          <Text color="cyan">[{pixelInfo}] {dims}</Text>
          <Text color="white">Zoom:{zoom}x</Text>
          <Text color="gray">{filename ?? "[no file]"}</Text>
        </>
      )}
    </Box>
  );
}
