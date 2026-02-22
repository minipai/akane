import React, { useState, useRef } from "react";
import { Box, Text, useInput, useStdout, useApp } from "ink";
import TextInput from "ink-text-input";
import CommandMenu, { filterCommands } from "./CommandMenu.js";
import type { SlashCommand } from "./CommandMenu.js";

interface Props {
  onSubmit: (text: string) => void;
  disabled: boolean;
  commands?: SlashCommand[];
}

export default function InputBar({ onSubmit, disabled, commands = [] }: Props) {
  const { exit } = useApp();
  const [value, setValue] = useState("");
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const draftRef = useRef("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuIndex, setMenuIndex] = useState(0);
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;
  const line = "─".repeat(width);

  const filtered = menuOpen ? filterCommands(commands, value.slice(1)) : [];

  const handleChange = (newValue: string) => {
    setValue(newValue);
    if (newValue.startsWith("/")) {
      setMenuOpen(true);
      setMenuIndex(0);
    } else {
      setMenuOpen(false);
    }
  };

  useInput((_input, key) => {
    // Ctrl+C: clear input or exit
    if (_input === "c" && key.ctrl) {
      if (value !== "") {
        setValue("");
        setMenuOpen(false);
        historyIndexRef.current = -1;
      } else {
        exit();
      }
      return;
    }
    if (disabled) return;

    if (menuOpen) {
      if (key.upArrow) {
        setMenuIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        setMenuIndex((i) => Math.min(filtered.length - 1, i + 1));
        return;
      }
      if (key.escape) {
        setMenuOpen(false);
        setValue("");
        return;
      }
      if (key.tab) {
        if (filtered.length > 0) {
          const cmd = filtered[menuIndex];
          setValue(`/${cmd.name}`);
          setMenuOpen(false);
        }
        return;
      }
      return;
    }

    // History navigation only when input is empty
    const history = historyRef.current;
    if (key.upArrow && history.length > 0 && value === "") {
      const newIndex = Math.min(historyIndexRef.current + 1, history.length - 1);
      historyIndexRef.current = newIndex;
      setValue(history[history.length - 1 - newIndex]);
    } else if (key.downArrow && historyIndexRef.current >= 0) {
      if (historyIndexRef.current <= 0) {
        historyIndexRef.current = -1;
        setValue("");
      } else {
        historyIndexRef.current -= 1;
        setValue(history[history.length - 1 - historyIndexRef.current]);
      }
    }
  });

  const handleSubmit = (text: string) => {
    if (menuOpen && filtered.length > 0) {
      const cmd = filtered[menuIndex];
      const cmdText = `/${cmd.name}`;
      historyRef.current.push(cmdText);
      historyIndexRef.current = -1;
      draftRef.current = "";
      setValue("");
      setMenuOpen(false);
      onSubmit(cmdText);
      return;
    }
    if (!text.trim()) return;
    historyRef.current.push(text.trim());
    historyIndexRef.current = -1;
    draftRef.current = "";
    onSubmit(text.trim());
    setValue("");
  };

  return (
    <Box flexDirection="column">
      <Text dimColor>{line}</Text>
      {menuOpen && (
        <CommandMenu commands={commands} filtered={filtered} menuIndex={menuIndex} />
      )}
      <Box>
        <Text color="green" bold>
          {"❯ "}
        </Text>
        {disabled ? (
          <Text dimColor>...</Text>
        ) : (
          <TextInput
            value={value}
            onChange={handleChange}
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
