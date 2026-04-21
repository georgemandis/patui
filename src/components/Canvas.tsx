import { Box, Text } from "ink";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useStore } from "../state/store.js";
import type { RGB } from "../core/image-buffer.js";
import type { ImageBuffer } from "../core/image-buffer.js";
import { applyFilters } from "../export/filters.js";

// Terminal cells are roughly 2:1 (height:width).
const CELL_ASPECT = 2.0;

export function Canvas() {
  const image = useStore((s) => s.image);
  const editLayer = useStore((s) => s.editLayer);
  const viewport = useStore((s) => s.viewport);
  const cursorCol = useStore((s) => s.cursorCol);
  const cursorRow = useStore((s) => s.cursorRow);
  const brushSize = useStore((s) => s.brushSize);
  const gsFilter = useStore((s) => s.grayscale);
  const paletteFilter = useStore((s) => s.palette);
  const ditherFilter = useStore((s) => s.dither);

  const [resized, setResized] = useState<ImageBuffer | null>(null);
  const [tick, setTick] = useState(0);
  const lastResizeKey = useRef("");
  // Track the crop region so we can map cursor/edits back to source coords
  const cropRef = useRef({ x: 0, y: 0, w: 0, h: 0 });

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

    // At zoom=1: fit the whole image into the terminal (aspect-correct).
    // At zoom>1: use the FULL terminal grid, crop a region of the source
    // that corresponds to what those terminal cells would show.
    //
    // Step 1: compute zoom=1 fit (aspect-correct, may not fill terminal)
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

    // Step 2: figure out source-pixels-per-cell at current zoom.
    // At zoom=1, one cell covers (image.width / baseCols) source px horizontally.
    // At zoom=N, one cell covers 1/N of that (more detail per cell).
    const baseSrcPerCell = image.width / baseCols;
    const srcPerCell = baseSrcPerCell / zoom;

    // Step 3: the crop is what the terminal can show at this detail level.
    // Crop width = terminal columns * srcPerCell
    // Crop height = terminal rows * srcPerCell * CELL_ASPECT (cells are ~2x tall)
    // But clamp the crop to the actual image dimensions.
    const rawCropW = termSize.w * srcPerCell;
    const rawCropH = termSize.h * srcPerCell * CELL_ASPECT;
    const cropW = Math.min(rawCropW, image.width);
    const cropH = Math.min(rawCropH, image.height);

    // The output grid: how many terminal cells does the crop fill?
    const targetCols = Math.max(1, Math.round(cropW / srcPerCell));
    const targetRows = Math.max(1, Math.round(cropH / (srcPerCell * CELL_ASPECT)));

    // Map cursor from grid coords to source coords via previous crop
    const prevCrop = cropRef.current;
    const prevW = prevCrop.w || image.width;
    const prevH = prevCrop.h || image.height;
    const prevX = prevCrop.x || 0;
    const prevY = prevCrop.y || 0;

    const cursorSrcX = prevX + (cursorCol / (resized?.width || targetCols)) * prevW;
    const cursorSrcY = prevY + (cursorRow / (resized?.height || targetRows)) * prevH;

    // Center the crop on the cursor
    let cropX = cursorSrcX - cropW / 2;
    let cropY = cursorSrcY - cropH / 2;

    // Clamp so we don't go outside the image
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

  if (!filtered) {
    return <Box flexGrow={1} width={termSize.w} height={termSize.h} />;
  }

  // Build rows of colored block characters
  const half = Math.floor(brushSize / 2);
  const hue = (Date.now() / 4) % 360;
  const cursorRgb = hslToRgb(hue, 100, 60);

  const rows: React.ReactNode[] = [];
  for (let row = 0; row < filtered.length; row++) {
    const cells: React.ReactNode[] = [];
    let runStart = 0;
    let runColor: RGB | null = null;

    for (let col = 0; col <= filtered[0].length; col++) {
      let pixel: RGB | undefined;
      let isCursor = false;

      if (col < filtered[0].length) {
        pixel = filtered[row][col];

        isCursor = col >= cursorCol - half && col < cursorCol - half + brushSize
          && row >= cursorRow - half && row < cursorRow - half + brushSize;
      }

      const sameRun = col < filtered[0].length && !isCursor && runColor
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

      if (isCursor) {
        cells.push(
          <Text
            key={`${row}-${col}-cur`}
            color={`rgb(${cursorRgb[0]},${cursorRgb[1]},${cursorRgb[2]})`}
            backgroundColor={`rgb(${pixel!.r},${pixel!.g},${pixel!.b})`}
          >
            ▒
          </Text>
        );
      } else {
        if (runColor === null) {
          runStart = col;
          runColor = pixel!;
        }
      }
    }

    rows.push(<Box key={row}>{cells}</Box>);
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
