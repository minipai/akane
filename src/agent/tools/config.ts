import { z } from "zod";
import { zodFunction } from "openai/helpers/zod";
import { setConfig } from "../../db/config.js";

export const updateConfigSchema = z.object({
  kana_name: z.string().nullable().optional().describe("Kana's display name"),
  user_name: z.string().nullable().optional().describe("The user's real name"),
  user_nickname: z.string().nullable().optional().describe("How Kana addresses the user"),
  daily_budget: z.number().nullable().optional().describe("Daily API budget in USD"),
  session_token_limit: z.number().nullable().optional().describe("Max tokens per session"),
});

export const updateConfigToolDef = zodFunction({
  name: "update_config",
  description:
    "Update persona configuration values. Call this when the user wants to change how they or you are named, or adjust budget settings.",
  parameters: updateConfigSchema,
});

export function executeUpdateConfig(
  params: z.infer<typeof updateConfigSchema>,
  refreshPrompt: () => void,
): string {
  const updated: string[] = [];

  if (params.kana_name) {
    setConfig("kana_name", params.kana_name);
    updated.push(`kana_name → ${params.kana_name}`);
  }
  if (params.user_name) {
    setConfig("user_name", params.user_name);
    updated.push(`user_name → ${params.user_name}`);
  }
  if (params.user_nickname) {
    setConfig("user_nickname", params.user_nickname);
    updated.push(`user_nickname → ${params.user_nickname}`);
  }
  if (params.daily_budget != null) {
    setConfig("daily_budget", String(params.daily_budget));
    updated.push(`daily_budget → ${params.daily_budget}`);
  }
  if (params.session_token_limit != null) {
    setConfig("session_token_limit", String(params.session_token_limit));
    updated.push(`session_token_limit → ${params.session_token_limit}`);
  }

  if (updated.length === 0) {
    return "No values provided to update.";
  }

  refreshPrompt();
  return `Updated: ${updated.join(", ")}`;
}
