import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export type Message = ChatCompletionMessageParam;

export interface Config {
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
}
