import type { ChatEntry, Compressor } from "../types.js";
import type { MemoryContext } from "../prompts/index.js";
import type { DiaryType } from "./diary.js";
import type { Category } from "./user-facts.js";
import {
  initMemory,
  createConversation,
  endConversation,
  getActiveConversation,
  getConversationMessages,
  saveMessage,
  getRecentConversationSummary,
  setRecentConversationSummary,
  getRecentDiaries,
  generateDiary,
} from "./index.js";
import {
  insertFact,
  getFactsByCategory,
  getCategoryForFact,
  updateFact,
  deleteFact,
  upsertProfile,
  getAllProfiles,
} from "./user-facts.js";
import { getKv, setKv } from "./kv.js";
import { getCachedDailyCost, getDailySpend } from "./costs.js";

export interface Memory {
  // Conversations
  createConversation(): string;
  endConversation(id: string, summary?: string): void;
  getActiveConversation(): string | null;
  getConversationMessages(id: string): ChatEntry[];
  saveMessage(conversationId: string, entry: ChatEntry): void;

  // Recent summary
  getRecentConversationSummary(): string | null;
  setRecentConversationSummary(summary: string): void;

  // KV
  getKv(key: string): string | null;
  setKv(key: string, value: string): void;

  // Diary
  fadeMemories(): Promise<void>;
  getRecentDiaries(type: DiaryType, limit: number): string[];

  // User facts
  insertFact(category: Category, fact: string): number;
  getFactsByCategory(category: Category): { id: number; fact: string }[];
  getCategoryForFact(id: number): Category | null;
  updateFact(id: number, fact: string): void;
  deleteFact(id: number): void;

  // User profile
  upsertProfile(category: Category, summary: string): void;
  getAllProfiles(): Record<string, string>;

  // Costs
  getCachedDailyCost(): number;
  getDailySpend(): Promise<number>;

  // Prompt context
  buildContext(): MemoryContext;
}

export class SqliteMemory implements Memory {
  private compress: Compressor;

  constructor(compress: Compressor) {
    this.compress = compress;
    initMemory();
  }

  createConversation(): string {
    return createConversation();
  }

  endConversation(id: string, summary?: string): void {
    endConversation(id, summary);
  }

  getActiveConversation(): string | null {
    return getActiveConversation();
  }

  getConversationMessages(id: string): ChatEntry[] {
    return getConversationMessages(id);
  }

  saveMessage(conversationId: string, entry: ChatEntry): void {
    saveMessage(conversationId, entry);
  }

  getRecentConversationSummary(): string | null {
    return getRecentConversationSummary();
  }

  setRecentConversationSummary(summary: string): void {
    setRecentConversationSummary(summary);
  }

  getKv(key: string): string | null {
    return getKv(key);
  }

  setKv(key: string, value: string): void {
    setKv(key, value);
  }

  async fadeMemories(): Promise<void> {
    return generateDiary(this.compress);
  }

  getRecentDiaries(type: DiaryType, limit: number): string[] {
    return getRecentDiaries(type, limit);
  }

  insertFact(category: Category, fact: string): number {
    return insertFact(category, fact);
  }

  getFactsByCategory(category: Category): { id: number; fact: string }[] {
    return getFactsByCategory(category);
  }

  getCategoryForFact(id: number): Category | null {
    return getCategoryForFact(id);
  }

  updateFact(id: number, fact: string): void {
    updateFact(id, fact);
  }

  deleteFact(id: number): void {
    deleteFact(id);
  }

  upsertProfile(category: Category, summary: string): void {
    upsertProfile(category, summary);
  }

  getAllProfiles(): Record<string, string> {
    return getAllProfiles();
  }

  getCachedDailyCost(): number {
    return getCachedDailyCost();
  }

  getDailySpend(): Promise<number> {
    return getDailySpend();
  }

  buildContext(): MemoryContext {
    return {
      recentSummary: this.getRecentConversationSummary(),
      dailies: this.getRecentDiaries("daily", 7),
      weeklies: this.getRecentDiaries("weekly", 3),
      monthlies: this.getRecentDiaries("monthly", 2),
      quarterlies: this.getRecentDiaries("quarterly", 3),
      yearlies: this.getRecentDiaries("yearly", 3),
      userProfile: this.getAllProfiles(),
    };
  }
}
