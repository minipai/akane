import { eq } from "drizzle-orm";
import type { Db } from "../../db/db.js";
import { userFacts, userProfile } from "../../db/schema.js";

export type Category = "identity" | "relations" | "career" | "preferences" | "mindset" | "timeline";

export function insertFact(db: Db, category: Category, fact: string): number {
  const now = new Date().toISOString();
  const result = db
    .insert(userFacts)
    .values({ category, fact, createdAt: now, updatedAt: now })
    .returning({ id: userFacts.id })
    .get();
  return result.id;
}

export function getFactsByCategory(db: Db, category: Category): { id: number; fact: string }[] {
  return db
    .select({ id: userFacts.id, fact: userFacts.fact })
    .from(userFacts)
    .where(eq(userFacts.category, category))
    .all();
}

export function getCategoryForFact(db: Db, id: number): Category | null {
  const row = db
    .select({ category: userFacts.category })
    .from(userFacts)
    .where(eq(userFacts.id, id))
    .get();
  return (row?.category as Category) ?? null;
}

export function updateFact(db: Db, id: number, fact: string): void {
  db.update(userFacts)
    .set({ fact, updatedAt: new Date().toISOString() })
    .where(eq(userFacts.id, id))
    .run();
}

export function deleteFact(db: Db, id: number): void {
  db.delete(userFacts).where(eq(userFacts.id, id)).run();
}

export function upsertProfile(db: Db, category: Category, summary: string): void {
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

export function getAllProfiles(db: Db): Record<string, string> {
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
