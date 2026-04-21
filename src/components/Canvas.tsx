import { Box, Text, useStdout } from "ink";
import { useEffect, useRef, useState, useCallback } from "react";
import { useStore } from "../state/store.js";
import { CanvasRenderer } from "../core/canvas-renderer.js";
import { Sampler } from "../core/sampler.js";

export function Canvas() {
  const { stdout } = useStdout();
  const image = useStore((s) => s.image);
  const editLayer = useStore((s) => s.editLayer);
  const viewport = useStore((s) => s.viewport);
  const cursorCol = useStore((s) => s.cursorCol);
  const cursorRow = useStore((s) => s.cursorRow);
  const brushSize = useStore((s) => s.brushSize);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const [cursorTick, setCursorTick] = useState(0);

  // Rainbow cursor tick — re-render at ~12fps so the hue cycles smoothly
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorTick((t) => t + 1);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  // Main render — runs after Ink's React render commits to the terminal.
  // We always invalidate (force full redraw) because Ink may have clobbered
  // our direct stdout writes when it re-rendered its own component tree.
  useEffect(() => {
    if (!image || !viewport) return;

    const canvasOffsetX = 5;
    const canvasOffsetY = 1;
    const termSize = viewport.getTermSize();

    if (!rendererRef.current) {
      rendererRef.current = new CanvasRenderer(
        canvasOffsetX, canvasOffsetY, termSize.w, termSize.h
      );
    }

    // Always invalidate — Ink's re-render may have overwritten our canvas
    rendererRef.current.invalidate();

    const grid = Sampler.sample(image, viewport, editLayer);
    rendererRef.current.render(grid, cursorCol, cursorRow, true, brushSize);
  }, [image, editLayer, viewport, cursorCol, cursorRow, cursorTick, brushSize]);

  if (!image) {
    return (
      <Box flexGrow={1} justifyContent="center" alignItems="center">
        <Text color="gray">No image loaded. Use :o filename or :new</Text>
      </Box>
    );
  }

  // Reserve space so Ink's layout engine gives us the right dimensions.
  // We use a single newline per row instead of spaces to minimize what
  // Ink actually writes (the ANSI renderer overwrites it all anyway).
  const termSize = viewport?.getTermSize() ?? { w: 40, h: 20 };
  return (
    <Box flexGrow={1} width={termSize.w} height={termSize.h}>
      <Text>{"\n".repeat(termSize.h)}</Text>
    </Box>
  );
}
