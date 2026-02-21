import React from "react";
import { render } from "ink";
import config from "./config.js";
import { createClient } from "./client.js";
import { Agent } from "./agent.js";
import { buildSystemPrompt } from "./prompts/index.js";
import {
  initMemory,
  createConversation,
  endConversation,
  getTodaySummaries,
} from "./memory/index.js";
import App from "./components/App.js";

// Initialize memory and load previous summaries
initMemory();
const summaries = getTodaySummaries();

const conversationId = createConversation();

const { client, model } = createClient(config);
const systemPrompt = buildSystemPrompt(summaries);
const agent = new Agent(client, model, systemPrompt);
agent.setConversationId(conversationId);

async function generateSummary(): Promise<string | undefined> {
  const entries = agent.getEntries();
  // Only summarize if there are actual user/assistant messages beyond the system prompt
  const hasContent = entries.some(
    (e) => e.message.role === "user" || e.message.role === "assistant",
  );
  if (!hasContent) return undefined;

  const summaryMessages = [
    {
      role: "system" as const,
      content:
        "Summarize the following conversation in 1-2 concise sentences. Focus on the key topics discussed and any outcomes. Reply with ONLY the summary, nothing else.",
    },
    {
      role: "user" as const,
      content: entries
        .filter(
          (e) => e.message.role === "user" || e.message.role === "assistant",
        )
        .map((e) => {
          const content =
            typeof e.message.content === "string" ? e.message.content : "";
          return `${e.message.role}: ${content}`;
        })
        .join("\n"),
    },
  ];

  try {
    const response = await client.chat.completions.create({
      model,
      messages: summaryMessages,
    });
    return response.choices[0]?.message?.content ?? undefined;
  } catch {
    return undefined;
  }
}

async function cleanup() {
  const summary = await generateSummary();
  endConversation(conversationId, summary);
}

const instance = render(
  <App agent={agent} model={model} contextLimit={config.contextLimit} />,
);

// Handle graceful shutdown
instance.waitUntilExit().then(() => cleanup());
