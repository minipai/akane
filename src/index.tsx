import React from "react";
import { render } from "ink";
import config from "./config.js";
import { createClient } from "./client.js";
import { Agent } from "./agent.js";
import { buildSystemPrompt } from "./prompts/index.js";
import type { MemoryContext } from "./prompts/index.js";
import {
  initMemory,
  createConversation,
  endConversation,
  getActiveConversation,
  getConversationMessages,
  getRecentConversationSummary,
  updateRecentConversationSummary,
  getRecentDiaries,
  generateDiary,
} from "./memory/index.js";
import { getAllProfiles, generateNextQuestion } from "./memory/user-facts.js";
import { setUserFactsContext } from "./tools/index.js";
import { getKv } from "./memory/kv.js";
import { MP_DISPLAY_MAX } from "./components/StatusBar.js";
import App from "./components/App.js";

// Initialize memory and load previous summaries
initMemory();

const { client, model } = createClient(config);

// Fire-and-forget diary generation (don't block startup)
generateDiary(client, model);

// Wire up client/model for user-facts tool (needs LLM for profile regeneration)
setUserFactsContext(client, model);

// Seed opener question on first run only (fire-and-forget)
if (!getKv("next_question")) {
  generateNextQuestion(client, model).catch(() => {});
}

// Build memory context from DB
function buildMemory(): MemoryContext {
  return {
    recentSummary: getRecentConversationSummary(),
    dailies: getRecentDiaries("daily", 7),
    weeklies: getRecentDiaries("weekly", 3),
    monthlies: getRecentDiaries("monthly", 2),
    quarterlies: getRecentDiaries("quarterly", 3),
    yearlies: getRecentDiaries("yearly", 3),
    userProfile: getAllProfiles(),
  };
}

const systemPrompt = buildSystemPrompt(buildMemory());
const agent = new Agent(client, model, systemPrompt);
agent.setMpMax(MP_DISPLAY_MAX);

// Resume active session or create a new one
let displayFromIndex = 0;
const existingId = getActiveConversation();
if (existingId) {
  agent.setConversationId(existingId);
  const allMessages = getConversationMessages(existingId);
  agent.hydrate(allMessages);
  // Show only last 2 pairs (4 messages) from previous session; +1 for system prompt entry
  displayFromIndex = Math.max(0, allMessages.length - 4) + 1;
} else {
  const newId = createConversation();
  agent.setConversationId(newId);
}

async function generateSummary(): Promise<string | undefined> {
  const entries = agent.getEntries();
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

async function resetSession(): Promise<void> {
  const currentId = agent.getConversationId();

  // Reset agent immediately so it's ready for new session
  const newPrompt = buildSystemPrompt(buildMemory());
  agent.reset(newPrompt);
  const newId = createConversation();
  agent.setConversationId(newId);

  // Await summary — caller shows resting message while this runs
  if (currentId) {
    try {
      const summary = await generateSummary();
      if (summary) {
        await updateRecentConversationSummary(client, model, summary);
      }
      endConversation(currentId, summary);
    } catch {
      endConversation(currentId);
    }
  }
}

const instance = render(
  <App agent={agent} model={model} contextLimit={config.contextLimit} resetSession={resetSession} displayFromIndex={displayFromIndex} />,
);

// Handle graceful shutdown — no summary on exit, session stays open
instance.waitUntilExit().then(() => {});
