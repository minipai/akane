import { randomUUID } from "crypto";
import { eq, desc, and, isNotNull, gte } from "drizzle-orm";
import { getDb } from "./db.js";
import { conversations, messages } from "./schema.js";
import { getKv, getKvUpdatedAt, setKv } from "./kv.js";
import type { ChatEntry } from "../types.js";
import type OpenAI from "openai";

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

function isWithin24Hours(isoTimestamp: string): boolean {
  return Date.now() - new Date(isoTimestamp).getTime() < 24 * 60 * 60 * 1000;
}

export function getRecentConversationSummary(): string | null {
  const updatedAt = getKvUpdatedAt("recent_conversation_summary");
  if (!updatedAt || !isWithin24Hours(updatedAt)) return null;
  return getKv("recent_conversation_summary");
}

export async function updateRecentConversationSummary(
  client: OpenAI,
  model: string,
  newSummary: string,
): Promise<void> {
  const updatedAt = getKvUpdatedAt("recent_conversation_summary");
  const existing = updatedAt && isWithin24Hours(updatedAt) ? getKv("recent_conversation_summary") : null;

  if (existing) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content:
              "Merge these two summaries of recent conversations into one concise paragraph (2-4 sentences). Keep all key facts, drop redundancy. Reply with ONLY the merged summary.",
          },
          {
            role: "user",
            content: `Existing:\n${existing}\n\nNew:\n${newSummary}`,
          },
        ],
      });
      const merged = response.choices[0]?.message?.content;
      if (merged) {
        setKv("recent_conversation_summary", merged);
      }
    } catch {
      setKv("recent_conversation_summary", `${existing} ${newSummary}`);
    }
  } else {
    setKv("recent_conversation_summary", newSummary);
  }
}

export { getRecentDiaries } from "./diary.js";
export { generateDiary } from "./diary.js";
