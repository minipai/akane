import { exec } from "child_process";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

const MAX_OUTPUT = 4000;
const TIMEOUT_MS = 30_000;

export const shellToolDef: ChatCompletionTool = {
  type: "function",
  function: {
    name: "shell",
    description:
      "Execute a shell command and return its output. Use this to run CLI commands, inspect files, check system state, etc.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute",
        },
      },
      required: ["command"],
    },
  },
};

export function executeShell(command: string): Promise<string> {
  return new Promise((resolve) => {
    exec(command, { timeout: TIMEOUT_MS }, (error, stdout, stderr) => {
      let output = "";
      if (stdout) output += stdout;
      if (stderr) output += (output ? "\n" : "") + stderr;
      if (error && !output) output = error.message;
      if (!output) output = "(no output)";
      if (output.length > MAX_OUTPUT) {
        output = output.slice(0, MAX_OUTPUT) + "\n... (truncated)";
      }
      resolve(output);
    });
  });
}
