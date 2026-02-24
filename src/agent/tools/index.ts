import type { Memory } from "../memory/memory.js";
import type { Cache } from "../../boot/cache.js";
import type { Compressor, InfoEntry, ToolDef } from "../../types.js";
import { shellToolDef, shellSchema, executeShell } from "./shell.js";
import { emotionToolDef, emotionSchema, executeEmotion } from "./emotion.js";
import {
  noteAboutUserToolDef,
  noteAboutUserSchema,
  getUserFactsToolDef,
  getUserFactsSchema,
  updateUserFactToolDef,
  updateUserFactSchema,
  executeNoteAboutUser,
  executeGetUserFacts,
  executeUpdateUserFact,
} from "./user-facts.js";
import {
  describeAgentToolDef,
  describeAgentSchema,
  executeDescribeAgent,
} from "./describe.js";
import {
  restSessionToolDef,
  restSessionSchema,
  executeRestSession,
} from "./rest.js";
import {
  updateConfigToolDef,
  updateConfigSchema,
  executeUpdateConfig,
} from "./config.js";
import { thinkToolDef, executeThink } from "./think.js";
import {
  readFileToolDef,
  readFileSchema,
  writeFileToolDef,
  writeFileSchema,
  executeReadFile,
  executeWriteFile,
} from "./file.js";
import { recallToolDef, recallSchema, executeRecall } from "./recall.js";

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
  recallToolDef,
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
  "recall",
]);

export async function executeTool(
  name: string,
  args: string,
  ctx: ToolContext,
): Promise<string> {
  switch (name) {
    case "shell": {
      const { command } = shellSchema.parse(JSON.parse(args));
      return executeShell(command);
    }
    case "set_emotion": {
      const { emotion } = emotionSchema.parse(JSON.parse(args));
      return executeEmotion(emotion);
    }
    case "note_about_user": {
      const { category, fact } = noteAboutUserSchema.parse(JSON.parse(args));
      return executeNoteAboutUser(category, fact, ctx);
    }
    case "get_user_facts": {
      const { category } = getUserFactsSchema.parse(JSON.parse(args));
      return executeGetUserFacts(category, ctx);
    }
    case "update_user_fact": {
      const {
        id,
        fact,
        delete: del,
      } = updateUserFactSchema.parse(JSON.parse(args));
      return executeUpdateUserFact(
        id,
        fact ?? undefined,
        del ?? undefined,
        ctx,
      );
    }
    case "describe_agent": {
      const { description } = describeAgentSchema.parse(JSON.parse(args));
      return executeDescribeAgent(description, ctx.addInfo);
    }
    case "rest_session": {
      const { description } = restSessionSchema.parse(JSON.parse(args));
      ctx.onRest?.();
      return executeRestSession(description, ctx.addInfo);
    }
    case "update_config": {
      const parsed = updateConfigSchema.parse(JSON.parse(args));
      return executeUpdateConfig(parsed, ctx.refreshPrompt ?? (() => {}));
    }
    case "think":
      return executeThink();
    case "read_file": {
      const { path } = readFileSchema.parse(JSON.parse(args));
      return executeReadFile(path);
    }
    case "write_file": {
      const { path, content } = writeFileSchema.parse(JSON.parse(args));
      return executeWriteFile(path, content);
    }
    case "recall": {
      const { query } = recallSchema.parse(JSON.parse(args));
      return executeRecall(query, ctx);
    }
    default:
      return `Unknown tool: ${name}`;
  }
}
