import { Box, Text } from "ink";

export function MenuBar() {
  return (
    <Box
      borderStyle="single"
      borderBottom={true}
      borderLeft={false}
      borderRight={false}
      borderTop={false}
      paddingX={1}
    >
      <Text color="yellow" bold>PaTUI</Text>
    </Box>
  );
}
