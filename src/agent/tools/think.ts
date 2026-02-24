import { z } from "zod";
import { zodFunction } from "openai/helpers/zod";

export const thinkSchema = z.object({
  thought: z.string().describe("Your reasoning, plan, or reflection"),
});

export const thinkToolDef = zodFunction({
  name: "think",
  description:
    "Use this tool to plan your approach, reason through a problem, or reflect on a tool result before deciding what to do next. The thought itself is what matters — use it between steps in multi-step tasks.",
  parameters: thinkSchema,
});

export function executeThink(): string {
  return "OK";
}
