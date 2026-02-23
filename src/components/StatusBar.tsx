import React from "react";
import { Box, Text } from "ink";
import type { Vitals } from "../agent/types.js";

const BAR_LENGTH = 10;

interface Props {
  vitals: Vitals;
  model: string;
}

export default function StatusBar({ vitals, model }: Props) {
  const mpRatio = vitals.getMpRatio();
  const mpFilled = Math.round(mpRatio * BAR_LENGTH);
  const mpEmpty = BAR_LENGTH - mpFilled;
  const mpColor = mpRatio < 0.2 ? "#ff3333" : mpRatio < 0.5 ? "#ffaa00" : "#55aaff";

  const hpRatio = vitals.getHpRatio();
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
