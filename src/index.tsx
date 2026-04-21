#!/usr/bin/env bun
import { render } from "ink";
import { App } from "./App.js";

const args = process.argv.slice(2);
const source = args[0] || null;

// Enter alt screen for fullscreen TUI
process.stdout.write("\x1b[?1049h");
process.stdout.write("\x1b[?25l"); // hide cursor

const { unmount } = render(<App source={source} />, {
  exitOnCtrlC: false,
});

process.on("exit", () => {
  process.stdout.write("\x1b[?25h"); // show cursor
  process.stdout.write("\x1b[?1049l"); // exit alt screen
});

process.on("SIGINT", () => {
  unmount();
  process.exit(0);
});
