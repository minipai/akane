import { getKv, setKv, getKvUpdatedAt } from "../db/kv.js";

export type TimePeriod = "morning" | "afternoon" | "evening" | "night";

export function getTimePeriod(hour: number): TimePeriod {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export function getTimeContext() {
  const now = new Date();
  const hour = now.getHours();
  const period = getTimePeriod(hour);
  const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;
  const timeString = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  const dateString = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return { period, dayOfWeek, isWeekend, timeString, dateString };
}

const WEATHER_KEY = "weather";
const ONE_HOUR_MS = 60 * 60 * 1000;

export function getCachedWeather(): string | null {
  const updatedAt = getKvUpdatedAt(WEATHER_KEY);
  if (!updatedAt) return null;
  const age = Date.now() - new Date(updatedAt).getTime();
  if (age > ONE_HOUR_MS) return null;
  return getKv(WEATHER_KEY);
}

export async function fetchAndCacheWeather(): Promise<void> {
  try {
    const res = await fetch("https://wttr.in/?format=3");
    if (!res.ok) return;
    const text = (await res.text()).trim();
    if (text) setKv(WEATHER_KEY, text);
  } catch {
    // Silent on failure
  }
}
