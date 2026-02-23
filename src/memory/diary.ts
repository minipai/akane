import type { Compressor } from "../types.js";
import { and, eq, gte, lt, desc, isNotNull } from "drizzle-orm";
import type { Db } from "../db/db.js";
import { diary, conversations } from "../db/schema.js";
import {
  yesterday,
  lastISOWeek,
  lastMonth,
  lastQuarter,
  lastYear,
  datesInWeek,
  weeksInMonth,
} from "../utils/date-helpers.js";

export type DiaryType = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

async function compressTexts(
  compress: Compressor,
  texts: string[],
  instruction: string,
): Promise<string> {
  return compress(instruction, texts.map((t) => `- ${t}`).join("\n"));
}

function diaryExists(db: Db, type: DiaryType, date: string): boolean {
  const row = db
    .select({ date: diary.date })
    .from(diary)
    .where(and(eq(diary.type, type), eq(diary.date, date)))
    .get();
  return !!row;
}

function insertDiary(db: Db, type: DiaryType, date: string, summary: string): void {
  db.insert(diary)
    .values({ type, date, summary, createdAt: new Date().toISOString() })
    .run();
}

function getDiaries(db: Db, type: DiaryType, dates: string[]): string[] {
  if (dates.length === 0) return [];
  const rows = db
    .select({ date: diary.date, summary: diary.summary })
    .from(diary)
    .where(and(eq(diary.type, type)))
    .orderBy(diary.date)
    .all();
  const dateSet = new Set(dates);
  return rows.filter((r) => dateSet.has(r.date)).map((r) => r.summary);
}

// --- Generation per level ---

async function generateDaily(db: Db, compress: Compressor): Promise<void> {
  const date = yesterday();

  if (diaryExists(db, "daily", date)) return;

  const nextDay = new Date(date + "T00:00:00Z");
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const nextDayStr = nextDay.toISOString().slice(0, 10);

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

  const text = await compressTexts(
    compress,
    summaries,
    "Summarize these conversation summaries from a single day into a concise diary entry (2-3 sentences). Capture the key topics, decisions, and emotional tone. Reply with ONLY the summary.",
  );
  if (text) insertDiary(db, "daily", date, text);
}

async function generateWeekly(db: Db, compress: Compressor): Promise<void> {
  const week = lastISOWeek();
  if (diaryExists(db, "weekly", week)) return;

  const dates = datesInWeek(week);
  const dailies = getDiaries(db, "daily", dates);
  if (dailies.length === 0) return;

  const text = await compressTexts(
    compress,
    dailies,
    "Summarize these daily diary entries from one week into a concise weekly summary (2-4 sentences). Highlight recurring themes, progress, and mood. Reply with ONLY the summary.",
  );
  if (text) insertDiary(db, "weekly", week, text);
}

async function generateMonthly(db: Db, compress: Compressor): Promise<void> {
  const month = lastMonth();
  if (diaryExists(db, "monthly", month)) return;

  const weeks = weeksInMonth(month);
  const weeklies = getDiaries(db, "weekly", weeks);
  if (weeklies.length === 0) return;

  const text = await compressTexts(
    compress,
    weeklies,
    "Summarize these weekly diary entries from one month into a concise monthly summary (3-4 sentences). Focus on major developments, evolving topics, and overall trajectory. Reply with ONLY the summary.",
  );
  if (text) insertDiary(db, "monthly", month, text);
}

async function generateQuarterly(db: Db, compress: Compressor): Promise<void> {
  const { key, months } = lastQuarter();
  if (diaryExists(db, "quarterly", key)) return;

  const monthlies = getDiaries(db, "monthly", months);
  if (monthlies.length < 3) return;

  const text = await compressTexts(
    compress,
    monthlies,
    "Summarize these monthly diary entries from one quarter into a concise quarterly summary (3-5 sentences). Capture the arc of the quarter — themes, growth, and significant events. Reply with ONLY the summary.",
  );
  if (text) insertDiary(db, "quarterly", key, text);
}

async function generateYearly(db: Db, compress: Compressor): Promise<void> {
  const { key, quarters } = lastYear();
  if (diaryExists(db, "yearly", key)) return;

  const quarterlies = getDiaries(db, "quarterly", quarters);
  if (quarterlies.length < 4) return;

  const text = await compressTexts(
    compress,
    quarterlies,
    "Summarize these quarterly diary entries from one year into a concise yearly summary (4-6 sentences). Paint a big-picture view of the year — major milestones, relationship evolution, and growth. Reply with ONLY the summary.",
  );
  if (text) insertDiary(db, "yearly", key, text);
}

/** Run the full diary generation chain. Safe to fire-and-forget. */
export async function generateDiary(
  db: Db,
  compress: Compressor,
): Promise<void> {
  await generateDaily(db, compress);
  await generateWeekly(db, compress);
  await generateMonthly(db, compress);
  await generateQuarterly(db, compress);
  await generateYearly(db, compress);
}
