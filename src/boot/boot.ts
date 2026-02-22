import config from "./config.js";
import { createClient } from "./client.js";
import { createCache } from "./cache.js";
import { Agent } from "../agent/agent.js";
import { SqliteMemory } from "../memory/memory.js";
import { createDispatch } from "./dispatch.js";
import type { Dispatch } from "./dispatch.js";

export type { Dispatch };

export function boot(): { agent: Agent; model: string; dispatch: Dispatch } {
  const { client, model } = createClient(config);
  const memory = new SqliteMemory(client.compress.bind(client));
  const cache = createCache();
  const agent = new Agent(client, memory, cache);
  agent.start();
  const dispatch = createDispatch(agent);
  return { agent, model, dispatch };
}
