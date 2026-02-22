import OpenAI from "openai";
import { getKv, setKv } from "./kv.js";

export function getCachedDailyCost(): number {
  const cached = getKv("daily_cost");
  return cached ? parseFloat(cached) || 0 : 0;
}

export async function getDailySpend(): Promise<number> {
  const adminKey = process.env.OPENAI_ADMIN_KEY;
  if (!adminKey) return 0;

  try {
    const admin = new OpenAI({ apiKey: adminKey });
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startTime = Math.floor(todayStart.getTime() / 1000);
    const endTime = Math.floor(now.getTime() / 1000);

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
    return total;
  } catch {
    return 0;
  }
}
