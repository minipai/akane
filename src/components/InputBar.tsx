import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface Props {
  onSubmit: (text: string) => void;
  disabled: boolean;
}

export default function InputBar({ onSubmit, disabled }: Props) {
  const [value, setValue] = useState("");

  const handleSubmit = (text: string) => {
    if (!text.trim()) return;
    onSubmit(text.trim());
    setValue("");
  };

  return (
    <Box>
      <Text color="green" bold>
        {">"}{" "}
      </Text>
      {disabled ? (
        <Text dimColor>...</Text>
      ) : (
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder="Type a message..."
          focus={!disabled}
        />
      )}
    </Box>
  );
}
