import type { ChatClient } from "../types.js";
import { and, eq, gte, lt, desc, isNotNull } from "drizzle-orm";
import { getDb } from "./db.js";
import { diary, conversations } from "./schema.js";

type DiaryType = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

async function summarizeTexts(
  client: ChatClient,
  model: string,
  texts: string[],
  instruction: string,
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: instruction,
      },
      {
        role: "user",
        content: texts.map((t) => `- ${t}`).join("\n"),
      },
    ],
  });
  return response.choices[0]?.message?.content ?? "";
}

function diaryExists(type: DiaryType, date: string): boolean {
  const db = getDb();
  const row = db
    .select({ date: diary.date })
    .from(diary)
    .where(and(eq(diary.type, type), eq(diary.date, date)))
    .get();
  return !!row;
}

function insertDiary(type: DiaryType, date: string, summary: string): void {
  const db = getDb();
  db.insert(diary)
    .values({ type, date, summary, createdAt: new Date().toISOString() })
    .run();
}

function getDiaries(type: DiaryType, dates: string[]): string[] {
  if (dates.length === 0) return [];
  const db = getDb();
  const rows = db
    .select({ date: diary.date, summary: diary.summary })
    .from(diary)
    .where(and(eq(diary.type, type)))
    .orderBy(diary.date)
    .all();
  const dateSet = new Set(dates);
  return rows.filter((r) => dateSet.has(r.date)).map((r) => r.summary);
}

// --- Date helpers ---

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function getISOWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return { year: date.getUTCFullYear(), week };
}

function formatWeek(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function lastISOWeek(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  const { year, week } = getISOWeek(d);
  return formatWeek(year, week);
}

function lastMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastQuarter(): { key: string; months: string[] } {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed
  const q = Math.floor(month / 3) + 1;
  const startMonth = (q - 1) * 3;
  const months = [0, 1, 2].map(
    (i) => `${year}-${String(startMonth + i + 1).padStart(2, "0")}`,
  );
  return { key: `${year}-Q${q}`, months };
}

function lastYear(): { key: string; quarters: string[] } {
  const year = new Date().getFullYear() - 1;
  return {
    key: String(year),
    quarters: [1, 2, 3, 4].map((q) => `${year}-Q${q}`),
  };
}

/** Get all daily date strings for a given ISO week (Mon-Sun) */
function datesInWeek(weekStr: string): string[] {
  const [yearStr, weekPart] = weekStr.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekPart, 10);

  // Find Jan 4th of that year (always in ISO week 1), then back to Monday
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7; // Mon=1 ... Sun=7
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/** Get ISO week strings that fall within a given month */
function weeksInMonth(monthStr: string): string[] {
  const [yearStr, monthPart] = monthStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthPart, 10) - 1;

  const weeks = new Set<string>();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(Date.UTC(year, month, day));
    const { year: wy, week } = getISOWeek(d);
    weeks.add(formatWeek(wy, week));
  }
  return [...weeks];
}

// --- Generation per level ---

async function generateDaily(client: ChatClient, model: string): Promise<void> {
  const date = yesterday();

  if (diaryExists("daily", date)) return;

  const nextDay = new Date(date + "T00:00:00Z");
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const nextDayStr = nextDay.toISOString().slice(0, 10);

  const db = getDb();
  const rows = db
    .select({ summary: conversations.summary })
    .from(conversations)
    .where(
      and(
        isNotNull(conversations.summary),
        gte(conversations.startedAt, date),
        lt(conversations.startedAt, nextDayStr),
      ),
    )
    .orderBy(conversations.startedAt)
    .all();

  const summaries = rows.map((r) => r.summary!).filter(Boolean);
  if (summaries.length === 0) return;

  const text = await summarizeTexts(
    client,
    model,
    summaries,
    "Summarize these conversation summaries from a single day into a concise diary entry (2-3 sentences). Capture the key topics, decisions, and emotional tone. Reply with ONLY the summary.",
  );
  if (text) insertDiary("daily", date, text);
}

async function generateWeekly(client: ChatClient, model: string): Promise<void> {
  const week = lastISOWeek();
  if (diaryExists("weekly", week)) return;

  const dates = datesInWeek(week);
  const dailies = getDiaries("daily", dates);
  if (dailies.length === 0) return;

  const text = await summarizeTexts(
    client,
    model,
    dailies,
    "Summarize these daily diary entries from one week into a concise weekly summary (2-4 sentences). Highlight recurring themes, progress, and mood. Reply with ONLY the summary.",
  );
  if (text) insertDiary("weekly", week, text);
}

async function generateMonthly(client: ChatClient, model: string): Promise<void> {
  const month = lastMonth();
  if (diaryExists("monthly", month)) return;

  const weeks = weeksInMonth(month);
  const weeklies = getDiaries("weekly", weeks);
  if (weeklies.length === 0) return;

  const text = await summarizeTexts(
    client,
    model,
    weeklies,
    "Summarize these weekly diary entries from one month into a concise monthly summary (3-4 sentences). Focus on major developments, evolving topics, and overall trajectory. Reply with ONLY the summary.",
  );
  if (text) insertDiary("monthly", month, text);
}

async function generateQuarterly(client: ChatClient, model: string): Promise<void> {
  const { key, months } = lastQuarter();
  if (diaryExists("quarterly", key)) return;

  const monthlies = getDiaries("monthly", months);
  if (monthlies.length < 3) return;

  const text = await summarizeTexts(
    client,
    model,
    monthlies,
    "Summarize these monthly diary entries from one quarter into a concise quarterly summary (3-5 sentences). Capture the arc of the quarter — themes, growth, and significant events. Reply with ONLY the summary.",
  );
  if (text) insertDiary("quarterly", key, text);
}

async function generateYearly(client: ChatClient, model: string): Promise<void> {
  const { key, quarters } = lastYear();
  if (diaryExists("yearly", key)) return;

  const quarterlies = getDiaries("quarterly", quarters);
  if (quarterlies.length < 4) return;

  const text = await summarizeTexts(
    client,
    model,
    quarterlies,
    "Summarize these quarterly diary entries from one year into a concise yearly summary (4-6 sentences). Paint a big-picture view of the year — major milestones, relationship evolution, and growth. Reply with ONLY the summary.",
  );
  if (text) insertDiary("yearly", key, text);
}

/** Run the full diary generation chain. Safe to fire-and-forget. */
export async function generateDiary(
  client: ChatClient,
  model: string,
): Promise<void> {
  try {
    await generateDaily(client, model);
    await generateWeekly(client, model);
    await generateMonthly(client, model);
    await generateQuarterly(client, model);
    await generateYearly(client, model);
  } catch {
    // Diary generation is best-effort — don't crash the app
  }
}

export function getRecentDiaries(type: DiaryType, limit: number): string[] {
  const db = getDb();
  const rows = db
    .select({ summary: diary.summary })
    .from(diary)
    .where(eq(diary.type, type))
    .orderBy(desc(diary.date))
    .limit(limit)
    .all();
  return rows.map((r) => r.summary);
}
