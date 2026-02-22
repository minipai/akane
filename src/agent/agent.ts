import type { ChatClient } from "../types.js";
import type { ChatCompletionMessage } from "openai/resources/chat/completions";
import type { ChatEntry } from "../types.js";
import type { Memory } from "../memory/memory.js";
import { tools, formatToolArgs } from "../tools/index.js";
import { buildSystemPrompt } from "../prompts/index.js";
import { generateNextQuestion } from "../tools/user-facts.js";
import { Clerk } from "./clerk.js";
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
  private buildPrompt: () => string;
  private clerk: Clerk;
  readonly vitals: Vitals;
  private technician: Technician;
  private secretary: Secretary;
  private isFirstUserMessage = true;

  constructor(client: ChatClient, memory: Memory) {
    this.client = client;
    this.memory = memory;
    this.buildPrompt = () => buildSystemPrompt(memory.buildContext());
    this.clerk = new Clerk(this.buildPrompt(), memory);
    this.vitals = new Vitals(memory);
    this.technician = new Technician(memory, client.compress.bind(client));
    this.secretary = new Secretary(memory, client.compress.bind(client));
  }

  /** Resume or create a session. Returns displayFromIndex for the UI. */
  start(): number {
    // Fire-and-forget boot-time memory ops
    const compress = this.client.compress.bind(this.client);
    this.memory.fadeMemories().catch(() => {});
    if (!this.memory.getKv("next_question")) {
      generateNextQuestion(this.memory, compress).catch(() => {});
    }

    const { conversationId, entries, displayFromIndex } = this.secretary.resume();
    this.clerk.setConversationId(conversationId);
    if (entries.length > 0) {
      this.clerk.hydrate(entries);
      this.vitals.restoreFromCache();
      this.isFirstUserMessage = false;
    }
    return displayFromIndex;
  }

  /** End the current session and start a fresh one. */
  async rest(): Promise<void> {
    const currentId = this.clerk.getConversationId()!;
    const entries = this.clerk.getEntries();

    // Reset agent immediately so it's ready for the new session
    this.clerk.reset(this.buildPrompt());
    const newId = await this.secretary.rest(currentId, entries);
    this.clerk.setConversationId(newId);
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
    return this.clerk.getMessages();
  }

  getEntries(): ChatEntry[] {
    return this.clerk.getEntries();
  }

  async run(userInput: string): Promise<string> {
    this.clerk.addMessage({ role: "user", content: userInput });

    // Nudge the model to ask a personal question on casual greetings
    if (this.isFirstUserMessage && userInput.trim().length < 20) {
      const question = this.memory.getKv("next_question");
      const nudge = question
        ? `After greeting, you MUST ask this exact question (translate to the conversation language if needed): ${question}`
        : "Greet the user and casually ask something about themselves to get to know them better.";
      this.clerk.pushRaw({ role: "developer", content: nudge } as any);
      // Pre-generate a fresh question for next session
      generateNextQuestion(this.memory, this.client.compress.bind(this.client)).catch(() => {});
    }
    this.isFirstUserMessage = false;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const message = await this.callLLM();
      if (!message) return "(no response)";

      this.clerk.addMessage(message);

      const calls = message.tool_calls?.filter((tc) => tc.type === "function");
      if (!calls || calls.length === 0) {
        return message.content ?? "(no response)";
      }

      const { results, emotion } = await this.technician.run(calls);

      if (emotion) this.clerk.setEmotion(emotion);
      for (const r of results) {
        this.clerk.addMessage({ role: "tool", tool_call_id: r.tool_call_id, content: r.content });
      }
    }

    return "(max iterations reached)";
  }

  private async callLLM(): Promise<ChatCompletionMessage | null> {
    const messages = [
      ...this.clerk.getMessages(),
      { role: "developer", content: this.vitals.buildHints() } as any,
    ];

    const { message, totalTokens } = await this.client.chat({ messages, tools });

    if (totalTokens) {
      this.vitals.addTokens(totalTokens);
    }

    return message;
  }
}
