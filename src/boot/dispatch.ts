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
  run(text: string, opts?: { hidden?: boolean }): Promise<string>;
  introduce(): Promise<string>;
  look(): Promise<string>;
  beginRest(): void;
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
    function runCommand(action: () => Promise<unknown>): void {
      // Call action first — sync setup (status message) runs before the first await
      const promise = action();
      events.emit("chat:command");
      promise
        .then(() => events.emit("chat:after"))
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "Unknown error";
          events.emit("chat:error", msg);
        });
    }

    switch (name) {
      case "quit":
        events.emit("quit");
        return;
      case "rest":
        agent.beginRest();
        events.emit("chat:after");
        return;
      case "intro":
        return runCommand(() => agent.introduce());
      case "look":
        return runCommand(() => agent.look());
      case "config":
        return runCommand(() => agent.configure());
      case "again":
        return runCommand(() => agent.retry());
      case "outfit": {
        const outfitName = raw.slice("outfit".length).trim();
        if (!outfitName) {
          events.emit("outfit:select");
          return;
        }
        return runCommand(() => agent.changeOutfit(outfitName));
      }
    }
  }

  return { handle, commands, events };
}
