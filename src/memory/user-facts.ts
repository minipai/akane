import { eq } from "drizzle-orm";
import type { ChatClient } from "../types.js";
import { getDb } from "./db.js";
import { userFacts, userProfile } from "./schema.js";
import { getKv, setKv } from "./kv.js";

export const CATEGORIES = [
  "identity",    // name, location, language, nationality, timezone, demographics
  "relations",   // family, partner, kids, close friends, pets
  "career",      // job, industry, skills, tech stack, professional goals
  "preferences", // food, colors, aesthetics, hobbies, daily habits, lifestyle
  "mindset",     // personality traits, beliefs, ethics, worldview, interaction style
  "timeline",    // life milestones, goals, commitments, open loops, plans
] as const;

export type Category = (typeof CATEGORIES)[number];

export function insertFact(category: Category, fact: string): number {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .insert(userFacts)
    .values({ category, fact, createdAt: now, updatedAt: now })
    .returning({ id: userFacts.id })
    .get();
  return result.id;
}

export function getFactsByCategory(
  category: Category,
): { id: number; fact: string }[] {
  const db = getDb();
  return db
    .select({ id: userFacts.id, fact: userFacts.fact })
    .from(userFacts)
    .where(eq(userFacts.category, category))
    .all();
}

export function getCategoryForFact(id: number): Category | null {
  const db = getDb();
  const row = db
    .select({ category: userFacts.category })
    .from(userFacts)
    .where(eq(userFacts.id, id))
    .get();
  return (row?.category as Category) ?? null;
}

export function updateFact(id: number, fact: string): void {
  const db = getDb();
  db.update(userFacts)
    .set({ fact, updatedAt: new Date().toISOString() })
    .where(eq(userFacts.id, id))
    .run();
}

export function deleteFact(id: number): void {
  const db = getDb();
  db.delete(userFacts).where(eq(userFacts.id, id)).run();
}

export function upsertProfile(category: Category, summary: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db
    .select({ category: userProfile.category })
    .from(userProfile)
    .where(eq(userProfile.category, category))
    .get();

  if (existing) {
    db.update(userProfile)
      .set({ summary, updatedAt: now })
      .where(eq(userProfile.category, category))
      .run();
  } else {
    db.insert(userProfile)
      .values({ category, summary, updatedAt: now })
      .run();
  }
}

export function getAllProfiles(): Record<string, string> {
  const db = getDb();
  const rows = db
    .select({ category: userProfile.category, summary: userProfile.summary })
    .from(userProfile)
    .all();
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.category] = row.summary;
  }
  return result;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  identity: "Identity & Background",
  relations: "Relationships",
  career: "Career & Skills",
  preferences: "Preferences & Lifestyle",
  mindset: "Personality & Mindset",
  timeline: "Timeline & Plans",
};

export async function regenerateProfile(
  client: ChatClient,
  model: string,
  category: Category,
): Promise<void> {
  const facts = getFactsByCategory(category);
  if (facts.length === 0) {
    // No facts left — remove profile
    const db = getDb();
    db.delete(userProfile).where(eq(userProfile.category, category)).run();
    return;
  }

  const factList = facts.map((f) => `- ${f.fact}`).join("\n");
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          `Summarize the following facts about a user into a concise profile paragraph (2-4 sentences). ` +
          `Category: ${CATEGORY_LABELS[category]}. Write in third person. ` +
          `Reply with ONLY the summary, nothing else.`,
      },
      { role: "user", content: factList },
    ],
  });

  const summary = response.choices[0]?.message?.content?.trim();
  if (summary) {
    upsertProfile(category, summary);
  }
}

const SUBTOPICS: Record<Category, string[]> = {
  identity: ["where they grew up", "what languages they speak", "their nationality", "their timezone or city"],
  relations: ["their family", "whether they have pets", "their closest friends", "their partner or dating life"],
  career: ["what they do for work", "what programming languages they use", "their tech stack", "their career goals"],
  preferences: ["their favorite food", "their hobbies", "what music they listen to", "their morning routine"],
  mindset: ["what motivates them", "their personal philosophy", "how they handle stress", "what they value most"],
  timeline: ["what they're working on lately", "their plans for the weekend", "a recent life milestone", "their goals for this year"],
};

export async function generateNextQuestion(
  client: ChatClient,
  model: string,
): Promise<void> {
  // Pick a random category and subtopic
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const subs = SUBTOPICS[category];
  const topic = subs[Math.floor(Math.random() * subs.length)];

  const profiles = getAllProfiles();
  const known = profiles[category];

  let prompt =
    `Write a short, casual question asking someone about ${topic}.\n` +
    `The question must ask about a concrete fact, not feelings or hypotheticals.\n` +
    `Reply with ONLY the question, nothing else. No quotes. One sentence.`;

  if (known) {
    prompt += `\n\nWe already know this about them:\n${known}\nAsk about something NOT covered above.`;
  }

  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
  });

  const question = response.choices[0]?.message?.content?.trim();
  if (question) {
    setKv("next_question", `[${category}] ${question}`);
  }
}
