# Akane (K.A.N.A — Kawaii And Nice Assistant)

AI chat agent with a TUI built on Ink (React for CLI).

## Quick Start

```
npm run dev        # runs tsx src/index.tsx
```

Requires `OPENAI_API_KEY` in `.env` file. Uses `gpt-4.1-mini` by default (see `src/config.ts`).

### Persona env vars (in `.env`)

- `KANA_NAME` — Kana's display name (default placeholder: `{{KANA_NAME}}`)
- `USER_NAME` — user's real name (default placeholder: `{{USER_NAME}}`)
- `USER_NICKNAME` — how Kana addresses the user (default placeholder: `{{USER_NICKNAME}}`)

These replace `{{…}}` placeholders in the prompt markdown files at runtime.

## Architecture

```
src/
├── index.tsx          # Entry point — creates client, agent, memory lifecycle, renders App
├── config.ts          # Environment config (API key, model, context limit)
├── client.ts          # OpenAI client factory
├── agent.ts           # Agent class — manages conversation loop, tool execution, emotions
├── types.ts           # Shared types (ChatEntry, ToolActivity, TokenUsage, Config)
├── components/
│   ├── App.tsx        # Root component — orchestrates state, handles input/output
│   ├── Banner.tsx     # Header with random kaomoji greeting
│   ├── MessageList.tsx # Chat message display with emotion kaomoji per message
│   ├── InputBar.tsx   # Text input with history (up/down arrows), approval mode
│   ├── ToolPanel.tsx  # Shows tool name/args/result during execution
│   └── StatusBar.tsx  # Token usage bar at bottom
├── tools/
│   ├── index.ts       # Tool registry, dispatcher, formatToolArgs
│   ├── shell.ts       # Shell command execution tool
│   └── emotion.ts     # Emotion tool (set_emotion) — auto-approved, no user confirmation
├── memory/
│   ├── schema.ts      # Drizzle schema — conversations, messages, and diary tables
│   ├── db.ts          # SQLite connection (better-sqlite3 + drizzle), stored at ~/.kana/memory.db
│   ├── index.ts       # Memory API — create/end conversations, save messages, get summaries
│   └── diary.ts       # Diary system — hierarchical summaries (daily→weekly→monthly→quarterly→yearly)
└── prompts/
    ├── index.ts       # Builds system prompt from markdown files
    ├── IDENTITY.md    # Character identity/personality (user-specific, not committed)
    ├── AGENT.md       # Agent behavior instructions (tool usage, emotion guidelines)
    └── USER.md        # User info for personalization (user-specific, not committed)
```

## Key Patterns

- **No build step**: Uses `tsx` to run TypeScript directly
- **ESM only**: `"type": "module"` in package.json, `.js` extensions in imports
- **OpenAI SDK**: Chat completions with function calling (`openai` v6)
- **Tool approval**: Tools in `autoApprovedTools` set skip user confirmation. Others prompt `[y/n]`.
- **Emotion system**: `set_emotion` tool lets the LLM express emotions, displayed as kaomoji next to messages
- **Colors**: Use hex colors like `#ff77ff` instead of ANSI names (e.g. `"magenta"`) — some terminals remap ANSI colors
- **Prompt files**: `IDENTITY.md` and `USER.md` contain personal info and are blank in git history. Do not commit real content.
- **Memory system**: SQLite DB at `memory.db` (project root, gitignored) persists conversations and messages. On startup, recent conversation summaries are injected into the system prompt. On exit, an LLM-generated summary is saved for future context.
- **Diary system**: Hierarchical memory compression chain — conversation summaries → daily → weekly → monthly → quarterly → yearly. Generated lazily on startup when a previous period is complete (fire-and-forget, non-blocking). Injected into system prompt as `# Memory` with subsections by granularity. Schema: `diary` table with composite PK `(type, date)`.

## Adding a New Tool

1. Create `src/tools/<name>.ts` with tool definition and executor
2. Register in `src/tools/index.ts` (add to `tools` array, `executeTool` switch, optionally `autoApprovedTools`)
3. Add formatting case in `formatToolArgs` if needed
