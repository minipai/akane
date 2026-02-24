import type { ChatClient, Message, InfoEntry, Entry } from "../types.js";
import type { Db } from "../db/db.js";
import { Memory } from "./memory/memory.js";
import type { Cache } from "../boot/cache.js";
import { tools } from "./tools/index.js";
import { buildSystemPrompt } from "./prompts/index.js";
import { setKv } from "../db/kv.js";
import { fetchAndCacheWeather, getCachedWeather } from "../utils/ambient.js";
import { getConfig, getConfigWithDefault } from "../db/config.js";
import { generateNextQuestion } from "./tools/user-facts.js";
import { Scribe } from "./core/scribe.js";
import { Vitals } from "./core/vitals.js";
import { Technician } from "./core/technician.js";
import { Secretary } from "./core/secretary.js";
import type { OnToolActivity, OnToolApproval, OnEmotionChange } from "./core/technician.js";

const MAX_ITERATIONS = 25;

export class Agent {
  private client: ChatClient;
  private memory: Memory;
  private cache: Cache;
  private buildPrompt: () => string;
  private scribe: Scribe;
  readonly vitals: Vitals;
  private technician: Technician;
  private secretary: Secretary;
  private isFirstUserMessage = true;

  constructor(client: ChatClient, db: Db, cache: Cache) {
    this.client = client;
    this.memory = new Memory(db, client.compress.bind(client));
    this.cache = cache;
    this.buildPrompt = () => buildSystemPrompt(this.memory.buildContext(cache.recentSummary));
    this.scribe = new Scribe(this.buildPrompt(), this.memory);
    this.vitals = new Vitals(cache);
    this.technician = new Technician(
      this.memory, cache, client.compress.bind(client),
      this.addInfo.bind(this),
      () => this.vitals.setTotalTokens(0),
      () => this.refreshPrompt(),
    );
    this.secretary = new Secretary(this.memory, cache, client.compress.bind(client));
  }

  /** Resume or create a session. */
  start(): void {
    // Fire-and-forget boot-time memory ops
    const compress = this.client.compress.bind(this.client);
    this.memory.fadeMemories();
    if (!getCachedWeather()) fetchAndCacheWeather();
    if (!this.cache.nextQuestion) {
      generateNextQuestion(this.memory, this.cache, compress);
    }

    const { conversationId, entries } = this.secretary.resume();
    if (conversationId) {
      this.scribe.setConversationId(conversationId);
    }
    if (entries.length > 0) {
      this.scribe.hydrate(entries);
      this.isFirstUserMessage = false;
    }
  }

  /** Lazily create a conversation on first message. */
  private ensureConversation(): void {
    this.resetIfNeeded();
    if (this.scribe.getConversationId()) return;
    const id = this.memory.createConversation();
    this.scribe.setConversationId(id);
  }

  /** End the current session and start a fresh one. */
  async rest(): Promise<void> {
    const currentId = this.scribe.getConversationId();
    const entries = this.scribe.getChatEntries();

    this.needsReset = true;
    await this.secretary.rest(currentId, entries);
  }

  private needsReset = false;

  /** Start a fresh LLM session lazily so the UI keeps showing the old conversation. */
  private resetIfNeeded(): void {
    if (!this.needsReset) return;
    this.needsReset = false;
    this.scribe.newSession(this.buildPrompt());
  }

  setOnToolActivity(cb: OnToolActivity): void {
    this.technician.setOnActivity(cb);
  }

  setOnToolApproval(cb: OnToolApproval): void {
    this.technician.setOnApproval(cb);
  }

  setOnEmotionChange(cb: OnEmotionChange): void {
    this.technician.setOnEmotionChange(cb);
  }

  /** Rebuild and update the system prompt without resetting the session. */
  refreshPrompt(): void {
    this.scribe.updateSystemPrompt(this.buildPrompt());
  }

  /** Introduce yourself. */
  introduce(): Promise<string> {
    this.ensureConversation();
    this.scribe.addMessage({ role: "status", content: "/intro  Ask Kana to introduce herself" });
    return this.run("Introduce yourself — who you are, your personality, and what you can do.", { hidden: true });
  }

  /** Describe appearance for /look. */
  look(): Promise<string> {
    this.ensureConversation();
    this.scribe.addMessage({ role: "status", content: "/look  Describe Kana's appearance" });
    return this.run(
      "The user looks at you. Call describe_agent with a third-person narrative description of what the user sees — your appearance, clothing, expression, features. Then respond — you notice them looking, react in character. Use the conversation language.",
      { hidden: true },
    );
  }

  /** User performs an action — Kana reacts in character. */
  action(action: string): Promise<string> {
    this.ensureConversation();
    this.scribe.addMessage({ role: "status", content: `/me  ${action}` });
    return this.run(
      `The user performs an action: *${action}*. React naturally in character. Keep it brief. Use the conversation language.`,
      { hidden: true },
    );
  }

