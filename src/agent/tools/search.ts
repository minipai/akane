import { z } from "zod";
import { zodFunction } from "openai/helpers/zod";
import type { SearchClient } from "../../boot/search.js";

export const searchToolDef = zodFunction({
  name: "web_search",
  description:
    "Search the web for current information. Use this when the user asks about recent events, facts you're unsure about, or anything that benefits from up-to-date information.",
  parameters: z.object({
    query: z.string().describe("The search query"),
  }),
});

export async function executeSearch(query: string, search: SearchClient | null): Promise<string> {
  if (!search) {
    return "Web search not configured — set TAVILY_API_KEY in .env";
  }

  try {
    const data = await search(query);

    let output = "";
    if (data.answer) {
      output += `Answer: ${data.answer}\n\n`;
    }
    if (data.results.length) {
      output += "Sources:\n";
      for (const [i, r] of data.results.entries()) {
        output += `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content}\n\n`;
      }
    }

    return output.trim() || "(no results)";
  } catch (err) {
    return `Search error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
