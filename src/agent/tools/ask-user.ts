import { z } from "zod";
import { zodFunction } from "openai/helpers/zod";

export const askUserSchema = z.object({
  question: z.string().describe("The question to ask the user"),
  options: z
    .array(
      z.object({
        label: z.string().describe("Short option label"),
        detail: z.string().nullable().describe("Optional extra detail"),
      }),
    )
    .describe("Selection options to present"),
  allowCustom: z
    .boolean()
    .describe("Whether to allow the user to type a custom answer (usually true)"),
});

export const askUserToolDef = zodFunction({
  name: "ask_user",
  description:
    "Present a selection menu to the user and wait for their choice. Use this when you want the user to pick from a set of options (e.g. choosing a restaurant, picking a category, selecting a preference).",
  parameters: askUserSchema,
});
