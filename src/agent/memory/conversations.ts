import { randomUUID } from "crypto";
import { eq, desc, and, isNull, inArray } from "drizzle-orm";
import type { Db } from "../../db/db.js";
import { conversations, messages } from "../../db/schema.js";
import type { ChatEntry, Message } from "../../types.js";

export function createConversation(db: Db): string {
  const id = randomUUID();
  db.insert(conversations)
    .values({ id, startedAt: new Date().toISOString() })
    .run();
  return id;
}

export function getActiveConversation(db: Db): string | null {
  const row = db
    .select({ id: conversations.id })
    .from(conversations)
    .where(isNull(conversations.endedAt))
    .orderBy(desc(conversations.startedAt))
    .limit(1)
    .get();
  return row?.id ?? null;
}

export function getConversationMessages(db: Db, conversationId: string): ChatEntry[] {
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
    const message: Message = { role: row.role as Message["role"], content: row.content ?? "" };
    const entry: ChatEntry = { message, ts: new Date(row.createdAt).getTime() };
    if (row.emotion) entry.emotion = row.emotion;
    if (row.label) entry.label = row.label;
    return entry;
  });
}

export function saveMessage(db: Db, conversationId: string, entry: ChatEntry): void {
  const msg = entry.message;
  const role = msg.role;
  const content = msg.content;

  let toolCalls: string | null = null;
  if (msg.tool_calls) {
    toolCalls = JSON.stringify(msg.tool_calls);
  }

  db.insert(messages)
    .values({
      conversationId,
      role,
      content,
      emotion: entry.emotion ?? null,
      label: entry.label ?? null,
      toolCalls,
      createdAt: new Date().toISOString(),
    })
    .run();
}

export function deleteLastMessages(db: Db, conversationId: string, count: number): void {
  if (count <= 0) return;
  const rows = db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.id))
    .limit(count)
    .all();
  if (rows.length === 0) return;
  const ids = rows.map((r) => r.id);
  db.delete(messages).where(inArray(messages.id, ids)).run();
}

export function endConversation(db: Db, conversationId: string, summary?: string): void {
  db.update(conversations)
    .set({
      endedAt: new Date().toISOString(),
      summary: summary ?? null,
    })
    .where(eq(conversations.id, conversationId))
    .run();
}
