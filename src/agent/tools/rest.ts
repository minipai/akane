import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type { InfoEntry } from "../../types.js";

export const restSessionToolDef: ChatCompletionTool = {
  type: "function",
  function: {
    name: "rest_session",
    description:
      "End the current session. Call this when the user wants to rest. Pass a second-person narrative description of how you settle down to rest.",
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description:
            "Second-person narrative prose describing how you settle down to rest (e.g. stretching, yawning, curling up).",
        },
      },
      required: ["description"],
      additionalProperties: false,
    },
  },
};

export function executeRestSession(
  description: string,
  addInfo: (info: InfoEntry) => void,
): string {
  addInfo({ kind: "info", label: "/rest", content: description, ts: Date.now() });
  return "Session ended.";
}
