import { Box, Text, useStdout } from "ink";
import { useStore } from "../state/store.js";

const HELP_LINES = `
  TUI Paint — Help                                (Esc/q to close, j/k to scroll)
  ═══════════════

  MODES
  ─────
  Normal    Esc          Move cursor, switch tools, zoom, undo/redo
  Paint     i            Movement applies the active tool continuously
  Text      t            Type characters rendered onto the image
  Command   :            Text commands for file I/O, filters, settings

  NAVIGATION (NORMAL MODE)
  ────────────────────────
  h/j/k/l or arrows     Move cursor (accepts count: 5j = move 5 down)
  gg                     Go to top-left
  G                      Go to bottom
  0 or ^                 Go to start of row
  $                      Go to end of row
  W                      Jump to next color boundary
  B                      Jump to previous color boundary
  Ctrl+D                 Half page down
  Ctrl+U                 Half page up
  + / =                  Zoom in
  -                      Zoom out

  TOOLS
  ─────
  b                      Brush tool
  e                      Eraser tool
  f                      Fill (bucket) tool
  c                      Eyedropper (color picker)
  t                      Enter Text mode
  Space / Enter          Apply tool at cursor

  EDITING (VIM-STYLE)
  ───────────────────
  x                      Delete pixel at cursor (accepts count: 5x)
  dd                     Delete (clear) current row
  5dd                    Delete 5 rows
  dG                     Delete from cursor to bottom
  dgg                    Delete from top to cursor
  D                      Delete from cursor to end of row
  yy                     Yank (copy) current row
  5yy                    Yank 5 rows
  p                      Paste yanked rows at cursor
  u                      Undo
  Ctrl+R                 Redo

  TEXT MODE
  ─────────
  Type characters to rasterize text onto the image.
  Font size scales with brush size (:set brush N).
  Backspace              Delete last character
  Enter                  Commit line, move cursor down
  Escape                 Commit and return to Normal

  COLOR PALETTE
  ─────────────
  ! @ # $ % ^ & * ( )   Select palette color 1-10
  :color N               Select palette color by number (1-16)
  Eyedropper (c) picks from canvas; recent picks shown in bar.

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
  :color N               Select palette color 1-16
  :goto X Y / :g X Y    Jump to source pixel coordinate
  :gray                  Toggle grayscale filter
  :palette <name>        Limit colors (cga, gameboy, websafe)
  :dither                Toggle Floyd-Steinberg dithering
  :reset                 Clear all filters
  :help                  This screen

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
