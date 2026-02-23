export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

export interface SearchResponse {
  answer?: string;
  results: SearchResult[];
}

/** A function that takes a query and returns search results. */
export type SearchClient = (query: string) => Promise<SearchResponse>;

/** Create a SearchClient backed by the Tavily REST API. */
export function createSearchClient(apiKey: string): SearchClient {
  return async (query) => {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query, max_results: 5, include_answer: true }),
    });

    if (!res.ok) {
      throw new Error(`Tavily API error (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    return { answer: data.answer, results: data.results ?? [] };
  };
}
