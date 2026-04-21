import { Box, Text, useInput } from "ink";
import { useStore } from "../state/store.js";
import { executeCommand } from "../commands/handlers.js";

// Command completion tree: maps partial input to possible completions
const COMMANDS = [
  "o", "new", "w", "wc", "wq", "q", "q!",
  "set zoom", "set brush", "set fg", "set bg",
  "color", "goto", "g",
  "gray", "palette cga", "palette gameboy", "palette websafe",
  "dither", "reset", "help",
];

function getCompletion(text: string): string | null {
  if (!text) return null;
  const trimmed = text.trimStart();
  if (!trimmed) return null;

  // Find first command that starts with what the user typed
  const match = COMMANDS.find((cmd) => cmd.startsWith(trimmed) && cmd !== trimmed);
  if (match) return match.slice(trimmed.length);

  return null;
}

export function CommandLine() {
  const mode = useStore((s) => s.mode);
  const commandText = useStore((s) => s.commandText);
  const setCommandText = useStore((s) => s.setCommandText);
  const setMode = useStore((s) => s.setMode);

  const ghost = getCompletion(commandText);

  useInput((input, key) => {
    if (mode !== "command") return;

    if (key.return) {
      executeCommand(commandText);
      setCommandText("");
      if (useStore.getState().mode === "command") {
        setMode("normal");
      }
    } else if (key.escape) {
      setCommandText("");
      setMode("normal");
    } else if (key.tab) {
      // Accept completion
      const completion = getCompletion(commandText);
      if (completion) {
        setCommandText(commandText + completion);
      }
    } else if (key.backspace || key.delete) {
      setCommandText(commandText.slice(0, -1));
    } else if (input && !key.ctrl && !key.meta) {
      setCommandText(commandText + input);
    }
  });

  if (mode !== "command") return null;

  return (
    <Box>
      <Text color="yellow">:{commandText}</Text>
      {ghost ? <Text color="gray">{ghost}</Text> : null}
      <Text color="yellow">█</Text>
    </Box>
  );
}
