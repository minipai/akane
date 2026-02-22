import OpenAI from "openai";
import type { ChatClient, Config, Message } from "../types.js";
import type { ChatCompletionTool, ChatCompletionMessage } from "openai/resources/chat/completions";

export function createClient(config: Config): { client: ChatClient; model: string } {
  const openai = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });
  const model = config.model;

  const client: ChatClient = {
    async chat(params: { messages: Message[]; tools?: ChatCompletionTool[] }) {
      const response = await openai.chat.completions.create({
        model,
        messages: params.messages,
        tools: params.tools,
      });
      return {
        message: (response.choices[0]?.message as ChatCompletionMessage) ?? null,
        totalTokens: response.usage?.total_tokens,
      };
    },

    async compress(system: string, user: string) {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      return response.choices[0]?.message?.content ?? "";
    },
  };

  return { client, model };
}
