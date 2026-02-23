import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Message, ChatEntry } from "../../types.js";
import type { Memory } from "../memory/memory.js";

export class Scribe {
  private messages: Message[] = [];
  private entries: ChatEntry[] = [];
  private conversationId: string | null = null;
  private currentEmotion: string = "neutral";
  private memory: Memory;

  constructor(systemPrompt: string, memory: Memory) {
    this.memory = memory;
    const msg: Message = { role: "system", content: systemPrompt };
    this.messages = [msg];
    this.entries = [{ message: msg }];
  }

  setConversationId(id: string): void {
    this.conversationId = id;
  }

  getConversationId(): string | null {
    return this.conversationId;
  }

  getMessages(): Message[] {
    return this.messages;
  }

  getEntries(): ChatEntry[] {
    return this.entries;
  }

  getEmotion(): string {
    return this.currentEmotion;
  }

  setEmotion(emotion: string): void {
    this.currentEmotion = emotion;
  }

  addMessage(message: ChatCompletionMessageParam): void {
    this.messages.push(message);
    const entry: ChatEntry = { message };
    if (message.role === "assistant") {
      entry.emotion = this.currentEmotion;
    }
    this.entries.push(entry);

    if (this.conversationId) {
      try {
        this.memory.saveMessage(this.conversationId, entry);
      } catch {}
    }
  }

  pushRaw(message: Message): void {
    this.messages.push(message);
  }

  hydrate(entries: ChatEntry[]): void {
    for (const entry of entries) {
      this.messages.push(entry.message);
      this.entries.push(entry);
      if (entry.message.role === "assistant" && entry.emotion) {
        this.currentEmotion = entry.emotion;
      }
    }
  }

  reset(systemPrompt?: string): void {
    const prompt =
      systemPrompt ??
      (this.messages[0]?.role === "system"
        ? (this.messages[0].content as string)
        : "");
    const msg: Message = { role: "system", content: prompt };
    this.messages = [msg];
    this.entries = [{ message: msg }];
    this.currentEmotion = "neutral";
  }
}
