import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readPromptFile(filename: string): string {
  return readFileSync(join(__dirname, filename), "utf-8").trim();
}

function replaceVars(text: string): string {
  const vars: Record<string, string | undefined> = {
    "{{KANA_NAME}}": process.env.KANA_NAME || "かな",
    "{{USER_NAME}}": process.env.USER_NAME || "User",
    "{{USER_NICKNAME}}": process.env.USER_NICKNAME || "ご主人様",
  };
  let result = text;
  for (const [placeholder, value] of Object.entries(vars)) {
    if (value) {
      result = result.replaceAll(placeholder, value);
    }
  }
  return result;
}

export function buildSystemPrompt(summaries?: string[]): string {
  const identity = readPromptFile("IDENTITY.md");
  const agent = readPromptFile("AGENT.md");
  const user = readPromptFile("USER.md");

  let raw = `# Identity\n${identity}\n\n# Agent\n${agent}\n\n# User\n${user}`;

  if (summaries && summaries.length > 0) {
    const items = summaries.map((s) => `- ${s}`).join("\n");
    raw += `\n\n# Earlier today\nHere's what we talked about earlier:\n${items}`;
  }

  return replaceVars(raw);
}
