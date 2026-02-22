export interface SlashCommand {
  name: string;
  description: string;
}

export const commands: SlashCommand[] = [
  { name: "quit", description: "Exit the app" },
  { name: "rest", description: "End session and start fresh" },
];

export function filterCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase();
  return commands.filter((cmd) => cmd.name.startsWith(q));
}
