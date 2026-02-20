import React from "react";
import { Box, Text } from "ink";
import type { TokenUsage } from "../types.js";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface Props {
  usage: TokenUsage;
  contextLimit: number;
  model: string;
}

export default function StatusBar({ usage, contextLimit, model }: Props) {
  const ratio = contextLimit > 0 ? usage.totalTokens / contextLimit : 0;
  const color = ratio > 0.8 ? "red" : ratio > 0.5 ? "yellow" : "gray";

  return (
    <Box>
      <Text dimColor>
        {model} | {formatTokens(usage.totalTokens)}/{formatTokens(contextLimit)}{" "}
      </Text>
      <Text color={color}>
        ({(ratio * 100).toFixed(0)}%)
      </Text>
    </Box>
  );
}
