import React, { useState, useCallback, useEffect, useRef } from "react";
import { Box, Text, useApp } from "ink";
import Spinner from "ink-spinner";
import Banner from "./Banner.js";
import MessageList from "./MessageList.js";
import ToolPanel from "./ToolPanel.js";
import InputBar from "./InputBar.js";
import StatusBar, { HP_DAILY_BUDGET } from "./StatusBar.js";
import { getDailySpend, getCachedDailyCost } from "../memory/costs.js";
import type { Agent } from "../agent.js";
import type {
  ChatEntry,
  ToolActivity,
  ToolApprovalRequest,
  TokenUsage,
} from "../types.js";
import { formatToolArgs } from "../tools/index.js";

function atLeast<T>(ms: number, promise: Promise<T>): Promise<T> {
  return Promise.all([promise, new Promise<void>((r) => setTimeout(r, ms))]).then(([v]) => v);
}

interface Props {
  agent: Agent;
  model: string;
  contextLimit: number;
  resetSession: () => Promise<void>;
  displayFromIndex: number;
}

export default function App({ agent, model, contextLimit, resetSession, displayFromIndex }: Props) {
  const { exit } = useApp();
  const [entries, setEntries] = useState<ChatEntry[]>(agent.getEntries());
  const displayFrom = useRef(displayFromIndex);
  const [loading, setLoading] = useState(false);
  const [toolActivity, setToolActivity] = useState<ToolActivity | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>(agent.getTokenUsage());
  const [pendingApproval, setPendingApproval] =
    useState<ToolApprovalRequest | null>(null);
  const [dailyCost, setDailyCost] = useState(getCachedDailyCost());

  const refreshHp = useCallback(() => {
    getDailySpend().then((cost) => {
      setDailyCost(cost);
      agent.setHpRatio(Math.max(0, Math.min(1, (HP_DAILY_BUDGET - cost) / HP_DAILY_BUDGET)));
    }).catch(() => {});
  }, [agent]);

  useEffect(() => {
    agent.setOnToolActivity(setToolActivity);
    agent.setOnToolApproval(setPendingApproval);
    // Set HP from cache immediately, then refresh from API on a 5-min interval
    const cached = getCachedDailyCost();
    agent.setHpRatio(Math.max(0, Math.min(1, (HP_DAILY_BUDGET - cached) / HP_DAILY_BUDGET)));
    refreshHp();
    const interval = setInterval(refreshHp, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [agent, refreshHp]);

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
    async (text: string) => {
      if (text === "/quit" || text === "/exit") {
        exit();
        return;
      }

      if (text === "/rest") {
        displayFrom.current = 0;
        setEntries([{ message: { role: "assistant", content: "(｡-ω-)zzZ Resting..." }, emotion: "neutral" }]);
        setTokenUsage({ promptTokens: 0, totalTokens: 0 });
        await atLeast(1500, resetSession());
        setEntries([...agent.getEntries()]);
        return;
      }

      setEntries([
        ...agent.getEntries(),
        { message: { role: "user", content: text } },
      ]);
      setLoading(true);
      setToolActivity(null);

      try {
        await agent.run(text);
        setEntries([...agent.getEntries()]);
        setTokenUsage(agent.getTokenUsage());
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        setEntries((prev) => [
          ...prev,
          { message: { role: "assistant", content: `Error: ${errMsg}` } },
        ]);
      } finally {
        setLoading(false);
        setToolActivity(null);
      }
    },
    [agent, exit, resetSession],
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
        <InputBar onSubmit={handleSubmit} disabled={loading} />
      )}
      <StatusBar usage={tokenUsage} contextLimit={contextLimit} model={model} dailyCost={dailyCost} />
    </Box>
  );
}
