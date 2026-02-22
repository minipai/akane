import { eq } from "drizzle-orm";
import { getDb } from "../db/db.js";
import { userFacts, userProfile } from "../db/schema.js";

const CATEGORY_DEFS = [
  { category: "identity",    label: "Identity & Background",    subtopics: ["name", "location", "language", "nationality", "timezone", "demographics"] },
  { category: "relations",   label: "Relationships",            subtopics: ["family", "partner", "kids", "close friends", "pets"] },
  { category: "career",      label: "Career & Skills",          subtopics: ["job", "industry", "skills", "tech stack", "professional goals"] },
  { category: "preferences", label: "Preferences & Lifestyle",  subtopics: ["food", "colors", "aesthetics", "hobbies", "daily habits", "lifestyle"] },
  { category: "mindset",     label: "Personality & Mindset",    subtopics: ["personality traits", "beliefs", "ethics", "worldview", "interaction style"] },
  { category: "timeline",    label: "Timeline & Plans",         subtopics: ["life milestones", "goals", "commitments", "open loops", "plans"] },
] as const;

export const CATEGORIES = CATEGORY_DEFS.map((d) => d.category);
export type Category = (typeof CATEGORY_DEFS)[number]["category"];
export const CATEGORY_LABELS = Object.fromEntries(CATEGORY_DEFS.map((d) => [d.category, d.label])) as Record<Category, string>;
export const SUBTOPICS = Object.fromEntries(CATEGORY_DEFS.map((d) => [d.category, d.subtopics as unknown as string[]])) as Record<Category, string[]>;

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

