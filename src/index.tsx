import React from "react";
import { render } from "ink";
import config from "./config.js";
import { createClient } from "./client.js";
import { Agent } from "./agent.js";
import App from "./components/App.js";

const { client, model } = createClient(config);
const agent = new Agent(client, model, config.systemPrompt);

render(<App agent={agent} model={model} />);
