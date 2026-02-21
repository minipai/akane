import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

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

export const diary = sqliteTable(
  "diary",
  {
    type: text("type").notNull(), // daily | weekly | monthly | quarterly | yearly
    date: text("date").notNull(), // YYYY-MM-DD | YYYY-W01 | YYYY-MM | YYYY-Q1 | YYYY
    summary: text("summary").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.type, table.date] })],
);
