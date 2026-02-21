import { eq } from "drizzle-orm";
import { getDb } from "./db.js";
import { kvStore } from "./schema.js";

export function getKv(key: string): string | null {
  const db = getDb();
  const row = db
    .select({ value: kvStore.value })
    .from(kvStore)
    .where(eq(kvStore.key, key))
    .get();
  return row?.value ?? null;
}

export function setKv(key: string, value: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db
    .select({ key: kvStore.key })
    .from(kvStore)
    .where(eq(kvStore.key, key))
    .get();

  if (existing) {
    db.update(kvStore)
      .set({ value, updatedAt: now })
      .where(eq(kvStore.key, key))
      .run();
  } else {
    db.insert(kvStore)
      .values({ key, value, updatedAt: now })
      .run();
  }
}
