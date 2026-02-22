import { EventEmitter } from "events";

export interface SlashCommand {
  name: string;
  description: string;
}

export interface ReceptionistEvents {
  quit: [];
  "rest:before": [];
  "rest:after": [];
  "chat:before": [text: string];
  "chat:after": [];
  "chat:error": [error: string];
}

export class Receptionist extends EventEmitter<ReceptionistEvents> {
  readonly commands: SlashCommand[] = [
    { name: "quit", description: "Exit the app" },
    { name: "rest", description: "End session and start fresh" },
  ];
  private resetSession?: () => Promise<void>;
  private runChat?: (text: string) => Promise<string>;

  setResetSession(fn: () => Promise<void>): void {
    this.resetSession = fn;
  }

  setRunChat(fn: (text: string) => Promise<string>): void {
    this.runChat = fn;
  }

  /** Handle user input — parse, execute, and emit events. */
  async handle(text: string): Promise<void> {
    if (!text.startsWith("/")) {
      this.emit("chat:before", text);
      try {
        await this.runChat?.(text);
        this.emit("chat:after");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        this.emit("chat:error", msg);
      }
      return;
    }

    const name = text.slice(1).trim().toLowerCase();
    switch (name) {
      case "quit":
        this.emit("quit");
        return;
      case "rest":
        this.emit("rest:before");
        await this.resetSession?.();
        this.emit("rest:after");
        return;
    }
  }

}
