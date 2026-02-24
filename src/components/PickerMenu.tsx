import React, { useState } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import TextInput from "ink-text-input";

export interface PickerItem {
  label: string;
  detail?: string;
  suffix?: string;
}

interface Props {
  title: string;
  items: PickerItem[];
  placeholder?: string;
  onSelect: (value: string) => void;
  onCancel: () => void;
}

export default function PickerMenu({ title, items, placeholder, onSelect, onCancel }: Props) {
  const { exit } = useApp();
  const [index, setIndex] = useState(0);
  const [custom, setCustom] = useState("");
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;
  const line = "─".repeat(width);

  const isCustom = index === items.length;
  const totalItems = items.length + 1;

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
    if (isCustom) return;
    if (key.return) {
      onSelect(items[index].label);
    }
  });

  const handleCustomSubmit = (text: string) => {
    const trimmed = text.trim();
    if (trimmed) onSelect(trimmed);
  };

  return (
    <Box flexDirection="column">
      <Text dimColor>{line}</Text>
      <Text bold> {title}</Text>
      <Text dimColor>{line}</Text>
      {items.map((item, i) => {
        const selected = i === index;
        return (
          <Box key={item.label}>
            <Text color={selected ? "#ff77ff" : undefined} bold={selected}>
              {selected ? " ❯ " : "   "}
              {item.label}
              {item.suffix ?? ""}
            </Text>
            {selected && item.detail && (
              <Text dimColor> — {item.detail}</Text>
            )}
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
            placeholder={placeholder ?? "type here..."}
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
