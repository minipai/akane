import { z } from "zod";
import { zodFunction } from "openai/helpers/zod";
import type { Memory } from "../memory/memory.js";
import type { Cache } from "../../boot/cache.js";
import type { Compressor } from "../../types.js";

const CATEGORY_DEFS = [
  { category: "identity",    label: "Identity & Background",    subtopics: ["name", "location", "language", "nationality", "timezone", "demographics"] },
  { category: "relations",   label: "Relationships",            subtopics: ["family", "partner", "kids", "close friends", "pets"] },
  { category: "career",      label: "Career & Skills",          subtopics: ["job", "industry", "skills", "tech stack", "professional goals"] },
  { category: "preferences", label: "Preferences & Lifestyle",  subtopics: ["food", "colors", "aesthetics", "hobbies", "daily habits", "lifestyle"] },
  { category: "mindset",     label: "Personality & Mindset",    subtopics: ["personality traits", "beliefs", "ethics", "worldview", "interaction style"] },
  { category: "timeline",    label: "Timeline & Plans",         subtopics: ["life milestones", "goals", "commitments", "open loops", "plans"] },
] as const;

type Category = (typeof CATEGORY_DEFS)[number]["category"];
const categoryNames = CATEGORY_DEFS.map((d) => d.category) as [Category, ...Category[]];

function findDef(category: Category) {
  return CATEGORY_DEFS.find((d) => d.category === category)!;
}

import type { ToolContext } from "./index.js";

export const noteAboutUserSchema = z.object({
  category: z.enum(categoryNames).describe(
    "identity (demographics), relations (family/pets), career (job/skills), preferences (hobbies/food), mindset (personality/beliefs), timeline (milestones/plans)",
  ),
  fact: z.string().describe("The fact to remember, written as a concise statement"),
});

export const noteAboutUserToolDef = zodFunction({
  name: "note_about_user",
  description:
    "Remember a fact about the user. Call this when the user mentions personal details, preferences, or stable traits worth remembering long-term.",
  parameters: noteAboutUserSchema,
});

export const getUserFactsSchema = z.object({
  category: z.enum(categoryNames).describe("The category to retrieve facts for"),
});

export const getUserFactsToolDef = zodFunction({
  name: "get_user_facts",
  description:
    "Retrieve all remembered facts about the user for a given category. Use when you need detailed recall about a topic.",
  parameters: getUserFactsSchema,
});

export const updateUserFactSchema = z.object({
  id: z.number().describe("The ID of the fact to update or delete"),
  fact: z.string().nullable().optional().describe("The updated fact text (omit if deleting)"),
  delete: z.boolean().nullable().optional().describe("Set to true to delete the fact"),
});

export const updateUserFactToolDef = zodFunction({
  name: "update_user_fact",
  description:
    "Update or delete an existing fact about the user. Use when the user corrects something or when a fact is outdated.",
  parameters: updateUserFactSchema,
});

async function regenerateProfile(
  memory: Memory,
  compress: Compressor,
  category: Category,
): Promise<void> {
  const facts = memory.getFactsByCategory(category);
  if (facts.length === 0) {
    // No facts left — remove profile by upserting empty (or we could delete)
    // For safety, just skip — the profile stays stale but won't grow
    return;
  }

  const factList = facts.map((f) => `- ${f.fact}`).join("\n");
  const summary = await compress(
    `Summarize the following facts about a user into a concise profile paragraph (2-4 sentences). ` +
    `Category: ${findDef(category).label}. Write in third person. ` +
    `Reply with ONLY the summary, nothing else.`,
    factList,
  );

  if (summary.trim()) {
    memory.upsertProfile(category, summary.trim());
  }
}

export async function generateNextQuestion(
  memory: Memory,
  cache: Cache,
  compress: Compressor,
): Promise<void> {
  const def = CATEGORY_DEFS[Math.floor(Math.random() * CATEGORY_DEFS.length)];
  const topic = def.subtopics[Math.floor(Math.random() * def.subtopics.length)];

  const category = def.category;
  const profiles = memory.getAllProfiles();
  const known = profiles[category];

  let prompt =
    `Write a short, casual question asking someone about ${topic}.\n` +
    `The question must ask about a concrete fact, not feelings or hypotheticals.\n` +
    `Reply with ONLY the question, nothing else. No quotes. One sentence.`;

  if (known) {
    prompt += `\n\nWe already know this about them:\n${known}\nAsk about something NOT covered above.`;
  }

  const question = await compress("", prompt);
  if (question.trim()) {
    cache.nextQuestion = `[${category}] ${question.trim()}`;
  }
}

export async function executeNoteAboutUser(
  category: Category,
  fact: string,
  ctx: ToolContext,
): Promise<string> {
  const id = ctx.memory.insertFact(category, fact);
  await regenerateProfile(ctx.memory, ctx.compress, category);
  generateNextQuestion(ctx.memory, ctx.cache, ctx.compress);
  return `Noted (id=${id}): ${fact}`;
}

export async function executeGetUserFacts(
  category: Category,
  ctx: ToolContext,
): Promise<string> {
  const facts = ctx.memory.getFactsByCategory(category);
  if (facts.length === 0) return `No facts recorded for "${category}".`;
  return facts.map((f) => `[${f.id}] ${f.fact}`).join("\n");
}

export async function executeUpdateUserFact(
  id: number,
  fact: string | undefined,
  del: boolean | undefined,
  ctx: ToolContext,
): Promise<string> {
  const category = ctx.memory.getCategoryForFact(id);
  if (!category) return `Fact #${id} not found.`;

  if (del) {
    ctx.memory.deleteFact(id);
    await regenerateProfile(ctx.memory, ctx.compress, category);
    generateNextQuestion(ctx.memory, ctx.cache, ctx.compress);
    return `Deleted fact #${id}.`;
  }

  if (fact) {
    ctx.memory.updateFact(id, fact);
    await regenerateProfile(ctx.memory, ctx.compress, category);
    generateNextQuestion(ctx.memory, ctx.cache, ctx.compress);
    return `Updated fact #${id}: ${fact}`;
  }

  return "No changes — provide either 'fact' or 'delete: true'.";
}
