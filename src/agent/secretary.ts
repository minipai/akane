import type { ChatEntry, Compressor } from "../types.js";
import type { Memory } from "../memory/memory.js";
import type { Cache } from "../boot/cache.js";

export class Secretary {
  private memory: Memory;
  private cache: Cache;
  private compress: Compressor;

  constructor(memory: Memory, cache: Cache, compress: Compressor) {
    this.memory = memory;
    this.cache = cache;
    this.compress = compress;
  }

  /** Resume an existing session or create a new one. */
  resume(): { conversationId: string; entries: ChatEntry[] } {
    const existingId = this.memory.getActiveConversation();
    if (existingId) {
      const entries = this.memory.getConversationMessages(existingId);
      return { conversationId: existingId, entries };
    }
    return { conversationId: this.memory.createConversation(), entries: [] };
  }

  /** End the current session with a summary, start a fresh one. Returns new conversation ID. */
  async rest(conversationId: string, entries: ChatEntry[]): Promise<string> {
    const newId = this.memory.createConversation();

    try {
      const summary = await this.generateSummary(entries);
      if (summary) {
        const existing = this.cache.recentSummary;
        if (existing) {
          try {
            const merged = await this.compress(
              "Merge these two summaries of recent conversations into one concise paragraph (2-4 sentences). Keep all key facts, drop redundancy. Reply with ONLY the merged summary.",
              `Existing:\n${existing}\n\nNew:\n${summary}`,
            );
            this.cache.recentSummary = merged || `${existing} ${summary}`;
          } catch {
            this.cache.recentSummary = `${existing} ${summary}`;
          }
        } else {
          this.cache.recentSummary = summary;
        }
      }
      this.memory.endConversation(conversationId, summary);
    } catch {
      this.memory.endConversation(conversationId);
    }

    return newId;
  }

  private async generateSummary(entries: ChatEntry[]): Promise<string | undefined> {
    const hasContent = entries.some(
      (e) => e.message.role === "user" || e.message.role === "assistant",
    );
    if (!hasContent) return undefined;

    const content = entries
      .filter(
        (e) => e.message.role === "user" || e.message.role === "assistant",
      )
      .map((e) => {
        const text =
          typeof e.message.content === "string" ? e.message.content : "";
        return `${e.message.role}: ${text}`;
      })
      .join("\n");

    try {
      const result = await this.compress(
        "Summarize the following conversation in 1-2 concise sentences. Focus on the key topics discussed and any outcomes. Reply with ONLY the summary, nothing else.",
        content,
      );
      return result || undefined;
    } catch {
      return undefined;
    }
  }
}
