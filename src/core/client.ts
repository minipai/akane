import OpenAI from "openai";
import type { ChatClient, Config } from "../types.js";

export function createClient(config: Config): { client: ChatClient; model: string } {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });
  return { client, model: config.model };
}