  /** End the current session — no LLM call, just save and reset. */
  beginRest(): void {
    this.ensureConversation();
    this.scribe.addMessage({ role: "status", content: `${getConfigWithDefault("kana_name")} quietly tucking away today's memories…` });
    this.vitals.setTotalTokens(0);
    // Fire-and-forget: summary generation happens in the background
    this.rest();
  }

  /** Show current persona config and let the user change values. */
  configure(): Promise<string> {
    this.ensureConversation();
    this.scribe.addMessage({ role: "status", content: "/config  View and change persona settings" });
    const fmt = (key: string) => getConfig(key) ?? "(unset)";
    const fmtDef = (key: string) => getConfigWithDefault(key);
    return this.run(
      `The user wants to view/change persona settings. Current values:\n- kana_name: ${fmt("kana_name")}\n- user_name: ${fmt("user_name")}\n- user_nickname: ${fmt("user_nickname")}\n- daily_budget: $${fmtDef("daily_budget")} USD\n- session_token_limit: ${fmtDef("session_token_limit")} tokens\n\nShow them these current values. Values marked (unset) have not been configured yet — tell the user they are not set. Ask what they'd like to change. If they want to change something, call update_config with the new values. Use the conversation language.`,
      { hidden: true },
    );
  }

  /** Change outfit: persist to KV, refresh prompt, and react. */
  changeOutfit(name: string): Promise<string> {
    this.ensureConversation();
    this.scribe.addMessage({ role: "status", content: `/outfit  ${name}` });
    setKv("outfit", name);
    this.refreshPrompt();
    return this.run(
      `Your outfit just changed to ${name}. React naturally — comment on your new look, how it feels, etc. Use the conversation language.`,
      { hidden: true },
    );
  }

  /** Remove the last assistant response and regenerate it. */
  async retry(): Promise<string> {
    const result = this.scribe.popLastTurn();
    if (!result) return "(nothing to retry)";
    this.scribe.addMessage({ role: "status", content: "/again  Regenerate the last response" });

    // Re-run the LLM loop (don't call run() — the user message is already in messages[])
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const { message, searched } = await this.callLLM();
      if (!message) return "(no response)";

      if (searched) this.scribe.addMessage({ role: "status", content: `${getConfigWithDefault("kana_name")} searched the web` });
      this.scribe.addMessage(message);

      const calls = message.tool_calls?.filter((tc) => tc.type === "function");
      if (!calls || calls.length === 0) {
        return message.content ?? "(no response)";
      }

      const { results, emotion, terminal } = await this.technician.run(calls);

      if (emotion) this.scribe.setEmotion(emotion);
      for (const r of results) {
        this.scribe.addMessage({ role: "tool", tool_call_id: r.tool_call_id, content: r.content });
      }

      if (terminal) {
        return message.content ?? "";
      }
    }

    return "(max iterations reached)";
  }

  getMessages() {
    return this.scribe.getMessages();
  }

  getEntries(): Entry[] {
    return this.scribe.getEntries();
  }

  addInfo(info: InfoEntry): void {
    this.scribe.addInfo(info);
  }


  async run(userInput: string, opts?: { hidden?: boolean }): Promise<string> {
    this.ensureConversation();
    if (opts?.hidden) {
      this.scribe.pushRaw({ role: "developer", content: userInput });
    } else {
      this.scribe.addMessage({ role: "user", content: userInput });
    }

    // Nudge the model to ask a personal question on casual greetings
    if (this.isFirstUserMessage && userInput.trim().length < 20) {
      const question = this.cache.nextQuestion;
      const nudge = question
        ? `After greeting, you MUST ask this exact question (translate to the conversation language if needed): ${question}`
        : "Greet the user and casually ask something about themselves to get to know them better.";
      this.scribe.pushRaw({ role: "developer", content: nudge });
      // Pre-generate a fresh question for next session
      generateNextQuestion(this.memory, this.cache, this.client.compress.bind(this.client));
    }
    this.isFirstUserMessage = false;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const { message, searched } = await this.callLLM();
      if (!message) return "(no response)";

      if (searched) this.scribe.addMessage({ role: "status", content: `${getConfigWithDefault("kana_name")} searched the web` });
      this.scribe.addMessage(message);

      const calls = message.tool_calls?.filter((tc) => tc.type === "function");
      if (!calls || calls.length === 0) {
        return message.content ?? "(no response)";
      }

      const { results, emotion, terminal } = await this.technician.run(calls);

      if (emotion) this.scribe.setEmotion(emotion);
      for (const r of results) {
        this.scribe.addMessage({ role: "tool", tool_call_id: r.tool_call_id, content: r.content });
      }

      if (terminal) {
        return message.content ?? "";
      }
    }

    return "(max iterations reached)";
  }

  private async callLLM(): Promise<{ message: Message | null; searched: boolean }> {
    const messages: Message[] = [
      ...this.scribe.getMessages(),
      { role: "developer", content: this.vitals.buildHints() },
    ];

    const { message, totalTokens, searched } = await this.client.chat({ messages, tools });

    if (totalTokens) {
      this.vitals.addTokens(totalTokens);
    }

    return { message, searched: searched ?? false };
  }
}
