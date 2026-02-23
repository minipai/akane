import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { outfits, DEFAULT_OUTFIT } from "./outfits.js";
import { getKv } from "../../db/kv.js";

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

export interface MemoryContext {
  recentSummary: string | null;
  dailies: string[];
  weeklies: string[];
  monthlies: string[];
  quarterlies: string[];
  yearlies: string[];
  userProfile: Record<string, string>;
}

export function buildSystemPrompt(memory?: MemoryContext): string {
  let identity = readPromptFile("IDENTITY.md");
  const agent = readPromptFile("AGENT.md");
  const user = readPromptFile("USER.md");

  // Inject current outfit into Appearance section
  const outfitName = getKv("outfit") ?? DEFAULT_OUTFIT.name;
  const outfit = outfits.find((o) => o.name === outfitName) ?? DEFAULT_OUTFIT;
  identity = identity.replace(
    /## Appearance\n/,
    `## Appearance\n- **服裝：** ${outfit.description}\n`,
  );

  let raw = `# Agent\n${agent}\n\n# Identity\n${identity}\n\n# User\n${user}`;

  if (memory) {
    const profileEntries = Object.entries(memory.userProfile);
    if (profileEntries.length > 0) {
      const profileSections = profileEntries
        .map(([category, summary]) => `## ${category.charAt(0).toUpperCase() + category.slice(1)}\n${summary}`)
        .join("\n\n");
      raw += `\n\n# User Profile\n${profileSections}`;
    }
  }

  const sections: string[] = [];

  if (memory) {
    if (memory.yearlies.length > 0) {
      sections.push(`## Recent years\n${memory.yearlies.map((s) => `- ${s}`).join("\n")}`);
    }
    if (memory.quarterlies.length > 0) {
      sections.push(`## Recent quarters\n${memory.quarterlies.map((s) => `- ${s}`).join("\n")}`);
    }
    if (memory.monthlies.length > 0) {
      sections.push(`## Recent months\n${memory.monthlies.map((s) => `- ${s}`).join("\n")}`);
    }
    if (memory.weeklies.length > 0) {
      sections.push(`## Recent weeks\n${memory.weeklies.map((s) => `- ${s}`).join("\n")}`);
    }
    if (memory.dailies.length > 0) {
      sections.push(`## Recent days\n${memory.dailies.map((s) => `- ${s}`).join("\n")}`);
    }

    if (sections.length > 0) {
      raw += `\n\n# Memory\n${sections.join("\n\n")}`;
    }

    if (memory.recentSummary) {
      raw += `\n\n# Earlier today\n${memory.recentSummary}`;
    }
  }

  return replaceVars(raw);
}
