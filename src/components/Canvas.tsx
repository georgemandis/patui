import { Box, Text } from "ink";
import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useStore } from "../state/store.js";
import type { RGB } from "../core/image-buffer.js";
import type { ImageBuffer } from "../core/image-buffer.js";
import { applyFilters } from "../export/filters.js";

// Terminal cells are roughly 2:1 (height:width).
const CELL_ASPECT = 2.0;

// Offset of the canvas area within the terminal (account for toolbar on the left and header)
const CANVAS_OFFSET_X = 5;
const CANVAS_OFFSET_Y = 2;

/** Write a single cell directly via ANSI escapes (1-indexed terminal coords) */
function writeCell(termCol: number, termRow: number, char: string, r: number, g: number, b: number, bgR?: number, bgG?: number, bgB?: number) {
  let seq = `\x1b[${termRow};${termCol}H`;
  if (bgR !== undefined) {
    seq += `\x1b[38;2;${r};${g};${b};48;2;${bgR};${bgG};${bgB}m${char}\x1b[0m`;
  } else {
    seq += `\x1b[38;2;${r};${g};${b}m${char}\x1b[0m`;
  }
  process.stdout.write(seq);
}

export function Canvas() {
  const image = useStore((s) => s.image);
  const editLayer = useStore((s) => s.editLayer);
  const viewport = useStore((s) => s.viewport);
  const cursorCol = useStore((s) => s.cursorCol);
  const cursorRow = useStore((s) => s.cursorRow);
  const brushW = useStore((s) => s.brushW);
  const brushH = useStore((s) => s.brushH);
  const gsFilter = useStore((s) => s.grayscale);
  const paletteFilter = useStore((s) => s.palette);
  const ditherFilter = useStore((s) => s.dither);

  const [resized, setResized] = useState<ImageBuffer | null>(null);
  const [tick, setTick] = useState(0);
  const lastResizeKey = useRef("");
  // Track the crop region so we can map cursor/edits back to source coords
  const cropRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // Track previous cursor position for direct ANSI updates
  const prevCursorRef = useRef({ col: -1, row: -1, brushW: 1, brushH: 1 });
  // Track whether the pixel grid changed (need full Ink render) vs just cursor moved
  const lastFilteredRef = useRef<RGB[][] | null>(null);

  // Cursor color animation
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(interval);
  }, []);

  // Crop + resize when image/viewport/zoom/cursor changes
  useEffect(() => {
    if (!image || !viewport) return;
    const termSize = viewport.getTermSize();
    const zoom = viewport.getZoom();

    const imgAspect = image.width / image.height;
    const gridAspect = termSize.w / (termSize.h * CELL_ASPECT);

    let baseCols: number, baseRows: number;
    if (imgAspect > gridAspect) {
      baseCols = termSize.w;
      baseRows = Math.round(termSize.w / imgAspect / CELL_ASPECT);
    } else {
      baseRows = termSize.h;
      baseCols = Math.round(termSize.h * CELL_ASPECT * imgAspect);
    }

    const baseSrcPerCell = image.width / baseCols;
    const srcPerCell = baseSrcPerCell / zoom;

    const rawCropW = termSize.w * srcPerCell;
    const rawCropH = termSize.h * srcPerCell * CELL_ASPECT;
    const cropW = Math.min(rawCropW, image.width);
    const cropH = Math.min(rawCropH, image.height);

    const targetCols = Math.max(1, Math.round(cropW / srcPerCell));
    const targetRows = Math.max(1, Math.round(cropH / (srcPerCell * CELL_ASPECT)));

    const prevCrop = cropRef.current;
    const prevW = prevCrop.w || image.width;
    const prevH = prevCrop.h || image.height;
    const prevX = prevCrop.x || 0;
    const prevY = prevCrop.y || 0;

    const cursorSrcX = prevX + (cursorCol / (resized?.width || targetCols)) * prevW;
    const cursorSrcY = prevY + (cursorRow / (resized?.height || targetRows)) * prevH;

    let cropX = prevX;
    let cropY = prevY;

    if (Math.abs(cropW - prevW) > 1 || Math.abs(cropH - prevH) > 1) {
      cropX = cursorSrcX - cropW / 2;
      cropY = cursorSrcY - cropH / 2;
    } else {
      const cellW = cropW / targetCols;
      const cellH = cropH / targetRows;
      if (cursorCol >= targetCols - 1 && cropX + cropW < image.width) cropX += cellW;
      if (cursorCol <= 0 && cropX > 0) cropX -= cellW;
      if (cursorRow >= targetRows - 1 && cropY + cropH < image.height) cropY += cellH;
      if (cursorRow <= 0 && cropY > 0) cropY -= cellH;
    }

    cropX = Math.max(0, Math.min(cropX, image.width - cropW));
    cropY = Math.max(0, Math.min(cropY, image.height - cropH));

    const key = `${targetCols},${targetRows},${Math.round(cropX)},${Math.round(cropY)},${Math.round(cropW)},${Math.round(cropH)}`;
    if (key === lastResizeKey.current) return;
    lastResizeKey.current = key;

    cropRef.current = { x: cropX, y: cropY, w: cropW, h: cropH };
    useStore.getState().setCropRegion({ x: cropX, y: cropY, w: cropW, h: cropH, gridW: targetCols, gridH: targetRows });

    image.cropAndResize(cropX, cropY, cropW, cropH, targetCols, targetRows).then(setResized);
  }, [image, viewport, cursorCol, cursorRow]);

  const termSize = viewport?.getTermSize() ?? { w: 40, h: 20 };

  // Build filtered pixel grid from resized image + edit layer
  const filtered = useMemo(() => {
    if (!resized) return null;
    const crop = cropRef.current;
    const grid: RGB[][] = [];
    for (let row = 0; row < resized.height; row++) {
      const rowData: RGB[] = [];
      for (let col = 0; col < resized.width; col++) {
        let pixel: RGB | undefined;
        if (editLayer) {
          const srcX = Math.floor(crop.x + col * (crop.w / resized.width));
          const srcY = Math.floor(crop.y + row * (crop.h / resized.height));
          pixel = editLayer.getPixel(srcX, srcY) ?? undefined;
        }
        rowData.push(pixel ?? resized.getPixel(col, row));
      }
      grid.push(rowData);
    }
    return applyFilters(grid, { grayscale: gsFilter, palette: paletteFilter, dither: ditherFilter });
  }, [resized, editLayer, gsFilter, paletteFilter, ditherFilter]);

  // Reset ANSI cursor state when the pixel grid changes (zoom, paint, filter)
  // so we don't try to restore stale cells from a previous grid size
  useEffect(() => {
    prevCursorRef.current = { col: -1, row: -1, brushW: 1, brushH: 1 };
  }, [filtered]);

  // Direct ANSI cursor update — runs on every cursor/tick change WITHOUT re-rendering React
  useEffect(() => {
    if (!filtered) return;
    const prev = prevCursorRef.current;
    const oldHalfW = Math.floor(prev.brushW / 2);
    const oldHalfH = Math.floor(prev.brushH / 2);
    const halfW = Math.floor(brushW / 2);
    const halfH = Math.floor(brushH / 2);

    // Restore old cursor cells to their pixel colors
    if (prev.col >= 0) {
      for (let dr = -oldHalfH; dr < prev.brushH - oldHalfH; dr++) {
        for (let dc = -oldHalfW; dc < prev.brushW - oldHalfW; dc++) {
          const r = prev.row + dr;
          const c = prev.col + dc;
          if (r >= 0 && r < filtered.length && c >= 0 && c < filtered[0].length) {
            const px = filtered[r][c];
            writeCell(CANVAS_OFFSET_X + c + 1, CANVAS_OFFSET_Y + r + 1, "█", px.r, px.g, px.b);
          }
        }
      }
    }

    // Draw new cursor
    const hue = (Date.now() / 4) % 360;
    const cursorRgb = hslToRgb(hue, 100, 60);
    for (let dr = -halfH; dr < brushH - halfH; dr++) {
      for (let dc = -halfW; dc < brushW - halfW; dc++) {
        const r = cursorRow + dr;
        const c = cursorCol + dc;
        if (r >= 0 && r < filtered.length && c >= 0 && c < filtered[0].length) {
          const px = filtered[r][c];
          writeCell(CANVAS_OFFSET_X + c + 1, CANVAS_OFFSET_Y + r + 1, "▒", cursorRgb[0], cursorRgb[1], cursorRgb[2], px.r, px.g, px.b);
        }
      }
    }

    prevCursorRef.current = { col: cursorCol, row: cursorRow, brushW, brushH };
  }, [cursorCol, cursorRow, brushW, brushH, tick, filtered]);

  if (!filtered) {
    return <Box flexGrow={1} width={termSize.w} height={termSize.h} />;
  }

  // Full Ink render: only pixel data, NO cursor overlay.
  // The cursor is drawn via direct ANSI in the useEffect above.
  const rows: React.ReactNode[] = [];
  for (let row = 0; row < filtered.length; row++) {
    const cells: React.ReactNode[] = [];
    let runStart = 0;
    let runColor: RGB | null = null;

    for (let col = 0; col <= filtered[0].length; col++) {
      let pixel: RGB | undefined;

      if (col < filtered[0].length) {
        pixel = filtered[row][col];
      }

      const sameRun = col < filtered[0].length && runColor
        && pixel!.r === runColor.r && pixel!.g === runColor.g && pixel!.b === runColor.b;

      if (!sameRun && runColor !== null) {
        cells.push(
          <Text key={`${row}-${runStart}`} color={`rgb(${runColor.r},${runColor.g},${runColor.b})`}>
            {"█".repeat(col - runStart)}
          </Text>
        );
        runColor = null;
      }

      if (col >= filtered[0].length) break;

      if (runColor === null) {
        runStart = col;
        runColor = pixel!;
      }
    }

    rows.push(<Box key={row}>{cells}</Box>);
  }

  // Pad with empty rows so the canvas always fills termSize.h,
  // keeping the bottom bars pinned to the terminal bottom
  for (let row = filtered.length; row < termSize.h; row++) {
    rows.push(<Box key={`pad-${row}`}><Text> </Text></Box>);
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      {rows}
    </Box>
  );
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
