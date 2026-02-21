import type { ChatCompletionTool } from "openai/resources/chat/completions";
import type OpenAI from "openai";
import {
  CATEGORIES,
  insertFact,
  getFactsByCategory,
  getCategoryForFact,
  updateFact,
  deleteFact,
  regenerateProfile,
  generateNextQuestion,
} from "../memory/user-facts.js";
import type { Category } from "../memory/user-facts.js";

export const noteAboutUserToolDef: ChatCompletionTool = {
  type: "function",
  function: {
    name: "note_about_user",
    description:
      "Remember a fact about the user. Call this when the user mentions personal details, preferences, or stable traits worth remembering long-term.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: [...CATEGORIES],
          description:
            "identity (demographics), relations (family/pets), career (job/skills), preferences (hobbies/food), mindset (personality/beliefs), timeline (milestones/plans)",
        },
        fact: {
          type: "string",
          description: "The fact to remember, written as a concise statement",
        },
      },
      required: ["category", "fact"],
    },
  },
};

export const getUserFactsToolDef: ChatCompletionTool = {
  type: "function",
  function: {
    name: "get_user_facts",
    description:
      "Retrieve all remembered facts about the user for a given category. Use when you need detailed recall about a topic.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: [...CATEGORIES],
          description: "The category to retrieve facts for",
        },
      },
      required: ["category"],
    },
  },
};

export const updateUserFactToolDef: ChatCompletionTool = {
  type: "function",
  function: {
    name: "update_user_fact",
    description:
      "Update or delete an existing fact about the user. Use when the user corrects something or when a fact is outdated.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "The ID of the fact to update or delete",
        },
        fact: {
          type: "string",
          description: "The updated fact text (omit if deleting)",
        },
        delete: {
          type: "boolean",
          description: "Set to true to delete the fact",
        },
      },
      required: ["id"],
    },
  },
};

// Store client/model reference for regenerateProfile calls
let _client: OpenAI | null = null;
let _model: string = "";

export function setUserFactsContext(client: OpenAI, model: string): void {
  _client = client;
  _model = model;
}

export async function executeNoteAboutUser(
  category: Category,
  fact: string,
): Promise<string> {
  const id = insertFact(category, fact);
  if (_client) {
    await regenerateProfile(_client, _model, category);
    generateNextQuestion(_client, _model).catch(() => {});
  }
  return `Noted (id=${id}): ${fact}`;
}

export async function executeGetUserFacts(
  category: Category,
): Promise<string> {
  const facts = getFactsByCategory(category);
  if (facts.length === 0) return `No facts recorded for "${category}".`;
  return facts.map((f) => `[${f.id}] ${f.fact}`).join("\n");
}

export async function executeUpdateUserFact(
  id: number,
  fact?: string,
  del?: boolean,
): Promise<string> {
  const category = getCategoryForFact(id);
  if (!category) return `Fact #${id} not found.`;

  if (del) {
    deleteFact(id);
    if (_client) {
      await regenerateProfile(_client, _model, category);
      generateNextQuestion(_client, _model).catch(() => {});
    }
    return `Deleted fact #${id}.`;
  }

  if (fact) {
    updateFact(id, fact);
    if (_client) {
      await regenerateProfile(_client, _model, category);
      generateNextQuestion(_client, _model).catch(() => {});
    }
    return `Updated fact #${id}: ${fact}`;
  }

  return "No changes — provide either 'fact' or 'delete: true'.";
}
