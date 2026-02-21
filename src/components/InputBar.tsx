import React, { useState, useRef } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import TextInput from "ink-text-input";

interface Props {
  onSubmit: (text: string) => void;
  disabled: boolean;
  approvalMode?: boolean;
  onApproval?: (approved: boolean) => void;
}

export default function InputBar({ onSubmit, disabled, approvalMode, onApproval }: Props) {
  const [value, setValue] = useState("");
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const draftRef = useRef("");
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;
  const line = "─".repeat(width);

  useInput((_input, key) => {
    if (disabled || approvalMode) return;
    const history = historyRef.current;
    if (key.upArrow && history.length > 0) {
      const newIndex = Math.min(historyIndexRef.current + 1, history.length - 1);
      if (historyIndexRef.current === -1) {
        draftRef.current = value;
      }
      historyIndexRef.current = newIndex;
      setValue(history[history.length - 1 - newIndex]);
    } else if (key.downArrow) {
      if (historyIndexRef.current <= 0) {
        historyIndexRef.current = -1;
        setValue(draftRef.current);
      } else {
        historyIndexRef.current -= 1;
        setValue(history[history.length - 1 - historyIndexRef.current]);
      }
    }
  });

  const handleSubmit = (text: string) => {
    if (!text.trim()) return;
    historyRef.current.push(text.trim());
    historyIndexRef.current = -1;
    draftRef.current = "";
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
      <Box flexDirection="column">
        <Text dimColor>{line}</Text>
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
        <Text dimColor>{line}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text dimColor>{line}</Text>
      <Box>
        <Text color="green" bold>
          {"❯ "}
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
      <Text dimColor>{line}</Text>
    </Box>
  );
}
