import { appendFileSync } from "fs";
import { join } from "path";
import config from "./config.js";
import { createClient } from "./client.js";
import { createCache } from "./cache.js";
import { Agent } from "../agent/agent.js";
import { createDispatch } from "./dispatch.js";
import type { Dispatch } from "./dispatch.js";
import { getDb, DATA_DIR } from "../db/db.js";

const LOG_PATH = join(DATA_DIR, "error.log");

process.on("unhandledRejection", (err) => {
  const ts = new Date().toISOString();
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  appendFileSync(LOG_PATH, `[${ts}] ${msg}\n`);
});

export type { Dispatch };

export function boot(): { agent: Agent; model: string; dispatch: Dispatch } {
  const { client, model } = createClient(config);
  const db = getDb();
  const cache = createCache();
  const agent = new Agent(client, db, cache);
  agent.start();
  const dispatch = createDispatch(agent);
  return { agent, model, dispatch };
}
