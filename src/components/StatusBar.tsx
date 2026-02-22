import React from "react";
import { Box, Text } from "ink";
import type { TokenUsage } from "../types.js";

export const MP_DISPLAY_MAX = 10_000;
export const HP_DAILY_BUDGET = 1; // USD
const BAR_LENGTH = 10;

interface Props {
  usage: TokenUsage;
  contextLimit: number;
  model: string;
  dailyCost: number;
}

export default function StatusBar({ usage, model, dailyCost }: Props) {
  const mpRemaining = Math.max(0, MP_DISPLAY_MAX - usage.totalTokens);
  const mpRatio = mpRemaining / MP_DISPLAY_MAX;
  const mpFilled = Math.round(mpRatio * BAR_LENGTH);
  const mpEmpty = BAR_LENGTH - mpFilled;
  const mpColor = mpRatio < 0.2 ? "#ff3333" : mpRatio < 0.5 ? "#ffaa00" : "#55aaff";

  const hpRatio = Math.max(0, Math.min(1, (HP_DAILY_BUDGET - dailyCost) / HP_DAILY_BUDGET));
  const hpFilled = Math.round(hpRatio * BAR_LENGTH);
  const hpEmpty = BAR_LENGTH - hpFilled;
  const hpColor = hpRatio < 0.2 ? "#ff3333" : hpRatio < 0.5 ? "#ffaa00" : "#55ff55";

  return (
    <Box>
      <Text dimColor>{model} | </Text>
      <Text color={hpColor}>HP {Math.round(hpRatio * 100)}/100 </Text>
      <Text dimColor>[</Text>
      <Text color={hpColor}>{"█".repeat(hpFilled)}</Text>
      <Text dimColor>{"░".repeat(hpEmpty)}</Text>
      <Text dimColor>] </Text>
      <Text color={mpColor}>MP {Math.round(mpRatio * 100)}/100 </Text>
      <Text dimColor>[</Text>
      <Text color={mpColor}>{"█".repeat(mpFilled)}</Text>
      <Text dimColor>{"░".repeat(mpEmpty)}</Text>
      <Text dimColor>]</Text>
    </Box>
  );
}
