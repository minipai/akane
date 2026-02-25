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
  "action:select": [];
  "play:select": [];
  "look:select": [];
  rest: [];
}

export interface Dispatch {
  handle(text: string): void;
  commands: SlashCommand[];
  events: EventEmitter<DispatchEvents>;
}

export function createDispatch(agent: {
  run(text: string, opts?: { hidden?: boolean }): Promise<string>;
  introduce(): Promise<string>;
  look(target?: string): Promise<string>;
  beginRest(): void;
  changeOutfit(name: string): Promise<string>;
  configure(): Promise<string>;
  retry(): Promise<string>;
  action(action: string): Promise<string>;
  play(game: string): Promise<string>;
}): Dispatch {
  const events = new EventEmitter<DispatchEvents>();

  const commands: SlashCommand[] = [
    { name: "look", description: "Describe Kana's appearance" },
    { name: "outfit", description: "Change outfit" },
    { name: "me", description: "Perform an action (e.g. /me hugs you)" },
    { name: "play", description: "Play a game together" },
    { name: "intro", description: "Ask Kana to introduce herself" },
    { name: "config", description: "View and change persona settings" },
    { name: "again", description: "Regenerate the last response" },
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
        events.emit("rest");
        return;
      case "intro":
        return runCommand(() => agent.introduce());
      case "look": {
        const target = raw.slice("look".length).trim();
        if (!target) {
          events.emit("look:select");
          return;
        }
        return runCommand(() => agent.look(target));
      }
      case "config":
        return runCommand(() => agent.configure());
      case "me": {
        const action = raw.slice("me".length).trim();
        if (!action) {
          events.emit("action:select");
          return;
        }
        return runCommand(() => agent.action(action));
      }
      case "play": {
        const game = raw.slice("play".length).trim();
        if (!game) {
          events.emit("play:select");
          return;
        }
        return runCommand(() => agent.play(game));
      }
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
