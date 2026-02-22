import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

/** Minimal interface for the OpenAI chat client — easy to mock in tests. */
export interface ChatClient {
  chat: {
    completions: {
      create(params: any): Promise<any>;
    };
  };
}

export type Message = ChatCompletionMessageParam;

export interface ChatEntry {
  message: Message;
  emotion?: string;
}

export interface ToolActivity {
  name: string;
  args: string;
  result: string | null;
}

export interface ToolApprovalRequest {
  name: string;
  args: string;
  resolve: (approved: boolean) => void;
}

export interface Config {
  apiKey: string;
  baseUrl: string;
  model: string;
  contextLimit: number;
}
