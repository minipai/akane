import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface Props {
  onSubmit: (text: string) => void;
  disabled: boolean;
  approvalMode?: boolean;
  onApproval?: (approved: boolean) => void;
}

export default function InputBar({ onSubmit, disabled, approvalMode, onApproval }: Props) {
  const [value, setValue] = useState("");

  const handleSubmit = (text: string) => {
    if (!text.trim()) return;
    onSubmit(text.trim());
    setValue("");
  };

  const handleApproval = (text: string) => {
    const input = text.trim().toLowerCase();
    if (input === "y" || input === "yes" || input === "") {
      onApproval?.(true);
    } else if (input === "n" || input === "no") {
      onApproval?.(false);
    }
    setValue("");
  };

  if (approvalMode) {
    return (
      <Box>
        <Text color="yellow" bold>
          {"[y/n] "}{" "}
        </Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleApproval}
          placeholder="y to approve, n to deny"
          focus={true}
        />
      </Box>
    );
  }

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
