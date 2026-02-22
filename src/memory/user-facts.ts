import { eq } from "drizzle-orm";
import { getDb } from "../db/db.js";
import { userFacts, userProfile } from "../db/schema.js";

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

export const SUBTOPICS: Record<Category, string[]> = {
  identity: ["where they grew up", "what languages they speak", "their nationality", "their timezone or city"],
  relations: ["their family", "whether they have pets", "their closest friends", "their partner or dating life"],
  career: ["what they do for work", "what programming languages they use", "their tech stack", "their career goals"],
  preferences: ["their favorite food", "their hobbies", "what music they listen to", "their morning routine"],
  mindset: ["what motivates them", "their personal philosophy", "how they handle stress", "what they value most"],
  timeline: ["what they're working on lately", "their plans for the weekend", "a recent life milestone", "their goals for this year"],
};
