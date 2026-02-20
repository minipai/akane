import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export type Message = ChatCompletionMessageParam;

export interface ToolActivity {
  name: string;
  args: string;
  result: string | null;
}

export interface Config {
  apiKey: string;
  baseUrl: string;
  model: string;
}
