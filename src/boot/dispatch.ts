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
  introduce(): Promise<string>;
  look(): Promise<string>;
  beginRest(): Promise<void>;
  changeOutfit(name: string): Promise<string>;
  configure(): Promise<string>;
  retry(): Promise<string>;
}): Dispatch {
  const events = new EventEmitter<DispatchEvents>();

  const commands: SlashCommand[] = [
    { name: "again", description: "Regenerate the last response" },
    { name: "intro", description: "Ask Kana to introduce herself" },
    { name: "look", description: "Describe Kana's appearance" },
    { name: "outfit", description: "Change outfit" },
    { name: "config", description: "View and change persona settings" },
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

    const raw = text.slice(1).trim();
    const name = raw.toLowerCase().split(/\s+/)[0];
    switch (name) {
      case "quit":
        events.emit("quit");
        return;
      case "rest":
        events.emit("chat:command");
        agent
          .beginRest()
          .then(() => events.emit("chat:after"))
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : "Unknown error";
            events.emit("chat:error", msg);
          });
        return;
      case "intro":
        events.emit("chat:command");
        agent
          .introduce()
          .then(() => events.emit("chat:after"))
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : "Unknown error";
            events.emit("chat:error", msg);
          });
        return;
      case "look":
        events.emit("chat:command");
        agent
          .look()
          .then(() => events.emit("chat:after"))
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : "Unknown error";
            events.emit("chat:error", msg);
          });
        return;
      case "config":
        events.emit("chat:command");
        agent
          .configure()
          .then(() => events.emit("chat:after"))
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : "Unknown error";
            events.emit("chat:error", msg);
          });
        return;
      case "again":
        events.emit("chat:command");
        agent
          .retry()
          .then(() => events.emit("chat:after"))
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : "Unknown error";
            events.emit("chat:error", msg);
          });
        return;
      case "outfit": {
        const outfitName = raw.slice("outfit".length).trim();
        if (!outfitName) {
          events.emit("outfit:select");
          return;
        }
        events.emit("chat:command");
        agent
          .changeOutfit(outfitName)
          .then(() => events.emit("chat:after"))
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : "Unknown error";
            events.emit("chat:error", msg);
          });
        return;
      }
    }
  }

  return { handle, commands, events };
}
