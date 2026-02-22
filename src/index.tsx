import React from "react";
import { render } from "ink";
import { boot } from "./boot/startup.js";
import App from "./components/App.js";

const { agent, model, displayFromIndex, dispatch } = boot();

const instance = render(
  <App agent={agent} dispatch={dispatch} model={model} displayFromIndex={displayFromIndex} />,
  { exitOnCtrlC: false },
);

instance.waitUntilExit().then(() => {});
