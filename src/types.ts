import type { ChatCompletionMessageParam, ChatCompletionTool, ChatCompletionMessage } from "openai/resources/chat/completions";

export type Message = ChatCompletionMessageParam;

/** Abstract chat client — hides provider-specific details (OpenAI, etc.). */
export interface ChatClient {
  chat(params: {
    messages: Message[];
    tools?: ChatCompletionTool[];
  }): Promise<{
    message: ChatCompletionMessage | null;
    totalTokens?: number;
  }>;

  compress(system: string, user: string): Promise<string>;
}

/** Convenience alias for the compress callback signature. */
export type Compressor = ChatClient["compress"];

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
