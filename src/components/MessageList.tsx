import React from "react";
import { Box, Text } from "ink";
import type { Message } from "../types.js";

function getContent(msg: Message): string {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content.map((c) => ("text" in c ? c.text : "")).join("");
  }
  return "";
}

export default function MessageList({ messages }: { messages: Message[] }) {
  const visible = messages.filter(
    (m) => m.role === "user" || m.role === "assistant"
  );

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visible.map((msg, i) => {
        const content = getContent(msg);
        if (!content) return null;

        return (
          <Box key={i} marginBottom={0}>
            <Text color={msg.role === "user" ? "green" : "cyan"} bold>
              {msg.role === "user" ? "you" : "akane"}:{" "}
            </Text>
            <Text wrap="wrap">{content}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
