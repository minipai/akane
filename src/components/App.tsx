import React, { useState, useCallback, useEffect, useRef } from "react";
import { Box, Text, useApp } from "ink";
import Spinner from "ink-spinner";
import Banner from "./Banner.js";
import MessageList from "./MessageList.js";
import ToolPanel from "./ToolPanel.js";
import InputBar from "./InputBar.js";
import ApprovalBar from "./ApprovalBar.js";
import OutfitMenu from "./OutfitMenu.js";
import StatusBar from "./StatusBar.js";
import type { Agent } from "../agent/agent.js";
import type { ChatEntry, ToolActivity, ToolApprovalRequest, Entry } from "../agent/types.js";
import type { Dispatch } from "../boot/dispatch.js";
import { outfits, DEFAULT_OUTFIT } from "../agent/prompts/outfits.js";
import { getKv } from "../db/kv.js";

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
      case "update_config": {
        const parts: string[] = [];
        if (parsed.kana_name) parts.push(`kana_name=${parsed.kana_name}`);
        if (parsed.user_name) parts.push(`user_name=${parsed.user_name}`);
        if (parsed.user_nickname) parts.push(`user_nickname=${parsed.user_nickname}`);
        if (parsed.daily_budget != null) parts.push(`daily_budget=${parsed.daily_budget}`);
        if (parsed.session_token_limit != null) parts.push(`session_token_limit=${parsed.session_token_limit}`);
        return parts.join(", ") || argsJson;
      }
      case "read_file":
        return parsed.path ?? argsJson;
      case "recall":
        return parsed.query ?? argsJson;
      case "write_file":
        return `${parsed.path} (${parsed.content?.length ?? 0} chars)`;
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
  const [outfitSelecting, setOutfitSelecting] = useState(false);
  const [, setVitalsTick] = useState(0);

  const mergeEntries = useCallback((): Entry[] => {
    return [...agent.getEntries()];
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
    ev.on("outfit:select", () => {
      setOutfitSelecting(true);
    });
    ev.on("chat:error", (errMsg) => {
      setEntries((prev) => [
        ...prev,
        { message: { role: "error", content: errMsg } },
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

  const handleOutfitSelect = useCallback(
    (outfit: { name: string }) => {
      setOutfitSelecting(false);
      dispatch.handle(`/outfit ${outfit.name}`);
    },
    [dispatch],
  );

  const handleOutfitCancel = useCallback(() => {
    setOutfitSelecting(false);
  }, []);

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

      {outfitSelecting ? (
        <OutfitMenu
          outfits={outfits}
          currentName={getKv("outfit") ?? DEFAULT_OUTFIT.name}
          onSelect={handleOutfitSelect}
          onCancel={handleOutfitCancel}
        />
      ) : pendingApproval ? (
        <ApprovalBar onApproval={handleApproval} />
      ) : (
        <InputBar onSubmit={handleSubmit} disabled={loading} commands={dispatch.commands} />
      )}
      <StatusBar vitals={agent.vitals} model={model} />
    </Box>
  );
}
