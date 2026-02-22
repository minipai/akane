import config from "./config.js";
import { createClient } from "./client.js";
import { Agent } from "../agent/agent.js";
import { SqliteMemory } from "../memory/memory.js";
import { createDispatch } from "./dispatch.js";
import type { Dispatch } from "./dispatch.js";

export type { Dispatch };

export function boot(): { agent: Agent; model: string; displayFromIndex: number; dispatch: Dispatch } {
  const { client, model } = createClient(config);
  const memory = new SqliteMemory(client.compress.bind(client));
  const agent = new Agent(client, memory);
  const displayFromIndex = agent.start();
  const dispatch = createDispatch(agent);
  return { agent, model, displayFromIndex, dispatch };
}
