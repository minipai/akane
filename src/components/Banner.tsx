import React, { useState } from "react";
import { Box, Text } from "ink";

const GREETINGS = [
  "◝(ᵔ ᗜ ᵔ)◜",
  "(˶> ⩊ <˶)",
  "(„• ֊ •„)",
  "⸜(｡˃ ᵕ ˂)⸝♡",
  "₍^. .^₎⟆",
  "(⸝⸝๑  ̫ ๑⸝⸝⸝)",
  "( ⸝⸝꩜ ᯅ ꩜⸝⸝;)",
];

interface Props {
  model: string;
}

export default function Banner({ model }: Props) {
  const [greeting] = useState(
    () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)],
  );

  return (
    <Box marginBottom={1}>
      <Text bold color="#ff77ff">
        K.A.N.A. {greeting}
      </Text>
      <Text dimColor> ({model}) — /quit to exit</Text>
    </Box>
  );
}
