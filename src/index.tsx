import React from "react";
import { render } from "ink";
import config from "./config.js";
import { createClient } from "./client.js";
import { Agent } from "./agent.js";
import { buildSystemPrompt } from "./prompts/index.js";
import App from "./components/App.js";

const { client, model } = createClient(config);
const systemPrompt = buildSystemPrompt();
const agent = new Agent(client, model, systemPrompt);

render(<App agent={agent} model={model} contextLimit={config.contextLimit} />);
