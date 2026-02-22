import React, { useState } from "react";
import { Box, Text, useInput, useApp, useStdout } from "ink";
import TextInput from "ink-text-input";

interface Props {
  onApproval: (approved: boolean) => void;
}

export default function ApprovalBar({ onApproval }: Props) {
  const { exit } = useApp();
  const [value, setValue] = useState("");
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;
  const line = "─".repeat(width);

  useInput((_input, key) => {
    if (_input === "c" && key.ctrl) {
      if (value !== "") {
        setValue("");
      } else {
        exit();
      }
    }
  });

  const handleSubmit = (text: string) => {
    const input = text.trim().toLowerCase();
    if (input === "y" || input === "yes" || input === "") {
      onApproval(true);
    } else if (input === "n" || input === "no") {
      onApproval(false);
    }
    setValue("");
  };

  return (
    <Box flexDirection="column">
      <Text dimColor>{line}</Text>
      <Box>
        <Text color="yellow" bold>
          {"[y/n] "}{" "}
        </Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder="y to approve, n to deny"
          focus={true}
        />
      </Box>
      <Text dimColor>{line}</Text>
    </Box>
  );
}
