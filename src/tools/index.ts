import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { shellToolDef, executeShell } from "./shell.js";

export const tools: ChatCompletionTool[] = [shellToolDef];

export function formatToolArgs(name: string, argsJson: string): string {
  try {
    const parsed = JSON.parse(argsJson);
    switch (name) {
      case "shell":
        return parsed.command ?? argsJson;
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
    default:
      return `Unknown tool: ${name}`;
  }
}
