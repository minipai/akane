import type { ChatClient } from "../types.js";
import type { ChatCompletionMessage } from "openai/resources/chat/completions";
import type { ChatEntry } from "../types.js";
import { tools, formatToolArgs } from "../tools/index.js";
import { getKv } from "../memory/kv.js";
import { generateNextQuestion } from "../memory/user-facts.js";
import { Clerk } from "./clerk.js";
import { Vitals } from "./vitals.js";
import { Technician } from "./technician.js";
import { Receptionist } from "./receptionist.js";
import type { OnToolActivity, OnToolApproval, OnEmotionChange } from "./technician.js";

export type { OnToolActivity, OnToolApproval, OnEmotionChange };
export type { ChatEntry, ToolActivity, ToolApprovalRequest } from "../types.js";
export type { SlashCommand } from "./receptionist.js";
export { formatToolArgs };

const MAX_ITERATIONS = 10;

export class Agent {
  private client: ChatClient;
  private model: string;
  private clerk: Clerk;
  readonly vitals = new Vitals();
  private technician = new Technician();
  readonly receptionist = new Receptionist();
  private isFirstUserMessage = true;

  constructor(client: ChatClient, model: string, systemPrompt: string) {
    this.client = client;
    this.model = model;
    this.clerk = new Clerk(systemPrompt);
    this.receptionist.setRunChat((text) => this.run(text));
  }

  setConversationId(id: string): void {
    this.clerk.setConversationId(id);
  }

  getConversationId(): string | null {
    return this.clerk.getConversationId();
  }

  setResetSession(fn: () => Promise<void>): void {
    this.receptionist.setResetSession(fn);
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

  hydrate(entries: ChatEntry[]): void {
    this.clerk.hydrate(entries);
    this.vitals.restoreFromCache();
    if (entries.length > 0) {
      this.isFirstUserMessage = false;
    }
  }

  reset(systemPrompt?: string): void {
    this.clerk.reset(systemPrompt);
  }

  async run(userInput: string): Promise<string> {
    this.clerk.addMessage({ role: "user", content: userInput });

    // Nudge the model to ask a personal question on casual greetings
    if (this.isFirstUserMessage && userInput.trim().length < 20) {
      const question = getKv("next_question");
      const nudge = question
        ? `After greeting, you MUST ask this exact question (translate to the conversation language if needed): ${question}`
        : "Greet the user and casually ask something about themselves to get to know them better.";
      this.clerk.pushRaw({ role: "developer", content: nudge } as any);
      // Pre-generate a fresh question for next session
      generateNextQuestion(this.client, this.model).catch(() => {});
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

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools,
    });

    if (response.usage) {
      this.vitals.addTokens(response.usage.total_tokens);
    }

    return response.choices[0]?.message ?? null;
  }
}
