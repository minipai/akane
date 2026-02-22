import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { Memory } from "../memory/memory.js";
import type { Cache } from "../boot/cache.js";
import type { Compressor } from "../types.js";
import { shellToolDef, executeShell } from "./shell.js";
import { emotionToolDef, executeEmotion } from "./emotion.js";
import {
  noteAboutUserToolDef,
  getUserFactsToolDef,
  updateUserFactToolDef,
  executeNoteAboutUser,
  executeGetUserFacts,
  executeUpdateUserFact,
} from "./user-facts.js";

export interface ToolContext {
  memory: Memory;
  cache: Cache;
  compress: Compressor;
}

export const tools: ChatCompletionTool[] = [
  shellToolDef,
  emotionToolDef,
  noteAboutUserToolDef,
  getUserFactsToolDef,
  updateUserFactToolDef,
];

/** Tools that are auto-approved (no user confirmation needed). */
export const autoApprovedTools = new Set([
  "set_emotion",
  "note_about_user",
  "get_user_facts",
  "update_user_fact",
]);

export function formatToolArgs(name: string, argsJson: string): string {
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
      default:
        return argsJson;
    }
  } catch {
    return argsJson;
  }
}

export async function executeTool(
  name: string,
  args: string,
  ctx: ToolContext,
): Promise<string> {
  const parsed = JSON.parse(args);

  switch (name) {
    case "shell":
      return executeShell(parsed.command);
    case "set_emotion":
      return executeEmotion(parsed.emotion);
    case "note_about_user":
      return executeNoteAboutUser(parsed.category, parsed.fact, ctx);
    case "get_user_facts":
      return executeGetUserFacts(parsed.category, ctx);
    case "update_user_fact":
      return executeUpdateUserFact(parsed.id, parsed.fact, parsed.delete, ctx);
    default:
      return `Unknown tool: ${name}`;
  }
}
