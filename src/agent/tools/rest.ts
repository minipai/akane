import { z } from "zod";
import { zodFunction } from "openai/helpers/zod";
import type { InfoEntry } from "../../types.js";

export const restSessionToolDef = zodFunction({
  name: "rest_session",
  description:
    "End the current session. Call this when the user wants to rest. Pass a second-person narrative description of how you settle down to rest.",
  parameters: z.object({
    description: z.string().describe(
      "Second-person narrative prose describing how you settle down to rest (e.g. stretching, yawning, curling up).",
    ),
  }),
});

export function executeRestSession(
  description: string,
  addInfo: (info: InfoEntry) => void,
): string {
  addInfo({ kind: "info", label: "/rest", content: description, ts: Date.now() });
  return "Session ended.";
}
