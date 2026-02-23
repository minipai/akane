import { z } from "zod";
import { zodFunction } from "openai/helpers/zod";
import type { InfoEntry } from "../../types.js";

export const describeAgentToolDef = zodFunction({
  name: "describe_agent",
  description:
    "Render a descriptive info block about your appearance. Call this when the user looks at you.",
  parameters: z.object({
    description: z.string().describe(
      "Second-person narrative description of your appearance, clothing, expression, and features.",
    ),
  }),
});

export function executeDescribeAgent(
  description: string,
  addInfo: (info: InfoEntry) => void,
): string {
  addInfo({ kind: "info", label: "/look", content: description, ts: Date.now() });
  return "Description rendered.";
}
