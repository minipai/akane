import React, { useState, useCallback, useEffect, useRef } from "react";
import { Box, Text, useApp } from "ink";
import Spinner from "ink-spinner";
import Banner from "./Banner.js";
import MessageList from "./MessageList.js";
import ToolPanel from "./ToolPanel.js";
import InputBar from "./InputBar.js";
import ApprovalBar from "./ApprovalBar.js";
import StatusBar from "./StatusBar.js";
import type { Agent } from "../agent/agent.js";
import type { ChatEntry, ToolActivity, ToolApprovalRequest, Entry } from "../agent/types.js";
import type { Dispatch } from "../boot/dispatch.js";

function formatToolArgs(name: string, argsJson: string): string {
  try {
    const parsed = JSON.parse(argsJson);
    switch (name) {
      case "shell":
        return parsed.command ?? argsJson;
      case "set_emotion":
        return parsed.emotion ?? argsJson;
      case "note_about_user":
        return `[${parsed.category}] ${parsed.fact}`;
      case "get_user_facts":
        return parsed.category ?? argsJson;
      case "update_user_fact":
        if (parsed.delete) return `delete #${parsed.id}`;
        return `#${parsed.id}: ${parsed.fact ?? argsJson}`;
      case "describe_agent":
        return parsed.description ? parsed.description.slice(0, 60) + "…" : argsJson;
      case "rest_session":
        return parsed.description ? parsed.description.slice(0, 60) + "…" : argsJson;
      default:
        return argsJson;
    }
  } catch {
    return argsJson;
  }
}

interface Props {
  agent: Agent;
  dispatch: Dispatch;
  model: string;
}

export default function App({ agent, dispatch, model }: Props) {
  const { exit } = useApp();
  const [entries, setEntries] = useState<Entry[]>(agent.getEntries());
  // Show only last 5 pairs (10 messages) on resume; +1 for system prompt entry
  const displayFrom = useRef(Math.max(0, agent.getEntries().length - 10) + 1);
  const [loading, setLoading] = useState(false);
  const [toolActivity, setToolActivity] = useState<ToolActivity | null>(null);
  const [pendingApproval, setPendingApproval] =
    useState<ToolApprovalRequest | null>(null);
  const [, setVitalsTick] = useState(0);

  const mergeEntries = useCallback((): Entry[] => {
    return agent.getEntries();
  }, [agent]);

  useEffect(() => {
    agent.setOnToolActivity(setToolActivity);
    agent.setOnToolApproval(setPendingApproval);
    agent.vitals.setOnChange(() => setVitalsTick((n) => n + 1));
    agent.vitals.startHpRefresh();

    const ev = dispatch.events;
    ev.on("quit", () => exit());
    ev.on("chat:command", () => {
      setEntries(mergeEntries());
      setLoading(true);
      setToolActivity(null);
    });
    ev.on("chat:before", (text) => {
      setEntries([...mergeEntries(), { message: { role: "user", content: text }, ts: Date.now() }]);
      setLoading(true);
      setToolActivity(null);
    });
    ev.on("chat:after", () => {
      const merged = mergeEntries();
      if (displayFrom.current > merged.length) displayFrom.current = 0;
      setEntries(merged);
      setLoading(false);
      setToolActivity(null);
    });
    ev.on("chat:error", (errMsg) => {
      setEntries((prev) => [
        ...prev,
        { message: { role: "assistant", content: `Error: ${errMsg}` } },
      ]);
      setLoading(false);
      setToolActivity(null);
    });

    return () => {
      ev.removeAllListeners();
      agent.vitals.stopHpRefresh();
    };
  }, [agent, dispatch, exit]);

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
    (text: string) => { dispatch.handle(text); },
    [dispatch],
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
        <ApprovalBar onApproval={handleApproval} />
      ) : (
        <InputBar onSubmit={handleSubmit} disabled={loading} commands={dispatch.commands} />
      )}
      <StatusBar vitals={agent.vitals} model={model} />
    </Box>
  );
}
