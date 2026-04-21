# PaTUI

> *The elegance of MS Paint meets the user-friendliness of Vim wrapped in the performance of JavaScript.*

> *PaTUI: sounds like "patooey" — because that's what your images will look like.*

A terminal-based image editor with Vim-style modal controls. Load images (PNG, JPEG, or URLs) and render them as colored block characters in your terminal. Paint, erase, fill, type text, apply retro filters, and export your work as PNG, ANSI art, or plain text.

## Installation

```bash
bun install
```

## Usage

```bash
# Load a local image
bun src/index.tsx mona.png

# Load from URL
bun src/index.tsx https://example.com/image.png

# Start with blank canvas (sized to your terminal)
bun src/index.tsx
```

## Modes

| Mode | Enter | Exit | Behavior |
|------|-------|------|----------|
| Normal | Esc | — | Navigate, edit, zoom, undo/redo |
| Paint | `i` | Esc | Movement applies the active tool continuously |
| Text | `t` | Esc (commits) | Type characters rendered onto the image |
| Command | `:` | Esc or Enter | Text commands for file I/O, filters, settings |

## Navigation

All navigation commands accept a numeric prefix (e.g., `5j` moves down 5 rows).

| Key | Action |
|-----|--------|
| h/j/k/l or arrows | Move cursor |
| `gg` | Go to top-left |
| `G` | Go to bottom |
| `0` or `^` | Start of row |
| `$` | End of row |
| `W` | Jump to next color boundary |
| `B` | Jump to previous color boundary |
| Ctrl+D | Half page down |
| Ctrl+U | Half page up |
| `+` / `=` | Zoom in |
| `-` | Zoom out |

## Tools

| Key | Action |
|-----|--------|
| b | Brush |
| e | Eraser |
| f | Fill (bucket) |
| c | Eyedropper (color picker) |
| t | Enter Text mode |
| Space / Enter | Apply tool at cursor |

## Editing (Vim-style)

| Key | Action |
|-----|--------|
| `x` | Delete pixel at cursor (e.g., `5x` deletes 5) |
| `dd` | Delete (clear) current row |
| `5dd` | Delete 5 rows |
| `dG` | Delete from cursor row to bottom |
| `dgg` | Delete from top to cursor row |
| `D` | Delete from cursor to end of row |
| `yy` | Yank (copy) current row |
| `5yy` | Yank 5 rows |
| `p` | Paste yanked rows at cursor |
| `X` | Swap foreground/background colors |
| `u` | Undo |
| Ctrl+R | Redo |

## Text Mode

Press `t` to enter text mode. Characters you type are rasterized onto the source image at the cursor position using the current foreground color.

- Font size scales with brush size (`:set brush 5` for larger text)
- Backspace removes the last character
- Enter commits the current line and moves the cursor down
- Escape commits and returns to Normal mode

## Color Palette

| Key | Action |
|-----|--------|
| `!` `@` `#` `$` `%` `^` `&` `*` `(` `)` | Select palette color 1-10 |
| `:color N` | Select any palette color 1-16 |

The bottom bar shows all 16 colors. Active color is highlighted. Eyedropper picks appear in the recent colors section.

## Commands

| Command | Action |
|---------|--------|
| `:o <file-or-url>` | Open image file or URL |
| `:new [W H]` | New blank canvas (defaults to terminal size) |
| `:w <file>` | Export (`.png`, `.jpg`, `.ans`, `.txt`) |
| `:wc` | Copy ANSI art to clipboard |
| `:wq [file]` | Export PNG and quit |
| `:q` or `:q!` | Quit |
| `:set zoom N` | Set zoom level |
| `:set brush N` | Set brush size |
| `:set fg N` | Set foreground to palette color 1-16 |
| `:set bg N` | Set background to palette color 1-16 |
| `:color N` | Select foreground palette color 1-16 |
| `:goto X Y` or `:g X Y` | Jump to source pixel (supports `50%` for percentages) |
| `:gray` | Toggle grayscale filter |
| `:palette <name>` | Limit colors (`cga`, `gameboy`, `websafe`) |
| `:dither` | Toggle Floyd-Steinberg dithering |
| `:reset` | Clear all filters |
| `:help` | Full-screen help (scrollable) |

## Filters

Filters apply live on the canvas and are included in exports. All filter changes are undoable.

- **Grayscale** (`:gray`) — luminance-based desaturation
- **Palette limiting** (`:palette cga|gameboy|websafe`) — quantize to retro color palettes
- **Dithering** (`:dither`) — Floyd-Steinberg error diffusion (use with a palette)
- **Reset** (`:reset`) — remove all filters

## Export Formats

| Extension | Format |
|-----------|--------|
| `.png` / `.jpg` | Image file (block pixels, terminal aspect ratio) |
| `.ans` | ANSI art with true-color escape codes |
| `.txt` | Plain block characters, no color |
| `:wc` | ANSI art copied to clipboard |

## Layout

```
┌─────────────────────────────────────────────┐
│ PaTUI                                        │
├────┬────────────────────────────────────────┤
│ [B]│                                        │
│ [E]│                                        │
│ [F]│         Canvas Area                    │
│ [C]│                                        │
│    │                                        │
│ FG │                                        │
│ BG │                                        │
├────┴────────────────────────────────────────┤
│ !@#$%^&*()······  [recent colors]           │
├─────────────────────────────────────────────┤
│ -- NORMAL --  brush(1)  [x,y] WxH  Zoom:1x │
└─────────────────────────────────────────────┘
```

## Roadmap

- Visual/selection mode (rectangle select, copy/paste, move regions)
- Line and shape tools (rectangle, circle, line)
- Layers
- Custom color picker (RGB/HSL input)
- Mouse support
- Resize canvas
- GIF export

## Tech Stack

- **Bun** — runtime and package manager
- **TypeScript**
- **Ink** — React for terminal UIs
- **sharp** — image processing, crop/resize, text rasterization
- **zustand** — state management

## License

MIT
