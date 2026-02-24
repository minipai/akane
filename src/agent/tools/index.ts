import type { Memory } from "../memory/memory.js";
import type { Cache } from "../../boot/cache.js";
import type { Compressor, InfoEntry, ToolDef } from "../../types.js";
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
import { describeAgentToolDef, executeDescribeAgent } from "./describe.js";
import { restSessionToolDef, executeRestSession } from "./rest.js";
import { updateConfigToolDef, executeUpdateConfig } from "./config.js";
import { thinkToolDef, executeThink } from "./think.js";
import {
  readFileToolDef,
  writeFileToolDef,
  executeReadFile,
  executeWriteFile,
} from "./file.js";

export interface ToolContext {
  memory: Memory;
  cache: Cache;
  compress: Compressor;
  addInfo: (info: InfoEntry) => void;
  onRest?: () => void;
  refreshPrompt?: () => void;
}

export const tools: ToolDef[] = [
  shellToolDef,
  emotionToolDef,
  noteAboutUserToolDef,
  getUserFactsToolDef,
  updateUserFactToolDef,
  describeAgentToolDef,
  restSessionToolDef,
  updateConfigToolDef,
  thinkToolDef,
  readFileToolDef,
  writeFileToolDef,
];

/** Tools that don't need a follow-up LLM call — their output is the final response. */
export const terminalTools = new Set(["rest_session"]);

/** Tools that are auto-approved (no user confirmation needed). */
export const autoApprovedTools = new Set([
  "set_emotion",
  "note_about_user",
  "get_user_facts",
  "update_user_fact",
  "describe_agent",
  "rest_session",
  "update_config",
  "think",
  "read_file",
]);

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
    case "describe_agent":
      return executeDescribeAgent(parsed.description, ctx.addInfo);
    case "rest_session":
      ctx.onRest?.();
      return executeRestSession(parsed.description, ctx.addInfo);
    case "update_config":
      return executeUpdateConfig(parsed, ctx.refreshPrompt ?? (() => {}));
    case "think":
      return executeThink();
    case "read_file":
      return executeReadFile(parsed.path);
    case "write_file":
      return executeWriteFile(parsed.path, parsed.content);
    default:
      return `Unknown tool: ${name}`;
  }
}
