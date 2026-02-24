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

  addMessage(message: Message, opts?: { label?: string }): void {
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

  /** Remove the last assistant turn (assistant + tool messages) and return the last user input. */
  popLastTurn(): { userContent: string; removedCount: number } | null {
    // Find the last user message index in messages[]
    let lastUserIdx = -1;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx < 0) return null;

    const userContent = this.messages[lastUserIdx].content as string;

    // Remove everything after the last user message from messages[]
    this.messages.splice(lastUserIdx + 1);

    // Remove corresponding entries (walk backwards, remove non-user entries until we hit the user entry)
    // Count only entries removed (these correspond to DB rows, unlike pushRaw messages)
    let dbRemovedCount = 0;
    while (this.entries.length > 0) {
      const last = this.entries[this.entries.length - 1];
      if ("message" in last && (last as any).message?.role === "user") break;
      if ("kind" in last) {
        // InfoEntry — remove from display but not in DB
        this.entries.pop();
        continue;
      }
      this.entries.pop();
      dbRemovedCount++;
    }

    // Delete from DB
    if (this.conversationId && dbRemovedCount > 0) {
      try {
        this.memory.deleteLastMessages(this.conversationId, dbRemovedCount);
      } catch {}
    }

    return { userContent, removedCount: dbRemovedCount };
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
