import { z } from "zod";
import { zodFunction } from "openai/helpers/zod";

export const EMOTIONS = [
  "neutral",
  "happy",
  "excited",
  "curious",
  "thinking",
  "surprised",
  "sad",
  "frustrated",
  "confused",
  "amused",
  "proud",
  "embarrassed",
  "anxious",
  "determined",
  "playful",
] as const;

export type Emotion = (typeof EMOTIONS)[number];

export const emotionToolDef = zodFunction({
  name: "set_emotion",
  description:
    "Express your current emotion. Call this whenever your emotional state changes during the conversation — for example when the user says something surprising, when you solve a hard problem, when something is funny, etc.",
  parameters: z.object({
    emotion: z.enum(EMOTIONS).describe("Your current emotion"),
  }),
});

export function executeEmotion(emotion: string): string {
  return `Emotion set to: ${emotion}`;
}
