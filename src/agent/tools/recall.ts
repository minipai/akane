import { z } from "zod";
import { zodFunction } from "openai/helpers/zod";
import type { ToolContext } from "./index.js";

export const recallToolDef = zodFunction({
  name: "recall",
  description:
    "Search your diary memories by keyword. Use this when the user references something from the past and you want to verify details, or when you need context about previous conversations that aren't in your recent memory.",
  parameters: z.object({
    query: z.string().describe("Keyword or phrase to search for in diary entries"),
  }),
});

export function executeRecall(query: string, ctx: ToolContext): string {
  const results = ctx.memory.recall(query);
  if (results.length === 0) return "No matching memories found.";
  return results
    .map((r) => `[${r.type} ${r.date}] ${r.summary}`)
    .join("\n\n");
}
