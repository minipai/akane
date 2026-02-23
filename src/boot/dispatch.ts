import { EventEmitter } from "events";

export interface SlashCommand {
  name: string;
  description: string;
}

export interface DispatchEvents {
  quit: [];
  "rest:before": [];
  "rest:after": [];
  "chat:before": [text: string];
  "chat:after": [];
  "chat:command": [];
  "chat:error": [error: string];
}

export interface Dispatch {
  handle(text: string): void;
  commands: SlashCommand[];
  events: EventEmitter<DispatchEvents>;
}

export function createDispatch(agent: {
  run(text: string, opts?: { label?: string }): Promise<string>;
  rest(): Promise<void>;
}): Dispatch {
  const events = new EventEmitter<DispatchEvents>();

  const commands: SlashCommand[] = [
    { name: "quit", description: "Exit the app" },
    { name: "rest", description: "End session and start fresh" },
    { name: "intro", description: "Ask Kana to introduce herself" },
  ];

  function handle(text: string): void {
    if (!text.startsWith("/")) {
      events.emit("chat:before", text);
      agent
        .run(text)
        .then(() => events.emit("chat:after"))
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "Unknown error";
          events.emit("chat:error", msg);
        });
      return;
    }

    const name = text.slice(1).trim().toLowerCase();
    switch (name) {
      case "quit":
        events.emit("quit");
        return;
      case "rest":
        events.emit("rest:before");
        agent.rest()
          .then(() => events.emit("rest:after"))
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : "Unknown error";
            events.emit("chat:error", msg);
          });
        return;
      case "intro":
        events.emit("chat:command");
        agent
          .run("Introduce yourself — who you are, your personality, and what you can do.", { label: "/intro  Ask Kana to introduce herself" })
          .then(() => events.emit("chat:after"))
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : "Unknown error";
            events.emit("chat:error", msg);
          });
        return;
    }
  }

  return { handle, commands, events };
}
