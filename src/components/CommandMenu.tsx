import React from "react";
import { Box, Text } from "ink";

export interface SlashCommand {
  name: string;
  description: string;
}

export function filterCommands(commands: SlashCommand[], query: string): SlashCommand[] {
  const q = query.toLowerCase();
  return commands.filter((cmd) => cmd.name.startsWith(q));
}

interface Props {
  commands: SlashCommand[];
  filtered: SlashCommand[];
  menuIndex: number;
}

export default function CommandMenu({ commands, filtered, menuIndex }: Props) {
  return (
    <Box flexDirection="column">
      {filtered.map((cmd, i) => {
        const selected = i === menuIndex;
        return (
          <Box key={cmd.name}>
            <Text color={selected ? "#ff77ff" : undefined} bold={selected}>
              {selected ? "❯ " : "  "}{"/"}{cmd.name}
            </Text>
            <Text dimColor>  {cmd.description}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
