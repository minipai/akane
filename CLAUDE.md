# K.A.N.A. — Kawaii And Nice Assistant

AI chat agent with a TUI built on Ink (React for CLI).

## Quick Start

```
pnpm dev           # runs tsx src/index.tsx
```

Requires `OPENAI_API_KEY` in `.env` file. Uses `gpt-4.1-mini` by default (see `src/boot/config.ts`).
Optional `OPENAI_ADMIN_KEY` (org-level admin key) enables the HP bar showing daily API spend vs $1 budget.

### Persona env vars (in `.env`)

- `KANA_NAME` — Kana's display name (default placeholder: `{{KANA_NAME}}`)
- `USER_NAME` — user's real name (default placeholder: `{{USER_NAME}}`)
- `USER_NICKNAME` — how Kana addresses the user (default placeholder: `{{USER_NICKNAME}}`)

These replace `{{…}}` placeholders in the prompt markdown files at runtime.

## Architecture

```
src/
├── index.tsx            # Entry point — calls boot(), renders <App>
├── types.ts             # Shared types (ChatEntry, ToolActivity, TokenUsage, Config)
├── boot/
│   ├── config.ts        # Environment config (API key, model, context limit)
│   ├── client.ts        # OpenAI client factory
│   ├── cache.ts         # Cache — ephemeral runtime state (tokens, daily cost, next question, recent summary)
│   ├── boot.ts          # boot() — wires client, memory, cache, agent, dispatch; returns everything App needs
│   └── dispatch.ts      # createDispatch() — slash command parsing, chat routing, event emitter
├── agent/
│   ├── agent.ts         # Agent class — conversation loop, tool execution, emotions
│   ├── scribe.ts        # Scribe — message history, system prompt, conversation state
│   ├── technician.ts    # Technician — tool execution, approval flow, emotion extraction
│   ├── secretary.ts     # Secretary — session lifecycle (resume, rest, summaries)
│   └── vitals.ts        # Vitals — token tracking, HP bar (API spend), status hints
├── components/
│   ├── App.tsx          # Root component — orchestrates state, handles input/output
│   ├── Banner.tsx       # Header with random kaomoji greeting
│   ├── MessageList.tsx  # Chat message display with emotion kaomoji per message
│   ├── InputBar.tsx     # Text input with history (up/down arrows), approval mode
│   ├── ToolPanel.tsx    # Shows tool name/args/result during execution
│   └── StatusBar.tsx    # Token usage bar at bottom
├── tools/
│   ├── index.ts         # Tool registry, dispatcher, formatToolArgs
│   ├── shell.ts         # Shell command execution tool
│   ├── emotion.ts       # Emotion tool (set_emotion) — auto-approved, no user confirmation
│   └── user-facts.ts    # User profile tools (note_about_user, get_user_facts, update_user_fact) — auto-approved
├── db/
│   ├── db.ts            # SQLite connection (better-sqlite3 + drizzle), stored at data/memory.db
│   ├── schema.ts        # Drizzle schema — conversations, messages, diary, user_facts, user_profile, kv
│   └── kv.ts            # Simple key-value store
├── memory/
│   ├── memory.ts        # Memory interface + SqliteMemory class — unified facade over long-term storage
│   ├── index.ts         # Low-level memory ops — create/end conversations, save messages
│   ├── diary.ts         # Diary system — hierarchical summaries (daily→weekly→monthly→quarterly→yearly)
│   └── user-facts.ts    # User profile memory — per-category facts with LLM-generated summaries
└── prompts/
    ├── index.ts         # Builds system prompt from markdown files
    ├── IDENTITY.md      # Character identity/personality (user-specific, not committed)
    ├── AGENT.md         # Agent behavior instructions (tool usage, emotion guidelines)
    └── USER.md          # User info for personalization (user-specific, not committed)
```

## Key Patterns

- **No build step**: Uses `tsx` to run TypeScript directly
- **ESM only**: `"type": "module"` in package.json, `.js` extensions in imports
- **OpenAI SDK**: Chat completions with function calling (`openai` v6)
- **Tool approval**: Tools in `autoApprovedTools` set skip user confirmation. Others prompt `[y/n]`.
- **Emotion system**: `set_emotion` tool lets the LLM express emotions, displayed as kaomoji next to messages
- **Colors**: Use hex colors like `#ff77ff` instead of ANSI names (e.g. `"magenta"`) — some terminals remap ANSI colors
- **Prompt files**: `IDENTITY.md` and `USER.md` contain personal info and are blank in git history. Do not commit real content.
- **Session persistence**: Sessions persist across restarts. On startup, the app resumes the last active (un-ended) conversation and loads the last 2 user/assistant message pairs. `/rest` command ends the current session (with summary) and starts fresh. Exiting the app leaves the session open for next launch.
- **Memory system**: SQLite DB at `data/memory.db` (gitignored `data/` dir) persists conversations and messages. On startup, recent conversation summaries are injected into the system prompt.
- **Diary system**: Hierarchical memory compression chain — conversation summaries → daily → weekly → monthly → quarterly → yearly. Generated lazily on startup when a previous period is complete (fire-and-forget, non-blocking). Injected into system prompt as `# Memory` with subsections by granularity. Schema: `diary` table with composite PK `(type, date)`.
- **User profile memory**: AI-maintained facts about the user. Individual facts in `user_facts`, per-category LLM summaries in `user_profile`. Three auto-approved tools: `note_about_user`, `get_user_facts`, `update_user_fact`. Summaries regenerated on each mutation and injected into the system prompt as `# User Profile`. Categories:
  - `identity` — name, location, language, nationality, timezone, demographics
  - `relations` — family, partner, kids, close friends, pets
  - `career` — job, industry, skills, tech stack, professional goals
  - `preferences` — food, colors, aesthetics, hobbies, daily habits, lifestyle patterns
  - `mindset` — personality traits, beliefs, ethics, worldview, interaction style
  - `timeline` — life milestones, goals, commitments, open loops, plans

## Adding a New Tool

1. Create `src/tools/<name>.ts` with tool definition and executor
2. Register in `src/tools/index.ts` (add to `tools` array, `executeTool` switch, optionally `autoApprovedTools`)
3. Add formatting case in `formatToolArgs` if needed
