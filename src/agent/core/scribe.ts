import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Message, ChatEntry, Entry, InfoEntry } from "../../types.js";
import type { Memory } from "../memory/memory.js";

export class Scribe {
  private messages: Message[] = [];
  private entries: Entry[] = [];
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

  getEntries(): Entry[] {
    return this.entries;
  }

  getChatEntries(): ChatEntry[] {
    return this.entries.filter((e): e is ChatEntry => !("kind" in e));
  }

  addInfo(info: InfoEntry): void {
    this.entries.push(info);
  }

  getEmotion(): string {
    return this.currentEmotion;
  }

  setEmotion(emotion: string): void {
    this.currentEmotion = emotion;
  }

  addMessage(message: ChatCompletionMessageParam, opts?: { label?: string }): void {
    this.messages.push(message);
    const entry: ChatEntry = { message, ts: Date.now() };
    if (message.role === "assistant") {
      entry.emotion = this.currentEmotion;
    }
    if (opts?.label) entry.label = opts.label;
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

  /** Update the system prompt in-place without resetting the session. */
  updateSystemPrompt(systemPrompt: string): void {
    if (this.messages[0]?.role === "system") {
      this.messages[0].content = systemPrompt;
    }
  }

  /** Start a new session — resets LLM context but keeps display entries. */
  newSession(systemPrompt: string): void {
    this.messages = [{ role: "system", content: systemPrompt }];
    this.conversationId = null;
    this.currentEmotion = "neutral";
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
    this.conversationId = null;
    this.currentEmotion = "neutral";
  }
}
