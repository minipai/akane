import type { ChatEntry, Compressor } from "../../types.js";
import type { Memory } from "../memory/memory.js";
import type { Cache } from "../../boot/cache.js";

export class Secretary {
  private memory: Memory;
  private cache: Cache;
  private compress: Compressor;

  constructor(memory: Memory, cache: Cache, compress: Compressor) {
    this.memory = memory;
    this.cache = cache;
    this.compress = compress;
  }

  /** Resume an existing session, or return null to defer creation until first message. */
  resume(): { conversationId: string | null; entries: ChatEntry[] } {
    const existingId = this.memory.getActiveConversation();
    if (existingId) {
      const entries = this.memory.getConversationMessages(existingId);
      return { conversationId: existingId, entries };
    }
    return { conversationId: null, entries: [] };
  }

  /** End the current session with a summary. If conversationId is null, no-op. */
  async rest(conversationId: string | null, entries: ChatEntry[]): Promise<void> {
    if (!conversationId) return;

    const summary = await this.generateSummary(entries);
    if (summary) {
      const existing = this.cache.recentSummary;
      if (existing) {
        const merged = await this.compress(
          "Merge these two summaries of recent conversations into one concise paragraph (2-4 sentences). Keep all key facts, drop redundancy. Reply with ONLY the merged summary.",
          `Existing:\n${existing}\n\nNew:\n${summary}`,
        ).catch(() => null);
        this.cache.recentSummary = merged || `${existing} ${summary}`;
      } else {
        this.cache.recentSummary = summary;
      }
    }
    this.memory.endConversation(conversationId, summary);
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

    const result = await this.compress(
      "Summarize the following conversation in 1-2 concise sentences. Focus on the key topics discussed and any outcomes. Reply with ONLY the summary, nothing else.",
      content,
    );
    return result || undefined;
  }
}
