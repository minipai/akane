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

const MAX_VISIBLE = 5;

export default function CommandMenu({ filtered, menuIndex }: Props) {
  // Scroll window: keep selection visible within MAX_VISIBLE rows
  let start = 0;
  if (filtered.length > MAX_VISIBLE) {
    start = Math.min(
      Math.max(0, menuIndex - Math.floor(MAX_VISIBLE / 2)),
      filtered.length - MAX_VISIBLE,
    );
  }
  const visible = filtered.slice(start, start + MAX_VISIBLE);

  const hasUp = start > 0;
  const hasDown = start + MAX_VISIBLE < filtered.length;
  const scrollHint = hasUp && hasDown ? "↑↓ scroll" : hasUp ? "↑ scroll" : hasDown ? "↓ scroll" : "";

  return (
    <Box flexDirection="column">
      {visible.map((cmd, vi) => {
        const i = start + vi;
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
      {scrollHint && <Text dimColor>  {scrollHint}</Text>}
    </Box>
  );
}
