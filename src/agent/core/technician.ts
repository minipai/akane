import type { ToolActivity, ToolApprovalRequest, InfoEntry } from "../../types.js";
import { executeTool, autoApprovedTools, terminalTools } from "../tools/index.js";
import type { ToolContext } from "../tools/index.js";
import type { SearchClient } from "../../boot/search.js";

export type OnToolActivity = (activity: ToolActivity) => void;
export type OnToolApproval = (request: ToolApprovalRequest) => void;
export type OnEmotionChange = (emotion: string) => void;

/** Tools that run silently (no activity panel shown). */
const silentTools = new Set(["set_emotion", "describe_agent", "rest_session", "update_config", "think"]);


interface ToolResult {
  tool_call_id: string;
  content: string;
}

export class Technician {
  private onActivity?: OnToolActivity;
  private onApproval?: OnToolApproval;
  private onEmotionChange?: OnEmotionChange;
  private ctx: ToolContext;

  constructor(
    memory: ToolContext["memory"],
    cache: ToolContext["cache"],
    compress: ToolContext["compress"],
    addInfo: (info: InfoEntry) => void,
    onRest?: () => void,
    search: SearchClient | null = null,
    refreshPrompt?: () => void,
  ) {
    this.ctx = { memory, cache, compress, addInfo, onRest, search, refreshPrompt };
  }

  setOnActivity(cb: OnToolActivity): void {
    this.onActivity = cb;
  }

  setOnApproval(cb: OnToolApproval): void {
    this.onApproval = cb;
  }

  setOnEmotionChange(cb: OnEmotionChange): void {
    this.onEmotionChange = cb;
  }

  async run(
    toolCalls: Array<{ id: string; function: { name: string; arguments: string } }>,
  ): Promise<{ results: ToolResult[]; emotion?: string; terminal: boolean }> {
    const results: ToolResult[] = [];
    let emotion: string | undefined;
    let anyTerminal = false;

    for (const tc of toolCalls) {
      const isAutoApproved = autoApprovedTools.has(tc.function.name);

      if (terminalTools.has(tc.function.name)) anyTerminal = true;

      if (!isAutoApproved) {
        this.onActivity?.({
          name: tc.function.name,
          args: tc.function.arguments,
          result: null,
        });

        const approved = this.onApproval
          ? await new Promise<boolean>((resolve) => {
              this.onApproval!({ name: tc.function.name, args: tc.function.arguments, resolve });
            })
          : true;

        if (!approved) {
          const denial = "Tool execution denied by user.";
          this.onActivity?.({
            name: tc.function.name,
            args: tc.function.arguments,
            result: denial,
          });
          results.push({ tool_call_id: tc.id, content: denial });
          continue;
        }
      }

      const result = await executeTool(tc.function.name, tc.function.arguments, this.ctx);

      if (tc.function.name === "set_emotion") {
        try {
          const parsed = JSON.parse(tc.function.arguments);
          emotion = parsed.emotion;
          this.onEmotionChange?.(parsed.emotion);
        } catch {}
      } else if (!silentTools.has(tc.function.name)) {
        this.onActivity?.({
          name: tc.function.name,
          args: tc.function.arguments,
          result,
        });
      }

      results.push({ tool_call_id: tc.id, content: result });
    }

    return { results, emotion, terminal: anyTerminal };
  }
}
