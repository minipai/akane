export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface Message {
  role: "system" | "user" | "assistant" | "developer" | "tool" | "status";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown> | null;
    strict?: boolean | null;
  };
}

/** Abstract chat client — hides provider-specific details (OpenAI, etc.). */
export interface ChatClient {
  chat(params: {
    messages: Message[];
    tools?: ToolDef[];
  }): Promise<{
    message: Message | null;
    totalTokens?: number;
    searched?: boolean;
  }>;

  compress(system: string, user: string): Promise<string>;
}

/** Convenience alias for the compress callback signature. */
export type Compressor = ChatClient["compress"];

export interface ChatEntry {
  message: Message;
  emotion?: string;
  ts?: number;
}

export interface InfoEntry {
  kind: "info";
  label: string;
  content: string;
  ts: number;
}

export type Entry = ChatEntry | InfoEntry;

export function isInfo(e: Entry): e is InfoEntry {
  return "kind" in e && e.kind === "info";
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
