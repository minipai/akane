import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { shellToolDef, executeShell } from "./shell.js";

export const tools: ChatCompletionTool[] = [shellToolDef];

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
