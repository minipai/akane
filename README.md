# K.A.N.A — Kawaii And Nice Assistant ♡⸜(˶˃ ᵕ ˂˶)⸝♡

AI chat agent with a TUI built on Ink (React for CLI).

## Setup

```
npm install
# create .env with your OPENAI_API_KEY
npm run dev
```

### Environment variables

| Variable | Description | Default |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI API key (required) | — |
| `KANA_NAME` | Kana's display name | `かな` |
| `USER_NAME` | Your name | `User` |
| `USER_NICKNAME` | How Kana addresses you | `ご主人様` |

## Database

Kana stores conversation history in a local SQLite database (`memory.db` in project root).

Migrations run automatically on startup. If you change the schema in `src/memory/schema.ts`, generate a new migration:

```
npm run db:generate   # generate migration from schema changes
npm run db:migrate    # apply pending migrations manually
npm run db:studio     # browse the DB in Drizzle Studio
```
