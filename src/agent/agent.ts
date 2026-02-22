import type { ChatClient } from "../types.js";
import type { ChatCompletionMessage } from "openai/resources/chat/completions";
import type { ChatEntry } from "../types.js";
import type { Memory } from "../memory/memory.js";
import type { Cache } from "../boot/cache.js";
import { tools, formatToolArgs } from "../tools/index.js";
import { buildSystemPrompt } from "../prompts/index.js";
import { generateNextQuestion } from "../tools/user-facts.js";
import { Scribe } from "./scribe.js";
import { Vitals } from "./vitals.js";
import { Technician } from "./technician.js";
import { Secretary } from "./secretary.js";
import type { OnToolActivity, OnToolApproval, OnEmotionChange } from "./technician.js";

export type { OnToolActivity, OnToolApproval, OnEmotionChange };
export type { ChatEntry, ToolActivity, ToolApprovalRequest } from "../types.js";
export { formatToolArgs };

const MAX_ITERATIONS = 10;

export class Agent {
  private client: ChatClient;
  private memory: Memory;
  private cache: Cache;
  private buildPrompt: () => string;
  private scribe: Scribe;
  readonly vitals: Vitals;
  private technician: Technician;
  private secretary: Secretary;
  private isFirstUserMessage = true;

  constructor(client: ChatClient, memory: Memory, cache: Cache) {
    this.client = client;
    this.memory = memory;
    this.cache = cache;
    this.buildPrompt = () => buildSystemPrompt(memory.buildContext(cache.recentSummary));
    this.scribe = new Scribe(this.buildPrompt(), memory);
    this.vitals = new Vitals(cache);
    this.technician = new Technician(memory, cache, client.compress.bind(client));
    this.secretary = new Secretary(memory, cache, client.compress.bind(client));
  }

  /** Resume or create a session. */
  start(): void {
    // Fire-and-forget boot-time memory ops
    const compress = this.client.compress.bind(this.client);
    this.memory.fadeMemories().catch(() => {});
    if (!this.cache.nextQuestion) {
      generateNextQuestion(this.memory, this.cache, compress).catch(() => {});
    }

    const { conversationId, entries } = this.secretary.resume();
    this.scribe.setConversationId(conversationId);
    if (entries.length > 0) {
      this.scribe.hydrate(entries);
      this.isFirstUserMessage = false;
    }
  }

  /** End the current session and start a fresh one. */
  async rest(): Promise<void> {
    const currentId = this.scribe.getConversationId()!;
    const entries = this.scribe.getEntries();

    // Reset agent immediately so it's ready for the new session
    this.scribe.reset(this.buildPrompt());
    const newId = await this.secretary.rest(currentId, entries);
    this.scribe.setConversationId(newId);
  }

  setOnToolActivity(cb: OnToolActivity): void {
    this.technician.setOnActivity(cb);
  }

  setOnToolApproval(cb: OnToolApproval): void {
    this.technician.setOnApproval(cb);
  }

  setOnEmotionChange(cb: OnEmotionChange): void {
    this.technician.setOnEmotionChange(cb);
  }

  getMessages() {
    return this.scribe.getMessages();
  }

  getEntries(): ChatEntry[] {
    return this.scribe.getEntries();
  }

  async run(userInput: string): Promise<string> {
    this.scribe.addMessage({ role: "user", content: userInput });

    // Nudge the model to ask a personal question on casual greetings
    if (this.isFirstUserMessage && userInput.trim().length < 20) {
      const question = this.cache.nextQuestion;
      const nudge = question
        ? `After greeting, you MUST ask this exact question (translate to the conversation language if needed): ${question}`
        : "Greet the user and casually ask something about themselves to get to know them better.";
      this.scribe.pushRaw({ role: "developer", content: nudge } as any);
      // Pre-generate a fresh question for next session
      generateNextQuestion(this.memory, this.cache, this.client.compress.bind(this.client)).catch(() => {});
    }
    this.isFirstUserMessage = false;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const message = await this.callLLM();
      if (!message) return "(no response)";

      this.scribe.addMessage(message);

      const calls = message.tool_calls?.filter((tc) => tc.type === "function");
      if (!calls || calls.length === 0) {
        return message.content ?? "(no response)";
      }

      const { results, emotion } = await this.technician.run(calls);

      if (emotion) this.scribe.setEmotion(emotion);
      for (const r of results) {
        this.scribe.addMessage({ role: "tool", tool_call_id: r.tool_call_id, content: r.content });
      }
    }

    return "(max iterations reached)";
  }

  private async callLLM(): Promise<ChatCompletionMessage | null> {
    const messages = [
      ...this.scribe.getMessages(),
      { role: "developer", content: this.vitals.buildHints() } as any,
    ];

    const { message, totalTokens } = await this.client.chat({ messages, tools });

    if (totalTokens) {
      this.vitals.addTokens(totalTokens);
    }

    return message;
  }
}
