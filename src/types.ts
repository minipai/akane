import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export type Message = ChatCompletionMessageParam;

export interface ToolActivity {
  name: string;
  args: string;
  result: string | null;
}

export interface TokenUsage {
  promptTokens: number;
  totalTokens: number;
}

export interface Config {
  apiKey: string;
  baseUrl: string;
  model: string;
  contextLimit: number;
}
