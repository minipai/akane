import React from "react";
import { render } from "ink";
import config from "./core/config.js";
import { createClient } from "./core/client.js";
import { Agent } from "./core/agent.js";
import { buildSystemPrompt } from "./prompts/index.js";
import type { MemoryContext } from "./prompts/index.js";
import {
  initMemory,
  getRecentConversationSummary,
  getRecentDiaries,
  generateDiary,
} from "./memory/index.js";
import { getAllProfiles, generateNextQuestion } from "./memory/user-facts.js";
import { setUserFactsContext } from "./tools/index.js";
import { getKv } from "./memory/kv.js";
import App from "./components/App.js";

// Initialize memory and fire-and-forget background tasks
initMemory();

const { client, model } = createClient(config);

generateDiary(client, model);
setUserFactsContext(client, model);

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

const agent = new Agent(client, model, () => buildSystemPrompt(buildMemory()));
const displayFromIndex = agent.start();

const instance = render(
  <App agent={agent} model={model} displayFromIndex={displayFromIndex} />,
  { exitOnCtrlC: false },
);

// Handle graceful shutdown — no summary on exit, session stays open
instance.waitUntilExit().then(() => {});
