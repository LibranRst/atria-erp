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
  test("model introduction is separate from final answer visibility", (): void => {
    const intro = {
      type: "data-assistant-introduction",
      id: "assistant-introduction",
      data: { text: "Aku cek saldo terbarunya dulu." },
    };
    const state = readAssistantContentState(assistant([intro]));
    expect(state).toEqual({ hasVisibleText: false, hasTool: false, hasFailedTool: false });
    expect(shouldRevealAssistantContent(state, { isBusy: true, toolDelayElapsed: true })).toBe(
      false,
    );
    const pending = readAssistantContentState(assistant([intro, toolPart("input-available")]));
    expect(pending.hasVisibleText).toBe(false);
    expect(shouldRevealAssistantContent(pending, { isBusy: true, toolDelayElapsed: false })).toBe(
      false,
    );
    const result = readAssistantContentState(
      assistant([intro, { type: "text", state: "streaming", text: "Saldo tersedia Rp 125.000." }]),
    );
    expect(shouldRevealAssistantContent(result, { isBusy: true, toolDelayElapsed: false })).toBe(
      true,
    );
  });

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
