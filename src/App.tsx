import { Box, Text } from "ink";

export function App({ source }: { source: string | null }) {
  return (
    <Box flexDirection="column">
      <Text>TUI Paint</Text>
      <Text>{source ? `Loading: ${source}` : "Blank canvas"}</Text>
    </Box>
  );
}
