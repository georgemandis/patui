import { create } from "zustand";
import type { RGB } from "../core/image-buffer.js";
import type { ImageBuffer } from "../core/image-buffer.js";
import type { EditLayer } from "../core/edit-layer.js";
import type { Viewport } from "../core/viewport.js";

export type Mode = "normal" | "paint" | "command" | "text" | "help";
export type ToolName = "brush" | "eraser" | "fill" | "eyedropper";

export interface AppState {
  mode: Mode;
  tool: ToolName;
  previousTool: ToolName;
  fgColor: RGB;
  bgColor: RGB;
  recentColors: RGB[];
  brushSize: number;
  brushW: number;
  brushH: number;
  image: ImageBuffer | null;
  editLayer: EditLayer | null;
  viewport: Viewport | null;
  cursorCol: number;
  cursorRow: number;
  filename: string | null;
  loading: boolean;
  commandText: string;
  message: string | null;
  // The current crop region in source pixels + grid size (set by Canvas)
  cropRegion: { x: number; y: number; w: number; h: number; gridW: number; gridH: number } | null;
  // Help scroll offset
  helpScroll: number;
  // Vim pending command display (e.g. "5d", "yy")
  vimDisplay: string;
  // Text mode state
  textBuffer: string;
  textStartCol: number;
  textStartRow: number;
  // Filter state
  grayscale: boolean;
  palette: string | null;
  dither: boolean;

  setCropRegion: (crop: AppState["cropRegion"]) => void;
  setMode: (mode: Mode) => void;
  setTool: (tool: ToolName) => void;
  setFgColor: (color: RGB) => void;
  setBgColor: (color: RGB) => void;
  addRecentColor: (color: RGB) => void;
  moveCursor: (dx: number, dy: number) => void;
  setImage: (image: ImageBuffer, filename: string | null) => void;
  setEditLayer: (layer: EditLayer) => void;
  setViewport: (viewport: Viewport) => void;
  setLoading: (loading: boolean) => void;
  setCommandText: (text: string) => void;
  setMessage: (msg: string | null) => void;
}

const MS_PAINT_PALETTE: RGB[] = [
  { r: 0, g: 0, b: 0 }, { r: 128, g: 128, b: 128 },
  { r: 128, g: 0, b: 0 }, { r: 128, g: 128, b: 0 },
  { r: 0, g: 128, b: 0 }, { r: 0, g: 128, b: 128 },
  { r: 0, g: 0, b: 128 }, { r: 128, g: 0, b: 128 },
  { r: 255, g: 255, b: 255 }, { r: 192, g: 192, b: 192 },
  { r: 255, g: 0, b: 0 }, { r: 255, g: 255, b: 0 },
  { r: 0, g: 255, b: 0 }, { r: 0, g: 255, b: 255 },
  { r: 0, g: 0, b: 255 }, { r: 255, g: 0, b: 255 },
];

export { MS_PAINT_PALETTE };

export const useStore = create<AppState>((set) => ({
  mode: "normal",
  tool: "brush",
  previousTool: "brush",
  fgColor: { r: 0, g: 0, b: 0 },
  bgColor: { r: 255, g: 255, b: 255 },
  recentColors: [],
  brushSize: 1,
  brushW: 1,
  brushH: 1,
  image: null,
  editLayer: null,
  viewport: null,
  cursorCol: 0,
  cursorRow: 0,
  filename: null,
  loading: false,
  commandText: "",
  message: null,
  cropRegion: null,
  helpScroll: 0,
  vimDisplay: "",
  textBuffer: "",
  textStartCol: 0,
  textStartRow: 0,
  grayscale: false,
  palette: null,
  dither: false,

  setCropRegion: (cropRegion) => set({ cropRegion }),
  setMode: (mode) => set({ mode }),
  setTool: (tool) => set((state) => ({ tool, previousTool: state.tool })),
  setFgColor: (fgColor) => set({ fgColor }),
  setBgColor: (bgColor) => set({ bgColor }),
  addRecentColor: (color) =>
    set((state) => {
      const exists = state.recentColors.some(
        (c) => c.r === color.r && c.g === color.g && c.b === color.b
      );
      if (exists) return {};
      return { recentColors: [color, ...state.recentColors].slice(0, 16) };
    }),
  moveCursor: (dx, dy) =>
    set((state) => {
      if (!state.viewport) return {};
      const { w, h } = state.viewport.getTermSize();
      return {
        cursorCol: Math.max(0, Math.min(state.cursorCol + dx, w - 1)),
        cursorRow: Math.max(0, Math.min(state.cursorRow + dy, h - 1)),
      };
    }),
  setImage: (image, filename) => set({ image, filename }),
  setEditLayer: (editLayer) => set({ editLayer }),
  setViewport: (viewport) => set({ viewport }),
  setLoading: (loading) => set({ loading }),
  setCommandText: (text) => set({ commandText: text }),
  setMessage: (msg) => set({ message: msg }),
}));
