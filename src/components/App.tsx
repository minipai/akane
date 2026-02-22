import React, { useState, useCallback, useEffect, useRef } from "react";
import { Box, Text, useApp } from "ink";
import Spinner from "ink-spinner";
import Banner from "./Banner.js";
import MessageList from "./MessageList.js";
import ToolPanel from "./ToolPanel.js";
import InputBar from "./InputBar.js";
import StatusBar from "./StatusBar.js";
import type { Agent } from "../core/agent.js";
import type { ChatEntry, ToolActivity, ToolApprovalRequest } from "../core/agent.js";
import { formatToolArgs } from "../core/agent.js";

interface Props {
  agent: Agent;
  model: string;
  displayFromIndex: number;
}

export default function App({ agent, model, displayFromIndex }: Props) {
  const { exit } = useApp();
  const [entries, setEntries] = useState<ChatEntry[]>(agent.getEntries());
  const displayFrom = useRef(displayFromIndex);
  const [loading, setLoading] = useState(false);
  const [toolActivity, setToolActivity] = useState<ToolActivity | null>(null);
  const [pendingApproval, setPendingApproval] =
    useState<ToolApprovalRequest | null>(null);

  useEffect(() => {
    agent.setOnToolActivity(setToolActivity);
    agent.setOnToolApproval(setPendingApproval);
    agent.vitals.startHpRefresh();

    const r = agent.receptionist;
    r.on("quit", () => exit());
    r.on("rest:before", () => {
      displayFrom.current = 0;
      setEntries([{ message: { role: "assistant", content: "(｡-ω-)zzZ Resting..." }, emotion: "neutral" }]);
    });
    r.on("rest:after", () => setEntries([...agent.getEntries()]));
    r.on("chat:before", (text) => {
      setEntries([...agent.getEntries(), { message: { role: "user", content: text } }]);
      setLoading(true);
      setToolActivity(null);
    });
    r.on("chat:after", () => {
      setEntries([...agent.getEntries()]);
      setLoading(false);
      setToolActivity(null);
    });
    r.on("chat:error", (errMsg) => {
      setEntries((prev) => [
        ...prev,
        { message: { role: "assistant", content: `Error: ${errMsg}` } },
      ]);
      setLoading(false);
      setToolActivity(null);
    });

    return () => {
      r.removeAllListeners();
      agent.vitals.stopHpRefresh();
    };
  }, [agent, exit]);

  const handleApproval = useCallback(
    (approved: boolean) => {
      if (pendingApproval) {
        pendingApproval.resolve(approved);
        setPendingApproval(null);
      }
    },
    [pendingApproval],
  );

  const handleSubmit = useCallback(
    (text: string) => { agent.receptionist.handle(text); },
    [agent],
  );

  return (
    <Box flexDirection="column" height="100%">
      <Banner model={model} />

      <MessageList entries={entries.slice(displayFrom.current)} />

      {loading && (
        <Box flexDirection="column">
          {pendingApproval ? (
            <Box>
              <Text>Allow {pendingApproval.name} </Text>
              {pendingApproval.args !== "{}" && (
                <Text color="cyan" bold>
                  {formatToolArgs(pendingApproval.name, pendingApproval.args)}
                </Text>
              )}
              <Text dimColor> ?</Text>
            </Box>
          ) : (
            <>
              <ToolPanel activity={toolActivity} />
              <Box>
                <Text color="yellow">
                  <Spinner type="dots" />{" "}
                </Text>
                <Text dimColor>
                  {toolActivity
                    ? `Running ${toolActivity.name}...`
                    : "Thinking..."}
                </Text>
              </Box>
            </>
          )}
        </Box>
      )}

      {pendingApproval ? (
        <InputBar
          onSubmit={() => {}}
          disabled={false}
          approvalMode={true}
          onApproval={handleApproval}
        />
      ) : (
        <InputBar onSubmit={handleSubmit} disabled={loading} commands={agent.receptionist.commands} />
      )}
      <StatusBar vitals={agent.vitals} model={model} />
    </Box>
  );
}
