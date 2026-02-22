import React from "react";
import { Box, Text } from "ink";
import type { TokenUsage } from "../types.js";

export const MP_DISPLAY_MAX = 10_000;
const BAR_LENGTH = 10;

function formatK(n: number): string {
  return Math.round(n / 1_000).toString();
}

interface Props {
  usage: TokenUsage;
  contextLimit: number;
  model: string;
}

export default function StatusBar({ usage, model }: Props) {
  const remaining = Math.max(0, MP_DISPLAY_MAX - usage.totalTokens);
  const ratio = remaining / MP_DISPLAY_MAX;

  const filled = Math.round(ratio * BAR_LENGTH);
  const empty = BAR_LENGTH - filled;

  const barColor = ratio < 0.2 ? "#ff3333" : ratio < 0.5 ? "#ffaa00" : "#55aaff";

  return (
    <Box>
      <Text dimColor>{model} | </Text>
      <Text color={barColor}>MP {Math.round((remaining / MP_DISPLAY_MAX) * 100)}/100 </Text>
      <Text dimColor>[</Text>
      <Text color={barColor}>{"█".repeat(filled)}</Text>
      <Text dimColor>{"░".repeat(empty)}</Text>
      <Text dimColor>]</Text>
    </Box>
  );
}
