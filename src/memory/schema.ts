import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
  summary: text("summary"),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id),
  role: text("role").notNull(),
  content: text("content"),
  emotion: text("emotion"),
  toolCalls: text("tool_calls"),
  createdAt: text("created_at").notNull(),
});
