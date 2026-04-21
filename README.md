# TUI Paint

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
| Normal | Esc | — | Move cursor, switch tools, zoom, undo/redo |
| Paint | `i` or `p` | Esc | Movement applies the active tool continuously |
| Text | `t` | Esc (commits) | Type characters rendered onto the image |
| Command | `:` | Esc or Enter | Text commands for file I/O, filters, settings |

## Normal Mode Keys

| Key | Action |
|-----|--------|
| h/j/k/l or arrows | Move cursor |
| b | Brush tool |
| e | Eraser tool |
| f | Fill (bucket) tool |
| d | Eyedropper (color picker) tool |
| t | Enter Text mode |
| i or p | Enter Paint mode |
| : | Enter Command mode |
| + / = | Zoom in |
| - | Zoom out |
| u | Undo |
| Ctrl+R | Redo |
| 1-9, 0 | Select palette color 1-10 |
| ! @ # $ % ^ | Select palette color 11-16 |
| Space or Enter | Apply tool at cursor |

## Text Mode

Press `t` to enter text mode. Characters you type are rasterized onto the source image at the cursor position using the current foreground color.

- Font size scales with brush size (`:set brush 5` for larger text)
- Backspace removes the last character
- Enter commits the current line and moves the cursor down
- Escape commits and returns to Normal mode

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
| `:goto X Y` or `:g X Y` | Jump cursor to source pixel coordinate |
| `:gray` | Toggle grayscale filter |
| `:palette <name>` | Limit colors (`cga`, `gameboy`, `websafe`) |
| `:dither` | Toggle Floyd-Steinberg dithering |
| `:reset` | Clear all filters |
| `:help` | Show available commands |

## Filters

Filters apply live on the canvas and are included in exports. They are also undoable.

- **Grayscale** (`:gray`) — luminance-based desaturation
- **Palette limiting** (`:palette cga|gameboy|websafe`) — quantize to retro color palettes
- **Dithering** (`:dither`) — Floyd-Steinberg error diffusion (use with a palette)
- **Reset** (`:reset`) — remove all filters

## Export Formats

| Extension | Format |
|-----------|--------|
| `.png` / `.jpg` | Image file (pixels rendered as blocks matching terminal aspect ratio) |
| `.ans` | ANSI art with true-color escape codes |
| `.txt` | Plain block characters, no color |
| `:wc` | ANSI art copied to clipboard |

## Color Palette

The bottom bar shows 16 MS Paint colors with their key bindings. The currently active color is highlighted. Recent colors from eyedropper picks appear alongside.

## Layout

```
┌─────────────────────────────────────────────┐
│ File  Edit  View  Image  Help               │
├────┬────────────────────────────────────────┤
│ [B]│                                        │
│ [E]│                                        │
│ [F]│         Canvas Area                    │
│ [D]│                                        │
│    │                                        │
│ FG │                                        │
│ BG │                                        │
├────┴────────────────────────────────────────┤
│ 123456789!@#$%^  [recent colors]            │
├─────────────────────────────────────────────┤
│ -- NORMAL --  brush(1)  [x,y] WxH  Zoom:1x │
└─────────────────────────────────────────────┘
```

## Roadmap

- Visual/selection mode (rectangle select, copy/paste, move regions)
- Zoom tool (click-to-zoom)
- Line and shape tools (rectangle, circle, line)
- Layers
- Custom color picker (RGB/HSL input)
- Import/export palette files
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
