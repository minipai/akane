import React from "react";
import { Box, Text } from "ink";
import type { Message } from "../types.js";

function roleColor(role: string): string {
  switch (role) {
    case "user":
      return "green";
    case "assistant":
      return "cyan";
    case "tool":
      return "gray";
    default:
      return "white";
  }
}

function roleLabel(role: string): string {
  switch (role) {
    case "user":
      return "you";
    case "assistant":
      return "akane";
    case "tool":
      return "tool";
    default:
      return role;
  }
}

export default function MessageList({ messages }: { messages: Message[] }) {
  const visible = messages.filter(
    (m) => m.role === "user" || m.role === "assistant" || m.role === "tool"
  );

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visible.map((msg, i) => {
        const content =
          typeof msg.content === "string"
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content
                  .map((c) => ("text" in c ? c.text : ""))
                  .join("")
              : "";

        if (!content) return null;

        return (
          <Box key={i} marginBottom={0}>
            <Text color={roleColor(msg.role)} bold>
              {roleLabel(msg.role)}:{" "}
            </Text>
            <Text wrap="wrap">{content}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
