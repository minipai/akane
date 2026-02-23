import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");
export const DATA_DIR = join(PROJECT_ROOT, "data");
mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = join(DATA_DIR, "memory.db");
const MIGRATIONS_DIR = join(PROJECT_ROOT, "drizzle");

export type Db = ReturnType<typeof drizzle<typeof schema>>;

let db: Db | null = null;

export function getDb() {
  if (!db) {
    const sqlite = new Database(DB_PATH);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");

    db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  }
  return db;
}
