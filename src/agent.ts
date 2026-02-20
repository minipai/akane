import type OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessage,
} from "openai/resources/chat/completions";
import type { Message, ToolActivity, TokenUsage } from "./types.js";
import { tools, executeTool } from "./tools/index.js";

const MAX_ITERATIONS = 10;

export type OnToolActivity = (activity: ToolActivity) => void;

export class Agent {
  private messages: Message[] = [];
  private client: OpenAI;
  private model: string;
  private onToolActivity?: OnToolActivity;
  private lastUsage: TokenUsage = { promptTokens: 0, totalTokens: 0 };

  constructor(client: OpenAI, model: string, systemPrompt: string) {
    this.client = client;
    this.model = model;
    this.messages = [{ role: "system", content: systemPrompt }];
  }

  setOnToolActivity(cb: OnToolActivity): void {
    this.onToolActivity = cb;
  }

  getMessages(): Message[] {
    return this.messages;
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
  }

  async run(userInput: string): Promise<string> {
    this.addMessage({ role: "user", content: userInput });

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
  }

  private async callLLM(): Promise<ChatCompletionMessage | null> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: this.messages,
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

  private async executeToolCalls(
    toolCalls: Array<{ id: string; function: { name: string; arguments: string } }>
  ): Promise<void> {
    for (const tc of toolCalls) {
      this.onToolActivity?.({
        name: tc.function.name,
        args: tc.function.arguments,
        result: null,
      });

      const result = await executeTool(tc.function.name, tc.function.arguments);

      this.onToolActivity?.({
        name: tc.function.name,
        args: tc.function.arguments,
        result,
      });

      this.addMessage({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      });
    }
  }
}
