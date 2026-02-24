import React, { useState } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import TextInput from "ink-text-input";
import type { Outfit } from "../agent/prompts/outfits.js";

const TOP: Outfit[] = [
  { name: "經典女僕", description: "黑白經典女僕裝，白色荷葉圍裙，蕾絲頭飾" },
  { name: "學生制服", description: "深藍水手服，白色領巾，百褶裙" },
  { name: "祭典浴衣", description: "淡粉色浴衣，碎花紋樣，腰帶蝴蝶結" },
  { name: "優雅禮服", description: "深紅色絲絨晚禮服，貼身剪裁，氣質高貴" },
];

interface Props {
  outfits: Outfit[];
  currentName: string;
  onSelect: (outfit: Outfit) => void;
  onCancel: () => void;
}

export default function OutfitMenu({ outfits, currentName, onSelect, onCancel }: Props) {
  const { exit } = useApp();
  const top = TOP;

  const [index, setIndex] = useState(0);
  const [custom, setCustom] = useState("");
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;
  const line = "─".repeat(width);

  const isCustom = index === top.length;
  const totalItems = top.length + 1;

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
      onSelect(top[index]);
    }
  });

  const handleCustomSubmit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const match = outfits.find((o) => o.name === trimmed);
    onSelect(match ?? { name: trimmed, description: "" });
  };

  return (
    <Box flexDirection="column">
      <Text dimColor>{line}</Text>
      <Text bold> Select outfit:</Text>
      <Text dimColor>{line}</Text>
      {top.map((o, i) => {
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
      <Box>
        <Text color={isCustom ? "#ff77ff" : undefined} bold={isCustom}>
          {isCustom ? " ❯ " : "   "}
        </Text>
        {isCustom ? (
          <TextInput
            value={custom}
            onChange={setCustom}
            onSubmit={handleCustomSubmit}
            placeholder="type outfit name..."
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
