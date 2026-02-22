export function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function getISOWeek(d: Date): { year: number; week: number } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return { year: date.getUTCFullYear(), week };
}

export function formatWeek(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function lastISOWeek(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  const { year, week } = getISOWeek(d);
  return formatWeek(year, week);
}

export function lastMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function lastQuarter(): { key: string; months: string[] } {
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

export function lastYear(): { key: string; quarters: string[] } {
  const year = new Date().getFullYear() - 1;
  return {
    key: String(year),
    quarters: [1, 2, 3, 4].map((q) => `${year}-Q${q}`),
  };
}

/** Get all daily date strings for a given ISO week (Mon-Sun) */
export function datesInWeek(weekStr: string): string[] {
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
export function weeksInMonth(monthStr: string): string[] {
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
