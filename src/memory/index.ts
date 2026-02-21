import { randomUUID } from "crypto";
import { eq, desc, and, isNotNull, gte } from "drizzle-orm";
import { getDb } from "./db.js";
import { conversations, messages } from "./schema.js";
import type { ChatEntry } from "../types.js";

export function initMemory(): void {
  getDb(); // ensures DB + tables exist
}

export function createConversation(): string {
  const id = randomUUID();
  const db = getDb();
  db.insert(conversations)
    .values({ id, startedAt: new Date().toISOString() })
    .run();
  return id;
}

export function saveMessage(
  conversationId: string,
  entry: ChatEntry,
): void {
  const msg = entry.message;
  const role = "role" in msg ? (msg.role as string) : "unknown";
  const content =
    typeof msg.content === "string" ? msg.content : msg.content ? JSON.stringify(msg.content) : null;

  let toolCalls: string | null = null;
  if ("tool_calls" in msg && msg.tool_calls) {
    toolCalls = JSON.stringify(msg.tool_calls);
  }

  const db = getDb();
  db.insert(messages)
    .values({
      conversationId,
      role,
      content,
      emotion: entry.emotion ?? null,
      toolCalls,
      createdAt: new Date().toISOString(),
    })
    .run();
}

export function endConversation(
  conversationId: string,
  summary?: string,
): void {
  const db = getDb();
  db.update(conversations)
    .set({
      endedAt: new Date().toISOString(),
      summary: summary ?? null,
    })
    .where(eq(conversations.id, conversationId))
    .run();
}

export function getTodaySummaries(): string[] {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const db = getDb();
  const rows = db
    .select({ summary: conversations.summary })
    .from(conversations)
    .where(and(isNotNull(conversations.summary), gte(conversations.startedAt, today)))
    .orderBy(desc(conversations.startedAt))
    .all();
  return rows.map((r) => r.summary!);
}

export { getRecentDiaries } from "./diary.js";
export { generateDiary } from "./diary.js";
