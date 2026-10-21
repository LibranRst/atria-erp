import { randomUUID } from "node:crypto";

export type ChatTimingStage =
  | "authorized"
  | "history"
  | "attachments"
  | "document-complete-clear"
  | "document-needs-review"
  | "messages"
  | "user-persisted"
  | "context"
  | "first-introduction"
  | "first-answer"
  | "assistant-persisted";

export interface ChatTimingRecord {
  readonly requestId: string;
  readonly outcome: "complete" | "error" | "aborted";
  readonly totalMs: number;
  readonly stages: Readonly<Partial<Record<ChatTimingStage, number>>>;
  readonly modelCalls: readonly {
    readonly model: string;
    readonly durationMs: number;
    readonly firstOutputMs?: number;
    readonly inputTokens?: number;
    readonly outputTokens?: number;
  }[];
  readonly toolCalls: readonly { readonly tool: string; readonly durationMs: number }[];
}

/** Timings contain no prompts, file URLs, inputs, outputs, actor or conversation IDs. */
export class ChatTiming {
  private readonly startedAt: number;
  private readonly stages: Partial<Record<ChatTimingStage, number>> = {};
  private readonly models: ChatTimingRecord["modelCalls"][number][] = [];
  private readonly tools: ChatTimingRecord["toolCalls"][number][] = [];
  private finished = false;

  constructor(
    private readonly sink: (record: ChatTimingRecord) => void,
    private readonly clock: () => number = (): number => performance.now(),
    private readonly requestId: string = randomUUID(),
  ) {
    this.startedAt = clock();
  }

  mark(stage: ChatTimingStage): void {
    if (!this.finished && this.stages[stage] === undefined)
      this.stages[stage] = Math.round(this.clock() - this.startedAt);
  }

  model(sample: ChatTimingRecord["modelCalls"][number]): void {
    if (!this.finished && this.models.length < 32) this.models.push(sample);
  }

  tool(tool: string, durationMs: number): void {
    if (!this.finished && this.tools.length < 128)
      this.tools.push({ tool, durationMs: Math.round(durationMs) });
  }

  finish(outcome: ChatTimingRecord["outcome"]): void {
    if (this.finished) return;
    this.finished = true;
    try {
      this.sink({
        requestId: this.requestId,
        outcome,
        totalMs: Math.round(this.clock() - this.startedAt),
        stages: { ...this.stages },
        modelCalls: [...this.models],
        toolCalls: [...this.tools],
      });
    } catch {
      // Diagnostics cannot break, delay or retry a business request.
    }
  }
}

export function createChatTiming(signal: AbortSignal): ChatTiming | undefined {
  const configured = process.env.ATRIA_AI_TIMING_LOG;
  if (
    configured === "0" ||
    (configured !== "1" && ["production", "test"].includes(process.env.NODE_ENV ?? ""))
  )
    return undefined;
  const timing = new ChatTiming((record: ChatTimingRecord): void => {
    console.info("[ai-timing]", JSON.stringify(record));
  });
  signal.addEventListener("abort", (): void => timing.finish("aborted"), { once: true });
  return timing;
}
