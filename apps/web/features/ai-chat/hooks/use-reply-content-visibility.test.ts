import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";

import {
  readAssistantContentState,
  shouldRevealAssistantContent,
  TOOL_TRACE_HANDOFF_DELAY_MS,
} from "./use-reply-content-visibility";

function assistant(parts: unknown[]): UIMessage {
  return { id: "assistant-1", role: "assistant", parts } as unknown as UIMessage;
}

const toolPart = (state: string) => ({
  type: "tool-getBankBalances" as const,
  toolCallId: "call-1",
  state,
});

describe("reply content handoff", () => {
  test("menahan tool trace aktif sampai ambang 400ms", () => {
    const state = readAssistantContentState(assistant([toolPart("input-available")]));

    expect(TOOL_TRACE_HANDOFF_DELAY_MS).toBe(400);
    expect(
      shouldRevealAssistantContent(state, {
        isBusy: true,
        toolDelayElapsed: false,
      }),
    ).toBe(false);
    expect(
      shouldRevealAssistantContent(state, {
        isBusy: true,
        toolDelayElapsed: true,
      }),
    ).toBe(true);
  });

  test("tidak pernah menahan teks bermakna", () => {
    const state = readAssistantContentState(
      assistant([{ type: "text", state: "streaming", text: "Total kas" }]),
    );

    expect(
      shouldRevealAssistantContent(state, {
        isBusy: true,
        toolDelayElapsed: false,
      }),
    ).toBe(true);
  });

  test("tidak pernah menahan failure", () => {
    const state = readAssistantContentState(assistant([toolPart("output-error")]));

    expect(state.hasFailedTool).toBe(true);
    expect(
      shouldRevealAssistantContent(state, {
        isBusy: true,
        toolDelayElapsed: false,
      }),
    ).toBe(true);
  });

  test("mengabaikan whitespace dan membuka trace ketika reply berhenti", () => {
    const whitespace = readAssistantContentState(
      assistant([{ type: "text", state: "streaming", text: "\n  " }]),
    );
    const interruptedTool = readAssistantContentState(assistant([toolPart("input-available")]));

    expect(whitespace.hasVisibleText).toBe(false);
    expect(
      shouldRevealAssistantContent(whitespace, {
        isBusy: true,
        toolDelayElapsed: true,
      }),
    ).toBe(false);
    expect(
      shouldRevealAssistantContent(interruptedTool, {
        isBusy: false,
        toolDelayElapsed: false,
      }),
    ).toBe(true);
  });
});
