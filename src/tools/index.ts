import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { shellToolDef, executeShell } from "./shell.js";
import { emotionToolDef, executeEmotion } from "./emotion.js";

export const tools: ChatCompletionTool[] = [shellToolDef, emotionToolDef];

/** Tools that are auto-approved (no user confirmation needed). */
export const autoApprovedTools = new Set(["set_emotion"]);

export function formatToolArgs(name: string, argsJson: string): string {
  try {
    const parsed = JSON.parse(argsJson);
    switch (name) {
      case "shell":
        return parsed.command ?? argsJson;
      case "set_emotion":
        return parsed.emotion ?? argsJson;
      default:
        return argsJson;
    }
  } catch {
    return argsJson;
  }
}

export async function executeTool(
  name: string,
  args: string
): Promise<string> {
  const parsed = JSON.parse(args);

  switch (name) {
    case "shell":
      return executeShell(parsed.command);
    case "set_emotion":
      return executeEmotion(parsed.emotion);
    default:
      return `Unknown tool: ${name}`;
  }
}
