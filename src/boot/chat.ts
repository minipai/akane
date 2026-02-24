import OpenAI from "openai";
import type { ChatClient, Config, Message, ToolDef } from "../types.js";
import type {
  ResponseInputItem,
  FunctionTool,
  Tool as ResponseTool,
} from "openai/resources/responses/responses";

class OpenAIChatClient implements ChatClient {
  private openai: OpenAI;
  private model: string;

  constructor(config: Config) {
    this.openai = new OpenAI({ apiKey: config.apiKey, baseURL: config.baseUrl });
    this.model = config.model;
  }

  async chat(params: { messages: Message[]; tools?: ToolDef[] }) {
    const { instructions, input } = this.convertMessages(params.messages);
    const tools = this.convertTools(params.tools);

    const response = await this.openai.responses.create({
      model: this.model,
      instructions: instructions || undefined,
      input,
      tools,
      store: false,
    });

    return {
      message: this.mapResponse(response),
      totalTokens: response.usage?.total_tokens,
    };
  }

  async compress(system: string, user: string) {
    const response = await this.openai.responses.create({
      model: this.model,
      instructions: system,
      input: [{ role: "user", content: user }],
      store: false,
    });
    return response.output_text ?? "";
  }

  /** Convert our Message[] → Responses API input items. */
  private convertMessages(messages: Message[]): { instructions: string; input: ResponseInputItem[] } {
    let instructions = "";
    const input: ResponseInputItem[] = [];

    for (const msg of messages) {
      const role = msg.role;
      const content = msg.content ?? "";

      if (role === "system") {
        instructions = content;
        continue;
      }

      if (role === "user" || role === "developer") {
        input.push({ role, content });
        continue;
      }

      if (role === "assistant") {
        if (content) {
          input.push({ role: "assistant", content });
        }
        if (msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            if (tc.type === "function") {
              input.push({
                type: "function_call",
                call_id: tc.id,
                name: tc.function.name,
                arguments: tc.function.arguments,
              } as ResponseInputItem);
            }
          }
        }
        continue;
      }

      if (role === "tool") {
        input.push({
          type: "function_call_output",
          call_id: msg.tool_call_id!,
          output: content,
        } as ResponseInputItem);
        continue;
      }
    }

    return { instructions, input };
  }

  /** Convert our ToolDef[] → Responses API format + built-in web_search. */
  private convertTools(tools?: ToolDef[]): ResponseTool[] {
    const result: ResponseTool[] = [{ type: "web_search" }];

    if (!tools) return result;

    for (const tool of tools) {
      const fn = tool.function;
      result.push({
        type: "function",
        name: fn.name,
        description: fn.description ?? undefined,
        parameters: fn.parameters ?? null,
        strict: fn.strict ?? true,
      } as FunctionTool);
    }

    return result;
  }

  /** Map Responses API output → our Message type. */
  private mapResponse(response: OpenAI.Responses.Response): Message {
    const functionCalls = response.output.filter(
      (item): item is OpenAI.Responses.ResponseFunctionToolCall => item.type === "function_call",
    );

    const toolCalls = functionCalls.length > 0
      ? functionCalls.map((fc) => ({
          id: fc.call_id,
          type: "function" as const,
          function: { name: fc.name, arguments: fc.arguments },
        }))
      : undefined;

    return {
      role: "assistant",
      content: response.output_text || null,
      tool_calls: toolCalls,
    };
  }
}

export function createClient(config: Config): { client: ChatClient; model: string } {
  return { client: new OpenAIChatClient(config), model: config.model };
}
