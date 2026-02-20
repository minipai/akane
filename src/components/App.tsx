import React, { useState, useCallback, useEffect } from "react";
import { Box, Text, useApp } from "ink";
import Spinner from "ink-spinner";
import MessageList from "./MessageList.js";
import ToolPanel from "./ToolPanel.js";
import InputBar from "./InputBar.js";
import type { Agent } from "../agent.js";
import type { Message, ToolActivity } from "../types.js";

interface Props {
  agent: Agent;
  model: string;
}

export default function App({ agent, model }: Props) {
  const { exit } = useApp();
  const [messages, setMessages] = useState<Message[]>(agent.getMessages());
  const [loading, setLoading] = useState(false);
  const [toolActivity, setToolActivity] = useState<ToolActivity | null>(null);

  useEffect(() => {
    agent.setOnToolActivity(setToolActivity);
  }, [agent]);

  const handleSubmit = useCallback(
    async (text: string) => {
      if (text === "/quit" || text === "/exit") {
        exit();
        return;
      }

      setMessages([...agent.getMessages(), { role: "user", content: text }]);
      setLoading(true);
      setToolActivity(null);

      try {
        await agent.run(text);
        setMessages([...agent.getMessages()]);
      } catch (err: unknown) {
        const errMsg =
          err instanceof Error ? err.message : "Unknown error";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${errMsg}` },
        ]);
      } finally {
        setLoading(false);
        setToolActivity(null);
      }
    },
    [agent, exit]
  );

  return (
    <Box flexDirection="column" height="100%">
      <Box marginBottom={1}>
        <Text bold color="magenta">
          akane
        </Text>
        <Text dimColor> ({model}) — /quit to exit</Text>
      </Box>

      <MessageList messages={messages} />

      {loading && (
        <Box flexDirection="column">
          <ToolPanel activity={toolActivity} />
          <Box>
            <Text color="yellow">
              <Spinner type="dots" />{" "}
            </Text>
            <Text dimColor>
              {toolActivity ? `Running ${toolActivity.name}...` : "Thinking..."}
            </Text>
          </Box>
        </Box>
      )}

      <InputBar onSubmit={handleSubmit} disabled={loading} />
    </Box>
  );
}
