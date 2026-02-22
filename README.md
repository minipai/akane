# K.A.N.A. — Kawaii And Nice Assistant ♡⸜(˶˃ ᵕ ˂˶)⸝♡

A personal AI chat companion that lives in your terminal. Built with [Ink](https://github.com/vadimdemedes/ink) (React for CLI) and powered by OpenAI.

Kana remembers your conversations, learns about you over time, and expresses emotions through kaomoji. She keeps a diary, maintains a profile of things you've shared, and can run shell commands on your behalf.

## Features

- **Persistent memory** — conversations are stored in a local SQLite database and resumed across restarts
- **Diary system** — hierarchical summaries (daily / weekly / monthly / quarterly / yearly) keep long-term context compact
- **User profile** — Kana remembers facts about you across categories (identity, relations, career, preferences, mindset, timeline)
- **Emotion system** — the AI picks emotions during conversation, displayed as kaomoji next to each message
- **Shell tool** — Kana can run commands in your terminal (with your approval)
- **HP bar** — optional daily API spend tracker ($1 budget) when `OPENAI_ADMIN_KEY` is set
- **Session management** — `/rest` ends a session with a summary; `/quit` exits and leaves the session open for next time

## Setup

```sh
git clone <repo-url> && cd kana
pnpm install
```

Create a `.env` file:

```sh
OPENAI_API_KEY=sk-...       # required
```

Then run:

```sh
pnpm dev
```

### Optional environment variables

| Variable | Description | Default |
|---|---|---|
| `OPENAI_ADMIN_KEY` | Org-level admin key — enables the HP bar (daily spend tracker) | — |
| `KANA_NAME` | Kana's display name | `かな` |
| `USER_NAME` | Your real name | `User` |
| `USER_NICKNAME` | How Kana addresses you | `ご主人様` |

## Slash commands

| Command | Description |
|---|---|
| `/rest` | End the current session (generates a summary) and start fresh |
| `/quit` | Exit the app (session stays open for next launch) |

## Database

Kana stores everything in a local SQLite file (`data/memory.db`). Errors are logged to `data/error.log`. The `data/` directory is gitignored. Migrations run automatically on startup.

```sh
pnpm db:generate   # generate migration from schema changes
pnpm db:migrate    # apply pending migrations
pnpm db:studio     # browse the DB in Drizzle Studio
```
