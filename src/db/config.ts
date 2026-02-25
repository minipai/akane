import { eq } from "drizzle-orm";
import { getDb } from "./db.js";
import { config } from "./schema.js";

const DEFAULTS: Record<string, string> = {
  kana_name: "かな",
  user_name: "User",
  user_nickname: "ご主人様",
  daily_budget: "1",
  session_token_limit: "100000",
  language: "English",
};

/** Get a config value from DB, falling back to a built-in default. */
export function getConfigWithDefault(key: string): string {
  return getConfig(key) ?? DEFAULTS[key] ?? "";
}

export function getConfig(key: string): string | null {
  const db = getDb();
  const row = db
    .select({ value: config.value })
    .from(config)
    .where(eq(config.key, key))
    .get();
  return row?.value ?? null;
}

export function setConfig(key: string, value: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  const existing = db
    .select({ key: config.key })
    .from(config)
    .where(eq(config.key, key))
    .get();

  if (existing) {
    db.update(config)
      .set({ value, updatedAt: now })
      .where(eq(config.key, key))
      .run();
  } else {
    db.insert(config)
      .values({ key, value, updatedAt: now })
      .run();
  }
}

/** Get a config value as a number, falling back to a built-in default. */
export function getConfigNumber(key: string): number {
  const val = getConfig(key) ?? DEFAULTS[key];
  return val ? parseFloat(val) : 0;
}

export function getAllConfig(): Record<string, string> {
  const db = getDb();
  const rows = db.select({ key: config.key, value: config.value }).from(config).all();
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}
