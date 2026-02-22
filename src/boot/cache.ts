import OpenAI from "openai";
import { getKv, getKvUpdatedAt, setKv } from "../db/kv.js";

export interface Cache {
  totalTokens: number;
  dailyCost: number;
  refreshDailyCost(): Promise<void>;
  nextQuestion: string | null;
  recentSummary: string | null;
}

function isWithin24Hours(isoTimestamp: string): boolean {
  return Date.now() - new Date(isoTimestamp).getTime() < 24 * 60 * 60 * 1000;
}

export function createCache(): Cache {
  let _dailyCost: number = (() => {
    const cached = getKv("daily_cost");
    return cached ? parseFloat(cached) || 0 : 0;
  })();

  const cache: Cache = {
    get totalTokens(): number {
      const cached = getKv("usage_total_tokens");
      return cached ? parseInt(cached, 10) || 0 : 0;
    },
    set totalTokens(value: number) {
      setKv("usage_total_tokens", String(value));
    },

    get dailyCost(): number {
      return _dailyCost;
    },

    async refreshDailyCost(): Promise<void> {
      const adminKey = process.env.OPENAI_ADMIN_KEY;
      if (!adminKey) return;

      const admin = new OpenAI({ apiKey: adminKey });
      const now = new Date();
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const startTime = Math.floor(todayStart.getTime() / 1000);
      const tomorrowStart = new Date(todayStart);
      tomorrowStart.setDate(tomorrowStart.getDate() + 1);
      const endTime = Math.floor(tomorrowStart.getTime() / 1000);

      const response = (await (admin as any).get(
        `/organization/costs?start_time=${startTime}&end_time=${endTime}&bucket_width=1d&limit=1`,
      )) as {
        data: Array<{
          results: Array<{ amount: { value: string } }>;
        }>;
      };

      let total = 0;
      for (const bucket of response.data ?? []) {
        for (const result of bucket.results ?? []) {
          total += parseFloat(result.amount?.value) || 0;
        }
      }
      setKv("daily_cost", String(total));
      _dailyCost = total;
    },

    get nextQuestion(): string | null {
      return getKv("next_question");
    },
    set nextQuestion(value: string | null) {
      if (value === null) return;
      setKv("next_question", value);
    },

    get recentSummary(): string | null {
      const updatedAt = getKvUpdatedAt("recent_conversation_summary");
      if (!updatedAt || !isWithin24Hours(updatedAt)) return null;
      return getKv("recent_conversation_summary");
    },
    set recentSummary(value: string | null) {
      if (value === null) return;
      setKv("recent_conversation_summary", value);
    },
  };

  return cache;
}
