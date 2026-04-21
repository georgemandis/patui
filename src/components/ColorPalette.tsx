import { Box, Text } from "ink";
import { useStore, MS_PAINT_PALETTE } from "../state/store.js";

const PALETTE_KEYS = ["!","@","#","$","%","^","&","*","(",")","·","·","·","·","·","·"];

export function ColorPalette() {
  const fgColor = useStore((s) => s.fgColor);
  const recentColors = useStore((s) => s.recentColors);

  return (
    <Box paddingX={1} gap={0}>
      {MS_PAINT_PALETTE.map((c, i) => {
        const active = c.r === fgColor.r && c.g === fgColor.g && c.b === fgColor.b;
        return (
          <Text key={i} color={`rgb(${c.r},${c.g},${c.b})`} inverse={active}>
            {PALETTE_KEYS[i]}
          </Text>
        );
      })}
      <Text> </Text>
      {recentColors.map((c, i) => (
        <Text key={`r${i}`} color={`rgb(${c.r},${c.g},${c.b})`}>█</Text>
      ))}
    </Box>
  );
}
