import { Box, Text, useStdout } from "ink";
import { useStore } from "../state/store.js";

const HELP_LINES = `
  TUI Paint — Help                                      (Esc to close, j/k to scroll)
  ═══════════════

  MODES
  ─────
  Normal    Esc          Move cursor, switch tools, zoom, undo/redo
  Paint     i / p        Movement applies the active tool continuously
  Text      t            Type characters rendered onto the image
  Command   :            Text commands for file I/O, filters, settings

  NORMAL MODE
  ───────────
  h/j/k/l or arrows     Move cursor
  b                      Brush tool
  e                      Eraser tool
  f                      Fill (bucket) tool
  d                      Eyedropper (color picker)
  t                      Enter Text mode
  i / p                  Enter Paint mode
  :                      Enter Command mode
  + / =                  Zoom in
  -                      Zoom out
  u                      Undo
  Ctrl+R                 Redo
  1-9, 0                 Select palette color 1-10
  ! @ # $ % ^            Select palette color 11-16
  Space / Enter          Apply tool at cursor

  TEXT MODE
  ─────────
  Type characters to rasterize text onto the image.
  Font size scales with brush size (:set brush N).
  Backspace              Delete last character
  Enter                  Commit line, move cursor down
  Escape                 Commit and return to Normal

  COMMANDS
  ────────
  :o <file-or-url>       Open image file or URL
  :new [W H]             New blank canvas (defaults to terminal size)
  :w <file>              Export (.png, .jpg, .ans, .txt)
  :wc                    Copy ANSI art to clipboard
  :wq [file]             Export PNG and quit
  :q / :q!               Quit
  :set zoom N            Set zoom level
  :set brush N           Set brush size
  :goto X Y / :g X Y    Jump to source pixel coordinate
  :gray                  Toggle grayscale filter
  :palette <name>        Limit colors (cga, gameboy, websafe)
  :dither                Toggle Floyd-Steinberg dithering
  :reset                 Clear all filters

  FILTERS
  ───────
  Filters apply live on the canvas and in exports. All filter
  changes are undoable with 'u'.

  :gray                  Luminance-based grayscale
  :palette cga           4-color CGA
  :palette gameboy       4 shades of green
  :palette websafe       216 web-safe colors
  :dither                Floyd-Steinberg dithering (use with a palette)
  :reset                 Remove all filters

  EXPORT FORMATS
  ──────────────
  .png / .jpg            Image (block pixels, terminal aspect ratio)
  .ans                   ANSI art with true-color escape codes
  .txt                   Plain block characters, no color
  :wc                    Copy ANSI art to clipboard

  COLOR PALETTE
  ─────────────
  Bottom bar shows 16 colors with key labels.
  Active color is highlighted. Eyedropper picks
  appear in the recent colors section.
`.split("\n");

export function HelpScreen() {
  const { stdout } = useStdout();
  const scroll = useStore((s) => s.helpScroll);
  const h = (stdout?.rows || 24) - 2;

  const visible = HELP_LINES.slice(scroll, scroll + h);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visible.map((line, i) => {
        // Highlight section headers (lines that are all ─ or ═)
        const trimmed = line.trim();
        const isRule = trimmed.length > 0 && /^[─═]+$/.test(trimmed);
        const isHeader = trimmed.length > 0 && !isRule
          && i > 0 && !!visible[i + 1]?.trim().match(/^[─═]+$/);
        const isTitle = line.includes("TUI Paint");

        return (
          <Text
            key={i}
            color={isTitle ? "yellow" : isHeader ? "cyan" : isRule ? "gray" : "white"}
            bold={isTitle || isHeader}
          >
            {line}
          </Text>
        );
      })}
    </Box>
  );
}

export const HELP_LINE_COUNT = HELP_LINES.length;
