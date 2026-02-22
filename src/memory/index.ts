import { randomUUID } from "crypto";
import { eq, desc, and, isNull, isNotNull, gte, inArray } from "drizzle-orm";
import { getDb } from "./db.js";
import { conversations, messages } from "./schema.js";
import { getKv, getKvUpdatedAt, setKv } from "./kv.js";
import type { ChatEntry, Message } from "../types.js";

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

export function getActiveConversation(): string | null {
  const db = getDb();
  const row = db
    .select({ id: conversations.id })
    .from(conversations)
    .where(isNull(conversations.endedAt))
    .orderBy(desc(conversations.startedAt))
    .limit(1)
    .get();
  return row?.id ?? null;
}

export function getConversationMessages(conversationId: string): ChatEntry[] {
  const db = getDb();
  const rows = db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        inArray(messages.role, ["user", "assistant"]),
      ),
    )
    .orderBy(messages.id)
    .all();

  return rows.map((row) => {
    const message: Message = {
      role: row.role as "user" | "assistant",
      content: row.content ?? "",
    };
    const entry: ChatEntry = { message };
    if (row.emotion) entry.emotion = row.emotion;
    return entry;
  });
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

function isWithin24Hours(isoTimestamp: string): boolean {
  return Date.now() - new Date(isoTimestamp).getTime() < 24 * 60 * 60 * 1000;
}

export function getRecentConversationSummary(): string | null {
  const updatedAt = getKvUpdatedAt("recent_conversation_summary");
  if (!updatedAt || !isWithin24Hours(updatedAt)) return null;
  return getKv("recent_conversation_summary");
}

export function setRecentConversationSummary(summary: string): void {
  setKv("recent_conversation_summary", summary);
}

export { getRecentDiaries } from "./diary.js";
export { generateDiary } from "./diary.js";
