import { Box, Text } from "ink";
import { useStore } from "../state/store.js";
import type { ToolName } from "../state/store.js";

const TOOLS: { name: ToolName; icon: string; key: string }[] = [
  { name: "brush", icon: "B", key: "b" },
  { name: "eraser", icon: "E", key: "e" },
  { name: "fill", icon: "F", key: "f" },
  { name: "eyedropper", icon: "D", key: "d" },
];

export function ToolSidebar() {
  const tool = useStore((s) => s.tool);
  const fgColor = useStore((s) => s.fgColor);
  const bgColor = useStore((s) => s.bgColor);

  return (
    <Box
      flexDirection="column"
      width={5}
      borderStyle="single"
      borderRight={true}
      borderLeft={false}
      borderTop={false}
      borderBottom={false}
      paddingX={0}
    >
      {TOOLS.map((t) => (
        <Box key={t.name} justifyContent="center">
          <Text
            backgroundColor={t.name === tool ? "white" : undefined}
            color={t.name === tool ? "black" : "white"}
          >
            [{t.icon}]
          </Text>
        </Box>
      ))}
      <Box flexDirection="column" marginTop={1} alignItems="center">
        <Text color={`rgb(${fgColor.r},${fgColor.g},${fgColor.b})`}>███</Text>
        <Text dimColor>FG</Text>
        <Text color={`rgb(${bgColor.r},${bgColor.g},${bgColor.b})`}>███</Text>
        <Text dimColor>BG</Text>
      </Box>
    </Box>
  );
}
