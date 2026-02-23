import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { InfoEntry } from "../../types.js";

export const describeAgentToolDef: ChatCompletionTool = {
  type: "function",
  function: {
    name: "describe_agent",
    description:
      "Render a descriptive info block about your appearance. Call this when the user looks at you.",
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description:
            "Second-person narrative description of your appearance, clothing, expression, and features.",
        },
      },
      required: ["description"],
      additionalProperties: false,
    },
  },
};

export function executeDescribeAgent(
  description: string,
  addInfo: (info: InfoEntry) => void,
): string {
  addInfo({ kind: "info", label: "/look", content: description, ts: Date.now() });
  return "Description rendered.";
}
