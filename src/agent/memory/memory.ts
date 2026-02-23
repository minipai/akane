import { eq, desc } from "drizzle-orm";
import type { Db } from "../../db/db.js";
import { diary } from "../../db/schema.js";
import type { ChatEntry, Compressor } from "../../types.js";
import type { MemoryContext } from "../prompts/index.js";
import { generateDiary, type DiaryType } from "./diary.js";
import * as conv from "./conversations.js";
import * as facts from "./facts.js";
import type { Category } from "./facts.js";

export class Memory {
  private db: Db;
  private compress: Compressor;

  constructor(db: Db, compress: Compressor) {
    this.db = db;
    this.compress = compress;
  }

  // --- Conversations ---

  createConversation(): string { return conv.createConversation(this.db); }
  getActiveConversation(): string | null { return conv.getActiveConversation(this.db); }
  getConversationMessages(conversationId: string): ChatEntry[] { return conv.getConversationMessages(this.db, conversationId); }
  saveMessage(conversationId: string, entry: ChatEntry): void { conv.saveMessage(this.db, conversationId, entry); }
  endConversation(conversationId: string, summary?: string): void { conv.endConversation(this.db, conversationId, summary); }
  deleteLastMessages(conversationId: string, count: number): void { conv.deleteLastMessages(this.db, conversationId, count); }

  // --- Diary ---

  async fadeMemories(): Promise<void> { return generateDiary(this.db, this.compress); }

  getRecentDiaries(type: DiaryType, limit: number): string[] {
    const rows = this.db
      .select({ summary: diary.summary })
      .from(diary)
      .where(eq(diary.type, type))
      .orderBy(desc(diary.date))
      .limit(limit)
      .all();
    return rows.map((r) => r.summary);
  }

  // --- User facts ---

  insertFact(category: Category, fact: string): number { return facts.insertFact(this.db, category, fact); }
  getFactsByCategory(category: Category): { id: number; fact: string }[] { return facts.getFactsByCategory(this.db, category); }
  getCategoryForFact(id: number): Category | null { return facts.getCategoryForFact(this.db, id); }
  updateFact(id: number, fact: string): void { facts.updateFact(this.db, id, fact); }
  deleteFact(id: number): void { facts.deleteFact(this.db, id); }
  upsertProfile(category: Category, summary: string): void { facts.upsertProfile(this.db, category, summary); }
  getAllProfiles(): Record<string, string> { return facts.getAllProfiles(this.db); }

  // --- Prompt context ---

  buildContext(recentSummary?: string | null): MemoryContext {
    return {
      recentSummary: recentSummary ?? null,
      dailies: this.getRecentDiaries("daily", 7),
      weeklies: this.getRecentDiaries("weekly", 3),
      monthlies: this.getRecentDiaries("monthly", 2),
      quarterlies: this.getRecentDiaries("quarterly", 3),
      yearlies: this.getRecentDiaries("yearly", 3),
      userProfile: this.getAllProfiles(),
    };
  }
}
