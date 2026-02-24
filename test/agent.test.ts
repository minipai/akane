import { describe, it, expect, vi, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { isNull, desc, eq } from "drizzle-orm";
import * as schema from "../src/db/schema.js";
import { conversations, messages, config as configTable } from "../src/db/schema.js";
import type { Db } from "../src/db/db.js";
import type { ChatClient, ChatEntry } from "../src/types.js";
import type { Cache } from "../src/boot/cache.js";
import { Agent } from "../src/agent/agent.js";
import { getConfig, setConfig, getAllConfig, getConfigWithDefault, getConfigNumber } from "../src/db/config.js";

// Mock getDb so config module uses the test DB
let testDb: Db;
vi.mock("../src/db/db.js", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../src/db/db.js")>();
  return {
    ...orig,
    getDb: () => testDb,
  };
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "drizzle");

function createTestDb(): Db {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return db;
}

function createMockCache(): Cache {
  return {
    totalTokens: 0,
    dailyCost: 0,
    refreshDailyCost: vi.fn().mockResolvedValue(undefined),
    nextQuestion: null,
    recentSummary: null,
  };
}

function textResponse(content: string) {
  return {
    message: {
      role: "assistant" as const,
      content,
    },
    totalTokens: 50,
  };
}

function toolCallResponse(
  calls: Array<{ id: string; name: string; args: string }>,
  content: string | null = null,
) {
  return {
    message: {
      role: "assistant" as const,
      content,
      tool_calls: calls.map((c) => ({
        id: c.id,
        type: "function" as const,
        function: { name: c.name, arguments: c.args },
      })),
    },
    totalTokens: 30,
  };
}

function nullResponse() {
  return { message: null, totalTokens: 0 };
}

// ─── Test suite ──────────────────────────────────────────────────────

describe("Agent", () => {
  let db: Db;
  let cache: Cache;
  let client: ChatClient;

  beforeEach(() => {
    db = createTestDb();
    testDb = db;
    cache = createMockCache();
    client = {
      chat: vi.fn(),
      compress: vi.fn().mockResolvedValue("summary"),
    };
  });

  function makeAgent() {
    return new Agent(client, db, cache);
  }

  // ─── Session lifecycle ──────────────────────────────────────────

  describe("session lifecycle", () => {
    it("start() with empty DB does not crash", () => {
      const agent = makeAgent();
      expect(() => agent.start()).not.toThrow();
    });

    it("start() with empty DB has no active conversation", () => {
      const agent = makeAgent();
      agent.start();
      // Entries should only have the system prompt
      const entries = agent.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].message.role).toBe("system");
    });

    it("run() creates conversation lazily", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat).mockResolvedValueOnce(textResponse("Hello!"));

      const result = await agent.run("hi");
      expect(result).toBe("Hello!");

      // Conversation row should exist
      const rows = db.select().from(conversations).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].endedAt).toBeNull();
    });

    it("messages are persisted after run()", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat).mockResolvedValueOnce(textResponse("Hey there!"));
      await agent.run("hello");

      const rows = db.select().from(messages).all();
      // user message + assistant message (at minimum)
      expect(rows.length).toBeGreaterThanOrEqual(2);
      const roles = rows.map((r) => r.role);
      expect(roles).toContain("user");
      expect(roles).toContain("assistant");
    });

    it("rest() ends session with summary", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat).mockResolvedValueOnce(textResponse("Hi!"));
      await agent.run("hello");

      await agent.rest();

      const rows = db.select().from(conversations).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].endedAt).not.toBeNull();
      expect(rows[0].summary).toBe("summary");
    });

    it("resume on restart picks up existing conversation", async () => {
      // First agent: run a message
      const agent1 = makeAgent();
      agent1.start();
      vi.mocked(client.chat).mockResolvedValueOnce(textResponse("First response"));
      await agent1.run("first message");

      // Second agent with same DB: should resume
      const agent2 = new Agent(client, db, cache);
      agent2.start();

      // Entries should include hydrated messages from previous session
      const entries = agent2.getEntries();
      const userEntries = entries.filter((e) => e.message.role === "user");
      const assistantEntries = entries.filter((e) => e.message.role === "assistant");
      expect(userEntries.length).toBeGreaterThanOrEqual(1);
      expect(assistantEntries.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Conversation flow ──────────────────────────────────────────

  describe("conversation flow", () => {
    it("simple text exchange", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat).mockResolvedValueOnce(textResponse("I'm good, thanks!"));
      const result = await agent.run("How are you?");
      expect(result).toBe("I'm good, thanks!");
      expect(client.chat).toHaveBeenCalledTimes(1);
    });

    it("tool call loop — tool executes then final text returned", async () => {
      const agent = makeAgent();
      agent.start();

      // First call: LLM wants to set emotion
      vi.mocked(client.chat)
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc1", name: "set_emotion", args: '{"emotion":"happy"}' },
          ]),
        )
        // Second call: LLM returns text
        .mockResolvedValueOnce(textResponse("I'm feeling happy!"));

      const result = await agent.run("Tell me a joke");
      expect(result).toBe("I'm feeling happy!");
      expect(client.chat).toHaveBeenCalledTimes(2);
    });

    it("emotion tracking — set_emotion updates subsequent entries", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat)
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc1", name: "set_emotion", args: '{"emotion":"excited"}' },
          ]),
        )
        .mockResolvedValueOnce(textResponse("Wow!"));

      await agent.run("Something exciting!");

      const entries = agent.getEntries();
      const assistantEntries = entries.filter((e) => e.message.role === "assistant");
      // The final text assistant entry should carry the emotion
      const last = assistantEntries[assistantEntries.length - 1];
      expect(last.emotion).toBe("excited");
    });

    it("max iterations reached when LLM always returns tool calls", async () => {
      const agent = makeAgent();
      agent.start();

      // Always return a tool call (set_emotion is auto-approved so no hang)
      vi.mocked(client.chat).mockResolvedValue(
        toolCallResponse([
          { id: "tc1", name: "set_emotion", args: '{"emotion":"confused"}' },
        ]),
      );

      const result = await agent.run("loop forever");
      expect(result).toBe("(max iterations reached)");
      // 25 iterations = 25 LLM calls
      expect(client.chat).toHaveBeenCalledTimes(25);
    });

    it("null response returns '(no response)'", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat).mockResolvedValueOnce(nullResponse());

      const result = await agent.run("hello");
      expect(result).toBe("(no response)");
    });
  });

  // ─── First-message nudge ────────────────────────────────────────

  describe("first-message nudge", () => {
    it("short greeting with nextQuestion pushes developer nudge", async () => {
      cache.nextQuestion = "[identity] What is your name?";
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat).mockResolvedValueOnce(textResponse("Hi!"));
      await agent.run("hey");

      // Inspect what was passed to client.chat
      const callArgs = vi.mocked(client.chat).mock.calls[0][0];
      const devMessages = callArgs.messages.filter((m: any) => m.role === "developer");
      const nudge = devMessages.find((m: any) =>
        typeof m.content === "string" && m.content.includes("What is your name?"),
      );
      expect(nudge).toBeTruthy();
    });

    it("short greeting without nextQuestion pushes generic nudge", async () => {
      cache.nextQuestion = null;
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat).mockResolvedValueOnce(textResponse("Hi!"));
      await agent.run("hey");

      const callArgs = vi.mocked(client.chat).mock.calls[0][0];
      const devMessages = callArgs.messages.filter((m: any) => m.role === "developer");
      const nudge = devMessages.find((m: any) =>
        typeof m.content === "string" && m.content.includes("Greet the user"),
      );
      expect(nudge).toBeTruthy();
    });

    it("long first message does not get nudge", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat).mockResolvedValueOnce(textResponse("Interesting!"));
      await agent.run("Can you explain quantum computing to me in detail?");

      const callArgs = vi.mocked(client.chat).mock.calls[0][0];
      const devMessages = callArgs.messages.filter((m: any) => m.role === "developer");
      // Only the vitals hint should be a developer message, not the nudge
      const nudge = devMessages.find((m: any) =>
        typeof m.content === "string" &&
        (m.content.includes("Greet the user") || m.content.includes("you MUST ask")),
      );
      expect(nudge).toBeFalsy();
    });

    it("second message does not get nudge regardless of length", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat)
        .mockResolvedValueOnce(textResponse("Hi!"))
        .mockResolvedValueOnce(textResponse("Sure!"));

      await agent.run("hey");
      await agent.run("yo");

      // Check messages passed to the second LLM call:
      // The old nudge from run 1 is still in the history (pushRaw persists),
      // but no NEW nudge should appear after the second user message.
      const callArgs = vi.mocked(client.chat).mock.calls[1][0];
      const msgs = callArgs.messages;
      // Find the last user message index (the "yo" message)
      let lastUserIdx = -1;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if ((msgs[i] as any).role === "user") { lastUserIdx = i; break; }
      }
      // No developer nudge should appear after the second user message
      const msgsAfterUser = msgs.slice(lastUserIdx + 1);
      const nudge = msgsAfterUser.find((m: any) =>
        m.role === "developer" &&
        typeof m.content === "string" &&
        (m.content.includes("Greet the user") || m.content.includes("you MUST ask")),
      );
      expect(nudge).toBeFalsy();
    });
  });

  // ─── Tool approval flow ─────────────────────────────────────────

  describe("tool approval flow", () => {
    it("auto-approved tool (set_emotion) executes without approval callback", async () => {
      const agent = makeAgent();
      agent.start();

      const approvalCb = vi.fn();
      agent.setOnToolApproval(approvalCb);

      vi.mocked(client.chat)
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc1", name: "set_emotion", args: '{"emotion":"happy"}' },
          ]),
        )
        .mockResolvedValueOnce(textResponse("Done!"));

      await agent.run("set emotion");
      expect(approvalCb).not.toHaveBeenCalled();
    });

    it("non-auto tool (shell) triggers approval, approved → executes", async () => {
      const agent = makeAgent();
      agent.start();

      // Auto-approve when asked
      agent.setOnToolApproval(({ resolve }) => resolve(true));

      const activityLog: any[] = [];
      agent.setOnToolActivity((a) => activityLog.push(a));

      vi.mocked(client.chat)
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc1", name: "shell", args: '{"command":"echo hi"}' },
          ]),
        )
        .mockResolvedValueOnce(textResponse("Command executed!"));

      const result = await agent.run("run echo hi");
      expect(result).toBe("Command executed!");
      // Activity should show the shell tool was called
      expect(activityLog.some((a) => a.name === "shell")).toBe(true);
    });

    it("non-auto tool denied → 'Tool execution denied'", async () => {
      const agent = makeAgent();
      agent.start();

      // Deny when asked
      agent.setOnToolApproval(({ resolve }) => resolve(false));

      vi.mocked(client.chat)
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc1", name: "shell", args: '{"command":"rm -rf /"}' },
          ]),
        )
        .mockResolvedValueOnce(textResponse("Okay, I won't do that."));

      const result = await agent.run("delete everything");
      expect(result).toBe("Okay, I won't do that.");

      // Check that the tool result message contains denial
      const msgs = agent.getMessages();
      const toolMsg = msgs.find(
        (m: any) => m.role === "tool" && typeof m.content === "string" && m.content.includes("denied"),
      );
      expect(toolMsg).toBeTruthy();
    });
  });

  // ─── Callbacks & accessors ──────────────────────────────────────

  describe("callbacks and accessors", () => {
    it("setOnEmotionChange fires when emotion tool is called", async () => {
      const agent = makeAgent();
      agent.start();

      const emotionLog: string[] = [];
      agent.setOnEmotionChange((e) => emotionLog.push(e));

      vi.mocked(client.chat)
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc1", name: "set_emotion", args: '{"emotion":"excited"}' },
          ]),
        )
        .mockResolvedValueOnce(textResponse("Yay!"));

      await agent.run("exciting news");
      expect(emotionLog).toEqual(["excited"]);
    });

    it("addInfo() inserts info entries visible in getEntries()", () => {
      const agent = makeAgent();
      agent.start();

      agent.addInfo({ kind: "info", label: "test", content: "hello world", ts: Date.now() });

      const entries = agent.getEntries();
      const info = entries.find((e: any) => e.kind === "info" && e.content === "hello world");
      expect(info).toBeTruthy();
    });

    it("vitals tracks tokens from LLM calls", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat).mockResolvedValueOnce(textResponse("Hi!"));
      await agent.run("hello");

      expect(agent.vitals.getTotalTokens()).toBe(50);
    });

    it("refreshPrompt() updates the system prompt in-place", async () => {
      const agent = makeAgent();
      agent.start();

      const msgsBefore = agent.getMessages();
      const systemBefore = (msgsBefore[0] as any).content;

      agent.refreshPrompt();

      const msgsAfter = agent.getMessages();
      const systemAfter = (msgsAfter[0] as any).content;
      // Should be a string (rebuilt prompt) — same value since nothing changed,
      // but the important thing is it didn't crash and is still a valid prompt
      expect(typeof systemAfter).toBe("string");
      expect(systemAfter.length).toBeGreaterThan(0);
    });
  });

  // ─── Post-rest reset ──────────────────────────────────────────

  describe("post-rest reset", () => {
    it("run() after rest() starts a fresh session", async () => {
      const agent = makeAgent();
      agent.start();

      // First conversation
      vi.mocked(client.chat).mockResolvedValueOnce(textResponse("Hi!"));
      await agent.run("hello");

      await agent.rest();

      // Second conversation after rest
      vi.mocked(client.chat).mockResolvedValueOnce(textResponse("Hello again!"));
      const result = await agent.run("hey");
      expect(result).toBe("Hello again!");

      // Should have created a second conversation
      const rows = db.select().from(conversations).all();
      expect(rows).toHaveLength(2);
      // First ended, second still open
      expect(rows.filter((r) => r.endedAt !== null)).toHaveLength(1);
      expect(rows.filter((r) => r.endedAt === null)).toHaveLength(1);
    });
  });

  // ─── Command methods ───────────────────────────────────────────

  describe("command methods", () => {
    it("introduce() sends intro prompt and returns response", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat).mockResolvedValueOnce(textResponse("Hi, I'm Kana!"));

      const result = await agent.introduce();
      expect(result).toBe("Hi, I'm Kana!");

      // The user message should contain the intro prompt
      const callArgs = vi.mocked(client.chat).mock.calls[0][0];
      const userMsgs = callArgs.messages.filter((m: any) => m.role === "user");
      expect(userMsgs.some((m: any) => m.content.includes("Introduce yourself"))).toBe(true);

      // Entry should carry the /intro label
      const entries = agent.getEntries();
      const labeled = entries.find((e: any) => e.label?.includes("/intro"));
      expect(labeled).toBeTruthy();
    });

    it("look() sends look prompt and returns response", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat).mockResolvedValueOnce(textResponse("*twirls*"));

      const result = await agent.look();
      expect(result).toBe("*twirls*");

      const callArgs = vi.mocked(client.chat).mock.calls[0][0];
      const userMsgs = callArgs.messages.filter((m: any) => m.role === "user");
      expect(userMsgs.some((m: any) => m.content.includes("looks at you"))).toBe(true);

      const entries = agent.getEntries();
      const labeled = entries.find((e: any) => e.label?.includes("/look"));
      expect(labeled).toBeTruthy();
    });

    it("beginRest() sends rest prompt then ends session", async () => {
      const agent = makeAgent();
      agent.start();

      // First run creates a conversation
      vi.mocked(client.chat).mockResolvedValueOnce(textResponse("Hi!"));
      await agent.run("hello");

      // beginRest: LLM says goodbye + calls rest_session (terminal)
      vi.mocked(client.chat).mockResolvedValueOnce(
        toolCallResponse(
          [{ id: "tc1", name: "rest_session", args: '{"description":"Kana curls up."}' }],
          "Goodnight!",
        ),
      );

      await agent.beginRest();

      // Conversation should be ended
      const rows = db.select().from(conversations).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].endedAt).not.toBeNull();
    });

    it("changeOutfit() persists outfit and sends reaction prompt", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat).mockResolvedValueOnce(textResponse("Love this dress!"));

      const result = await agent.changeOutfit("summer dress");
      expect(result).toBe("Love this dress!");

      const callArgs = vi.mocked(client.chat).mock.calls[0][0];
      const userMsgs = callArgs.messages.filter((m: any) => m.role === "user");
      expect(userMsgs.some((m: any) => m.content.includes("summer dress"))).toBe(true);

      const entries = agent.getEntries();
      const labeled = entries.find((e: any) => e.label?.includes("/outfit"));
      expect(labeled).toBeTruthy();
    });
  });

  // ─── Terminal tool detection ───────────────────────────────────

  describe("terminal tool detection", () => {
    it("rest_session alone is terminal — stops the loop", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat).mockResolvedValueOnce(
        toolCallResponse(
          [{ id: "tc1", name: "rest_session", args: '{"description":"resting"}' }],
          "Bye!",
        ),
      );

      const result = await agent.run("rest");
      expect(result).toBe("Bye!");
      // Only one LLM call — no follow-up turn
      expect(client.chat).toHaveBeenCalledTimes(1);
    });

    it("rest_session + set_emotion together is still terminal", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat).mockResolvedValueOnce(
        toolCallResponse(
          [
            { id: "tc1", name: "set_emotion", args: '{"emotion":"happy"}' },
            { id: "tc2", name: "rest_session", args: '{"description":"resting"}' },
          ],
          "Goodnight!",
        ),
      );

      const result = await agent.run("rest now");
      expect(result).toBe("Goodnight!");
      // Only one LLM call — anyTerminal stops the loop
      expect(client.chat).toHaveBeenCalledTimes(1);
    });

    it("message.content from terminal turn is added to entries", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat).mockResolvedValueOnce(
        toolCallResponse(
          [{ id: "tc1", name: "rest_session", args: '{"description":"curls up"}' }],
          "Sweet dreams!",
        ),
      );

      await agent.run("goodnight");

      const entries = agent.getEntries();
      const assistantEntries = entries.filter(
        (e: any) => e.message?.role === "assistant" && e.message.content,
      );
      expect(assistantEntries.some((e: any) => e.message.content === "Sweet dreams!")).toBe(true);
    });
  });

  // ─── Retry ─────────────────────────────────────────────────────

  describe("retry", () => {
    it("retry() removes last assistant response and regenerates", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat)
        .mockResolvedValueOnce(textResponse("First answer"))
        .mockResolvedValueOnce(textResponse("Second answer"));

      await agent.run("hello");
      const result = await agent.retry();

      expect(result).toBe("Second answer");
      // Two LLM calls: original + retry
      expect(client.chat).toHaveBeenCalledTimes(2);
    });

    it("retry() with no prior messages returns '(nothing to retry)'", async () => {
      const agent = makeAgent();
      agent.start();

      const result = await agent.retry();
      expect(result).toBe("(nothing to retry)");
    });

    it("retry() removes assistant messages from DB", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat)
        .mockResolvedValueOnce(textResponse("Old response"))
        .mockResolvedValueOnce(textResponse("New response"));

      await agent.run("hello");

      // Before retry: should have user + assistant messages
      const beforeRows = db.select().from(messages).all();
      const beforeCount = beforeRows.length;
      expect(beforeCount).toBeGreaterThanOrEqual(2);

      await agent.retry();

      // After retry: old assistant removed, new one added
      // Net effect: same user message, different assistant message
      const afterRows = db.select().from(messages).all();
      const assistantRows = afterRows.filter((r) => r.role === "assistant");
      expect(assistantRows).toHaveLength(1);
      expect(assistantRows[0].content).toBe("New response");
    });

    it("retry() preserves the user message in history", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat)
        .mockResolvedValueOnce(textResponse("Old"))
        .mockResolvedValueOnce(textResponse("New"));

      await agent.run("my question");
      await agent.retry();

      // The user message should still be in the LLM messages
      const msgs = agent.getMessages();
      const userMsgs = msgs.filter((m: any) => m.role === "user" && m.content === "my question");
      expect(userMsgs).toHaveLength(1);
    });

    it("retry() after tool call turn removes tool messages too", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat)
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc1", name: "set_emotion", args: '{"emotion":"happy"}' },
          ]),
        )
        .mockResolvedValueOnce(textResponse("I'm happy!"))
        // Retry responses
        .mockResolvedValueOnce(textResponse("Different answer"));

      await agent.run("tell me something");
      await agent.retry();

      // Should only have: system, user, new assistant
      const msgs = agent.getMessages();
      const toolMsgs = msgs.filter((m: any) => m.role === "tool");
      expect(toolMsgs).toHaveLength(0);

      const assistantMsgs = msgs.filter((m: any) => m.role === "assistant");
      expect(assistantMsgs).toHaveLength(1);
      expect(assistantMsgs[0].content).toBe("Different answer");
    });

    it("retry() does not duplicate the user message", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat)
        .mockResolvedValueOnce(textResponse("First"))
        .mockResolvedValueOnce(textResponse("Second"));

      await agent.run("hello");
      await agent.retry();

      const userDbRows = db.select().from(messages).all().filter((r) => r.role === "user");
      expect(userDbRows).toHaveLength(1);
    });
  });

  // ─── Think tool ─────────────────────────────────────────────────

  describe("think tool", () => {
    it("think is auto-approved (no approval callback)", async () => {
      const agent = makeAgent();
      agent.start();

      const approvalCb = vi.fn();
      agent.setOnToolApproval(approvalCb);

      vi.mocked(client.chat)
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc1", name: "think", args: '{"thought":"Let me plan this out..."}' },
          ]),
        )
        .mockResolvedValueOnce(textResponse("Here's my plan."));

      await agent.run("do something complex");
      expect(approvalCb).not.toHaveBeenCalled();
    });

    it("think tool is silent (no activity callback)", async () => {
      const agent = makeAgent();
      agent.start();

      const activityLog: any[] = [];
      agent.setOnToolActivity((a) => activityLog.push(a));

      vi.mocked(client.chat)
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc1", name: "think", args: '{"thought":"Planning..."}' },
          ]),
        )
        .mockResolvedValueOnce(textResponse("Done thinking."));

      await agent.run("plan something");
      expect(activityLog.filter((a) => a.name === "think")).toHaveLength(0);
    });

    it("think tool returns OK", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat)
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc1", name: "think", args: '{"thought":"Hmm..."}' },
          ]),
        )
        .mockResolvedValueOnce(textResponse("Thought about it."));

      await agent.run("think about this");

      const msgs = agent.getMessages();
      const toolMsg = msgs.find(
        (m: any) => m.role === "tool" && m.content === "OK",
      );
      expect(toolMsg).toBeTruthy();
    });

    it("multi-step flow: think → shell → think → answer", async () => {
      const agent = makeAgent();
      agent.start();

      agent.setOnToolApproval(({ resolve }) => resolve(true));

      vi.mocked(client.chat)
        // Step 1: think about the plan
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc1", name: "think", args: '{"thought":"I need to list files first"}' },
          ]),
        )
        // Step 2: execute shell command
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc2", name: "shell", args: '{"command":"ls src/"}' },
          ]),
        )
        // Step 3: think about results
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc3", name: "think", args: '{"thought":"Found the files, now I can answer"}' },
          ]),
        )
        // Step 4: final answer
        .mockResolvedValueOnce(textResponse("Here are the files I found."));

      const result = await agent.run("what files are in src?");
      expect(result).toBe("Here are the files I found.");
      expect(client.chat).toHaveBeenCalledTimes(4);
    });
  });

  // ─── Config DB layer ────────────────────────────────────────────

  describe("config DB layer", () => {
    it("getConfig returns null for missing key", () => {
      expect(getConfig("nonexistent")).toBeNull();
    });

    it("setConfig + getConfig round-trips a value", () => {
      setConfig("kana_name", "テスト");
      expect(getConfig("kana_name")).toBe("テスト");
    });

    it("setConfig upserts existing key", () => {
      setConfig("kana_name", "first");
      setConfig("kana_name", "second");
      expect(getConfig("kana_name")).toBe("second");
    });

    it("getAllConfig returns all stored values", () => {
      setConfig("kana_name", "かな");
      setConfig("user_name", "Art");
      setConfig("user_nickname", "あーちゃん");
      const all = getAllConfig();
      expect(all).toEqual({
        kana_name: "かな",
        user_name: "Art",
        user_nickname: "あーちゃん",
      });
    });

    it("getAllConfig returns empty object when no rows", () => {
      expect(getAllConfig()).toEqual({});
    });

    it("getConfigWithDefault returns built-in default when unset", () => {
      expect(getConfigWithDefault("kana_name")).toBe("かな");
      expect(getConfigWithDefault("user_name")).toBe("User");
      expect(getConfigWithDefault("user_nickname")).toBe("ご主人様");
    });

    it("getConfigWithDefault returns DB value over default", () => {
      setConfig("kana_name", "Miku");
      expect(getConfigWithDefault("kana_name")).toBe("Miku");
    });

    it("getConfigNumber returns default when unset", () => {
      expect(getConfigNumber("daily_budget")).toBe(1);
      expect(getConfigNumber("session_token_limit")).toBe(100000);
    });

    it("getConfigNumber returns DB value when set", () => {
      setConfig("daily_budget", "2.5");
      setConfig("session_token_limit", "50000");
      expect(getConfigNumber("daily_budget")).toBe(2.5);
      expect(getConfigNumber("session_token_limit")).toBe(50000);
    });

    it("getConfigNumber returns 0 for unknown key with no default", () => {
      expect(getConfigNumber("nonexistent")).toBe(0);
    });
  });

  // ─── update_config tool ──────────────────────────────────────────

  describe("update_config tool", () => {
    it("update_config is auto-approved", async () => {
      const agent = makeAgent();
      agent.start();

      const approvalCb = vi.fn();
      agent.setOnToolApproval(approvalCb);

      vi.mocked(client.chat)
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc1", name: "update_config", args: '{"kana_name":"Miku"}' },
          ]),
        )
        .mockResolvedValueOnce(textResponse("Updated!"));

      await agent.run("change name");
      expect(approvalCb).not.toHaveBeenCalled();
    });

    it("update_config persists values to DB", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat)
        .mockResolvedValueOnce(
          toolCallResponse([
            {
              id: "tc1",
              name: "update_config",
              args: '{"kana_name":"Miku","user_nickname":"マスター"}',
            },
          ]),
        )
        .mockResolvedValueOnce(textResponse("Done!"));

      await agent.run("change config");

      expect(getConfig("kana_name")).toBe("Miku");
      expect(getConfig("user_nickname")).toBe("マスター");
    });

    it("update_config with number params persists to DB", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat)
        .mockResolvedValueOnce(
          toolCallResponse([
            {
              id: "tc1",
              name: "update_config",
              args: '{"daily_budget":2.5,"session_token_limit":50000}',
            },
          ]),
        )
        .mockResolvedValueOnce(textResponse("Updated!"));

      await agent.run("change budget");

      expect(getConfig("daily_budget")).toBe("2.5");
      expect(getConfig("session_token_limit")).toBe("50000");
    });

    it("update_config with null values are ignored", async () => {
      setConfig("kana_name", "Original");
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat)
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc1", name: "update_config", args: '{"kana_name":null,"user_name":"Art"}' },
          ]),
        )
        .mockResolvedValueOnce(textResponse("Done!"));

      await agent.run("update");

      expect(getConfig("kana_name")).toBe("Original");
      expect(getConfig("user_name")).toBe("Art");
    });
  });

  // ─── configure() command ─────────────────────────────────────────

  describe("configure() command", () => {
    it("configure() sends current config values in the prompt", async () => {
      setConfig("kana_name", "かな");
      setConfig("user_name", "Art");
      setConfig("user_nickname", "あーちゃん");

      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat).mockResolvedValueOnce(textResponse("Here are your settings!"));

      await agent.configure();

      const callArgs = vi.mocked(client.chat).mock.calls[0][0];
      const userMsgs = callArgs.messages.filter((m: any) => m.role === "user");
      const configMsg = userMsgs.find(
        (m: any) =>
          m.content.includes("kana_name") &&
          m.content.includes("かな") &&
          m.content.includes("Art") &&
          m.content.includes("あーちゃん"),
      );
      expect(configMsg).toBeTruthy();
    });

    it("configure() carries /config label", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat).mockResolvedValueOnce(textResponse("Settings!"));

      await agent.configure();

      const entries = agent.getEntries();
      const labeled = entries.find((e: any) => e.label?.includes("/config"));
      expect(labeled).toBeTruthy();
    });
  });

  // ─── File tools ──────────────────────────────────────────────

  describe("file tools", () => {
    it("read_file is auto-approved (no approval callback)", async () => {
      const agent = makeAgent();
      agent.start();

      const approvalCb = vi.fn();
      agent.setOnToolApproval(approvalCb);

      vi.mocked(client.chat)
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc1", name: "read_file", args: '{"path":"package.json"}' },
          ]),
        )
        .mockResolvedValueOnce(textResponse("Here's the file."));

      await agent.run("read package.json");
      expect(approvalCb).not.toHaveBeenCalled();
    });

    it("read_file returns file content to LLM", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat)
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc1", name: "read_file", args: '{"path":"package.json"}' },
          ]),
        )
        .mockResolvedValueOnce(textResponse("Got it."));

      await agent.run("read package.json");

      const msgs = agent.getMessages();
      const toolMsg = msgs.find(
        (m: any) => m.role === "tool" && typeof m.content === "string" && m.content.includes('"name"'),
      );
      expect(toolMsg).toBeTruthy();
    });

    it("read_file returns error for missing file", async () => {
      const agent = makeAgent();
      agent.start();

      vi.mocked(client.chat)
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc1", name: "read_file", args: '{"path":"/nonexistent/file.txt"}' },
          ]),
        )
        .mockResolvedValueOnce(textResponse("File not found."));

      await agent.run("read missing file");

      const msgs = agent.getMessages();
      const toolMsg = msgs.find(
        (m: any) => m.role === "tool" && typeof m.content === "string" && m.content.includes("Error reading file"),
      );
      expect(toolMsg).toBeTruthy();
    });

    it("write_file requires approval (not auto-approved)", async () => {
      const agent = makeAgent();
      agent.start();

      const approvalCb = vi.fn(({ resolve }: any) => resolve(true));
      agent.setOnToolApproval(approvalCb);

      vi.mocked(client.chat)
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc1", name: "write_file", args: '{"path":"/tmp/kana_test_write.txt","content":"hello"}' },
          ]),
        )
        .mockResolvedValueOnce(textResponse("Written!"));

      await agent.run("write a file");
      expect(approvalCb).toHaveBeenCalled();
    });

    it("write_file creates file and returns byte count", async () => {
      const agent = makeAgent();
      agent.start();

      agent.setOnToolApproval(({ resolve }) => resolve(true));

      const testPath = `/tmp/kana_test_${Date.now()}.txt`;

      vi.mocked(client.chat)
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc1", name: "write_file", args: JSON.stringify({ path: testPath, content: "test content" }) },
          ]),
        )
        .mockResolvedValueOnce(textResponse("Done!"));

      await agent.run("write a file");

      const msgs = agent.getMessages();
      const toolMsg = msgs.find(
        (m: any) => m.role === "tool" && typeof m.content === "string" && m.content.includes("bytes"),
      );
      expect(toolMsg).toBeTruthy();

      // Clean up
      const { unlink } = await import("fs/promises");
      await unlink(testPath).catch(() => {});
    });

    it("write_file denied returns denial message", async () => {
      const agent = makeAgent();
      agent.start();

      agent.setOnToolApproval(({ resolve }) => resolve(false));

      vi.mocked(client.chat)
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc1", name: "write_file", args: '{"path":"/tmp/denied.txt","content":"nope"}' },
          ]),
        )
        .mockResolvedValueOnce(textResponse("Okay, I won't write."));

      await agent.run("write something");

      const msgs = agent.getMessages();
      const toolMsg = msgs.find(
        (m: any) => m.role === "tool" && typeof m.content === "string" && m.content.includes("denied"),
      );
      expect(toolMsg).toBeTruthy();
    });

    it("read_file shows activity in tool panel", async () => {
      const agent = makeAgent();
      agent.start();

      const activityLog: any[] = [];
      agent.setOnToolActivity((a) => activityLog.push(a));

      vi.mocked(client.chat)
        .mockResolvedValueOnce(
          toolCallResponse([
            { id: "tc1", name: "read_file", args: '{"path":"package.json"}' },
          ]),
        )
        .mockResolvedValueOnce(textResponse("Got it."));

      await agent.run("read a file");

      expect(activityLog.some((a) => a.name === "read_file")).toBe(true);
    });
  });
});
