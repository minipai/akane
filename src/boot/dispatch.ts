import { EventEmitter } from "events";

export interface SlashCommand {
  name: string;
  description: string;
}

export interface DispatchEvents {
  quit: [];
  "chat:before": [text: string];
  "chat:after": [];
  "chat:command": [];
  "chat:error": [error: string];
  "outfit:select": [];
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
    { name: "look", description: "Describe Kana's appearance" },
    { name: "outfit", description: "Change outfit" },
    { name: "intro", description: "Ask Kana to introduce herself" },
    { name: "rest", description: "End session and start fresh" },
    { name: "quit", description: "Exit the app" },
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
        events.emit("chat:command");
        agent
          .run(
            "The user wants to rest and end this session. Respond briefly with a warm goodbye first, then call rest_session with a second-person narrative description of how you settle down to rest. Use the conversation language.",
            { label: "/rest  End session and start fresh" },
          )
          .then(() => agent.rest())
          .then(() => events.emit("chat:after"))
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
      case "look":
        events.emit("chat:command");
        agent
          .run(
            "The user looks at you. Call describe_agent with a third-person narrative description of what the user sees — your appearance, clothing, expression, features. Then respond — you notice them looking, react in character. Use the conversation language.",
            { label: "/look  Describe Kana's appearance" },
          )
          .then(() => events.emit("chat:after"))
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : "Unknown error";
            events.emit("chat:error", msg);
          });
        return;
      case "outfit":
        events.emit("outfit:select");
        return;
    }
  }

  return { handle, commands, events };
}
