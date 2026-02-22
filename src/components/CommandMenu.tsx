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
      {commands.map((cmd) => {
        const visible = filtered.includes(cmd);
        const i = filtered.indexOf(cmd);
        const selected = visible && i === menuIndex;
        return (
          <Box key={cmd.name}>
            {visible ? (
              <>
                <Text color={selected ? "#ff77ff" : undefined} bold={selected}>
                  {selected ? "❯ " : "  "}{"/"}{cmd.name}
                </Text>
                <Text dimColor>  {cmd.description}</Text>
              </>
            ) : (
              <Text> </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
