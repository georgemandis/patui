import { Box, Text, useInput } from "ink";
import { useStore } from "../state/store.js";
import { executeCommand } from "../commands/handlers.js";

export function CommandLine() {
  const mode = useStore((s) => s.mode);
  const commandText = useStore((s) => s.commandText);
  const setCommandText = useStore((s) => s.setCommandText);
  const setMode = useStore((s) => s.setMode);

  useInput((input, key) => {
    if (mode !== "command") return;

    if (key.return) {
      executeCommand(commandText);
      setCommandText("");
      setMode("normal");
    } else if (key.escape) {
      setCommandText("");
      setMode("normal");
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
      <Text color="yellow">█</Text>
    </Box>
  );
}
