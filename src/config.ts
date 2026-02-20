import "dotenv/config";
import type { Config } from "./types.js";

const config: Config = {
  apiKey: process.env.OPENAI_API_KEY ?? "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4.1-mini",
  contextLimit: 1_000_000,
};

export default config;
