import type { ChatClient, ChatEntry } from "../types.js";
import {
  createConversation,
  endConversation,
  getActiveConversation,
  getConversationMessages,
  updateRecentConversationSummary,
} from "../memory/index.js";

export class Secretary {
  private client: ChatClient;
  private model: string;

  constructor(client: ChatClient, model: string) {
    this.client = client;
    this.model = model;
  }

  /** Resume an existing session or create a new one. */
  resume(): { conversationId: string; entries: ChatEntry[]; displayFromIndex: number } {
    const existingId = getActiveConversation();
    if (existingId) {
      const entries = getConversationMessages(existingId);
      // Show only last 2 pairs (4 messages); +1 for system prompt entry
      const displayFromIndex = Math.max(0, entries.length - 4) + 1;
      return { conversationId: existingId, entries, displayFromIndex };
    }
    return { conversationId: createConversation(), entries: [], displayFromIndex: 0 };
  }

  /** End the current session with a summary, start a fresh one. Returns new conversation ID. */
  async rest(conversationId: string, entries: ChatEntry[]): Promise<string> {
    const newId = createConversation();

    try {
      const summary = await this.generateSummary(entries);
      if (summary) {
        await updateRecentConversationSummary(this.client, this.model, summary);
      }
      endConversation(conversationId, summary);
    } catch {
      endConversation(conversationId);
    }

    return newId;
  }

  private async generateSummary(entries: ChatEntry[]): Promise<string | undefined> {
    const hasContent = entries.some(
      (e) => e.message.role === "user" || e.message.role === "assistant",
    );
    if (!hasContent) return undefined;

    const summaryMessages = [
      {
        role: "system" as const,
        content:
          "Summarize the following conversation in 1-2 concise sentences. Focus on the key topics discussed and any outcomes. Reply with ONLY the summary, nothing else.",
      },
      {
        role: "user" as const,
        content: entries
          .filter(
            (e) => e.message.role === "user" || e.message.role === "assistant",
          )
          .map((e) => {
            const content =
              typeof e.message.content === "string" ? e.message.content : "";
            return `${e.message.role}: ${content}`;
          })
          .join("\n"),
      },
    ];

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: summaryMessages,
      });
      return response.choices[0]?.message?.content ?? undefined;
    } catch {
      return undefined;
    }
  }
}
