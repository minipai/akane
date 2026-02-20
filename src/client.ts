import OpenAI from "openai";
import type { Config } from "./types.js";

export function createClient(config: Config) {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });
  return { client, model: config.model };
}
