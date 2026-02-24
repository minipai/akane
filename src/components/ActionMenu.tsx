import React, { useState } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import TextInput from "ink-text-input";

const ACTIONS = [
  "sends a heart",
  "gives a thumbs up",
  "makes a thinking face",
  "rolls eyes at you",
];

interface Props {
  onSelect: (action: string) => void;
  onCancel: () => void;
}

export default function ActionMenu({ onSelect, onCancel }: Props) {
  const { exit } = useApp();
  const [index, setIndex] = useState(0);
  const [custom, setCustom] = useState("");
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;
  const line = "─".repeat(width);

  const isCustom = index === ACTIONS.length;
  const totalItems = ACTIONS.length + 1;

  useInput((_input, key) => {
    if (_input === "c" && key.ctrl) {
      exit();
      return;
    }
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.upArrow) {
      setIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow) {
      setIndex((i) => Math.min(totalItems - 1, i + 1));
      return;
    }
    if (isCustom) return; // Let TextInput handle other input on custom row
    if (key.return) {
      onSelect(ACTIONS[index]);
    }
  });

  const handleCustomSubmit = (text: string) => {
    const trimmed = text.trim();
    if (trimmed) onSelect(trimmed);
  };

  return (
    <Box flexDirection="column">
      <Text dimColor>{line}</Text>
      <Text bold> /me ...</Text>
      <Text dimColor>{line}</Text>
      {ACTIONS.map((action, i) => {
        const selected = i === index;
        return (
          <Box key={action}>
            <Text color={selected ? "#ff77ff" : undefined} bold={selected}>
              {selected ? " ❯ " : "   "}{action}
            </Text>
          </Box>
        );
      })}
      <Box>
        <Text color={isCustom ? "#ff77ff" : undefined} bold={isCustom}>
          {isCustom ? " ❯ " : "   "}
        </Text>
        {isCustom ? (
          <TextInput
            value={custom}
            onChange={setCustom}
            onSubmit={handleCustomSubmit}
            placeholder="type your own action..."
            focus={true}
          />
        ) : (
          <Text dimColor>custom...</Text>
        )}
      </Box>
      <Text dimColor> ↑↓ navigate · Enter select · Esc cancel</Text>
    </Box>
  );
}
