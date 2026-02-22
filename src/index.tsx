import React from "react";
import { render } from "ink";
import { boot } from "./boot/boot.js";
import App from "./components/App.js";

const { agent, model, dispatch } = boot();

const instance = render(
  <App agent={agent} dispatch={dispatch} model={model} />,
  { exitOnCtrlC: false },
);

instance.waitUntilExit().then(() => {});
