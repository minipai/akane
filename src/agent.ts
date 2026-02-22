import type OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessage,
} from "openai/resources/chat/completions";
import type { Message, ChatEntry, ToolActivity, ToolApprovalRequest, TokenUsage } from "./types.js";
import { tools, executeTool, autoApprovedTools } from "./tools/index.js";
import { saveMessage } from "./memory/index.js";
import { getKv } from "./memory/kv.js";
import { generateNextQuestion } from "./memory/user-facts.js";

const MAX_ITERATIONS = 10;

export type OnToolActivity = (activity: ToolActivity) => void;
export type OnToolApproval = (request: ToolApprovalRequest) => void;
export type OnEmotionChange = (emotion: string) => void;

export class Agent {
  private messages: Message[] = [];
  private entries: ChatEntry[] = [];
  private currentEmotion: string = "neutral";
  private client: OpenAI;
  private model: string;
  private onToolActivity?: OnToolActivity;
  private onToolApproval?: OnToolApproval;
  private onEmotionChange?: OnEmotionChange;
  private lastUsage: TokenUsage = { promptTokens: 0, totalTokens: 0 };
  private conversationId: string | null = null;
  private mpMax: number = 100_000;

  constructor(client: OpenAI, model: string, systemPrompt: string) {
    this.client = client;
    this.model = model;
    this.messages = [{ role: "system", content: systemPrompt }];
    this.entries = [{ message: this.messages[0] }];
  }

  setConversationId(id: string): void {
    this.conversationId = id;
  }

  setMpMax(max: number): void {
    this.mpMax = max;
  }

  private getMpRatio(): number {
    const remaining = Math.max(0, this.mpMax - this.lastUsage.totalTokens);
    return remaining / this.mpMax;
  }

  setOnToolActivity(cb: OnToolActivity): void {
    this.onToolActivity = cb;
  }

  setOnToolApproval(cb: OnToolApproval): void {
    this.onToolApproval = cb;
  }

  setOnEmotionChange(cb: OnEmotionChange): void {
    this.onEmotionChange = cb;
  }

  getMessages(): Message[] {
    return this.messages;
  }

  getEntries(): ChatEntry[] {
    return this.entries;
  }

  getTokenUsage(): TokenUsage {
    return this.lastUsage;
  }

  reset(systemPrompt?: string): void {
    const prompt =
      systemPrompt ??
      (this.messages[0]?.role === "system"
        ? (this.messages[0].content as string)
        : "");
    this.messages = [{ role: "system", content: prompt }];
    this.entries = [{ message: this.messages[0] }];
    this.currentEmotion = "neutral";
  }

  private isFirstUserMessage = true;

  async run(userInput: string): Promise<string> {
    this.addMessage({ role: "user", content: userInput });

    // Nudge the model to ask a personal question on casual greetings
    if (this.isFirstUserMessage && userInput.trim().length < 20) {
      const question = getKv("next_question");
      const nudge = question
        ? `After greeting, you MUST ask this exact question (translate to the conversation language if needed): ${question}`
        : "Greet the user and casually ask something about themselves to get to know them better.";
      this.messages.push({ role: "developer", content: nudge } as any);
      // Pre-generate a fresh question for next session
      generateNextQuestion(this.client, this.model).catch(() => {});
    }
    this.isFirstUserMessage = false;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const message = await this.callLLM();
      if (!message) return "(no response)";

      this.addMessage(message);

      const toolCalls = this.extractToolCalls(message);
      if (!toolCalls) {
        return message.content ?? "(no response)";
      }

      await this.executeToolCalls(toolCalls);
    }

    return "(max iterations reached)";
  }

  private addMessage(message: ChatCompletionMessageParam): void {
    this.messages.push(message);
    const entry: ChatEntry = { message };
    if (message.role === "assistant") {
      entry.emotion = this.currentEmotion;
    }
    this.entries.push(entry);

    if (this.conversationId) {
      try {
        saveMessage(this.conversationId, entry);
      } catch {}
    }
  }

  private async callLLM(): Promise<ChatCompletionMessage | null> {
    const mpRatio = this.getMpRatio();
    const messages = [...this.messages];

    const pct = Math.round(mpRatio * 100);
    let mpHint: string;
    switch (true) {
      case mpRatio < 0.2:
        mpHint = `Your MP is at ${pct}%. You're nearly drained — express exhaustion naturally. Keep replies very short.`;
        break;
      case mpRatio < 0.5:
        mpHint = `Your MP is at ${pct}%. You're getting a bit tired — subtly show it in your tone. Be slightly more concise.`;
        break;
      default:
        mpHint = `Your MP is at ${pct}%. You're feeling fine.`;
        break;
    }
    messages.push({
      role: "developer",
      content: `[System: ${mpHint}]`,
    } as any);

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools,
    });

    if (response.usage) {
      this.lastUsage = {
        promptTokens: response.usage.prompt_tokens,
        totalTokens: response.usage.total_tokens,
      };
    }

    return response.choices[0]?.message ?? null;
  }

  private extractToolCalls(message: ChatCompletionMessage) {
    const calls = message.tool_calls;
    if (!calls || calls.length === 0) return null;
    return calls.filter((tc) => tc.type === "function");
  }

  private async requestApproval(name: string, args: string): Promise<boolean> {
    if (!this.onToolApproval) return true;
    return new Promise<boolean>((resolve) => {
      this.onToolApproval!({ name, args, resolve });
    });
  }

  private async executeToolCalls(
    toolCalls: Array<{ id: string; function: { name: string; arguments: string } }>
  ): Promise<void> {
    for (const tc of toolCalls) {
      const isAutoApproved = autoApprovedTools.has(tc.function.name);

      if (!isAutoApproved) {
        this.onToolActivity?.({
          name: tc.function.name,
          args: tc.function.arguments,
          result: null,
        });

        const approved = await this.requestApproval(tc.function.name, tc.function.arguments);

        if (!approved) {
          const denial = "Tool execution denied by user.";
          this.onToolActivity?.({
            name: tc.function.name,
            args: tc.function.arguments,
            result: denial,
          });
          this.addMessage({
            role: "tool",
            tool_call_id: tc.id,
            content: denial,
          });
          continue;
        }
      }

      const result = await executeTool(tc.function.name, tc.function.arguments);

      if (tc.function.name === "set_emotion") {
        try {
          const parsed = JSON.parse(tc.function.arguments);
          this.currentEmotion = parsed.emotion;
          this.onEmotionChange?.(parsed.emotion);
        } catch {}
      } else {
        this.onToolActivity?.({
          name: tc.function.name,
          args: tc.function.arguments,
          result,
        });
      }

      this.addMessage({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      });
    }
  }
}
