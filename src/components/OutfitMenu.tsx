import React, { useState } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import type { Outfit } from "../agent/prompts/outfits.js";

interface Props {
  outfits: Outfit[];
  currentName: string;
  onSelect: (outfit: Outfit) => void;
  onCancel: () => void;
}

export default function OutfitMenu({ outfits, currentName, onSelect, onCancel }: Props) {
  const { exit } = useApp();
  const [index, setIndex] = useState(() => {
    const i = outfits.findIndex((o) => o.name === currentName);
    return i >= 0 ? i : 0;
  });
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;
  const line = "─".repeat(width);

  useInput((_input, key) => {
    if (_input === "c" && key.ctrl) {
      exit();
      return;
    }
    if (key.upArrow) {
      setIndex((i) => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setIndex((i) => Math.min(outfits.length - 1, i + 1));
    } else if (key.return) {
      onSelect(outfits[index]);
    } else if (key.escape) {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column">
      <Text dimColor>{line}</Text>
      <Text bold> Select outfit:</Text>
      <Text dimColor>{line}</Text>
      {outfits.map((o, i) => {
        const selected = i === index;
        const isCurrent = o.name === currentName;
        return (
          <Box key={o.name}>
            <Text color={selected ? "#ff77ff" : undefined} bold={selected}>
              {selected ? " ❯ " : "   "}
              {o.name}
              {isCurrent ? " ★" : ""}
            </Text>
            {selected && (
              <Text dimColor> — {o.description}</Text>
            )}
          </Box>
        );
      })}
      <Text dimColor> ↑↓ navigate · Enter select · Esc cancel</Text>
    </Box>
  );
}
