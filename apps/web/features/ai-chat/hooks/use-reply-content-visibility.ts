"use client";

import type { UIMessage } from "ai";
import * as React from "react";

import { toolNameFromPartType } from "../utils/tool-labels";

/** Memberi fase fetching waktu terbaca sebelum tool trace mengambil alih slot. */
export const TOOL_TRACE_HANDOFF_DELAY_MS = 400;

export type AssistantContentState = {
  readonly hasVisibleText: boolean;
  readonly hasTool: boolean;
  readonly hasFailedTool: boolean;
};

function partState(part: unknown): string | undefined {
  if (typeof part !== "object" || part === null) return undefined;
  const state = (part as { state?: unknown }).state;
  return typeof state === "string" ? state : undefined;
}

export function readAssistantContentState(message: UIMessage | null): AssistantContentState {
  if (!message) {
    return { hasVisibleText: false, hasTool: false, hasFailedTool: false };
  }

  let hasVisibleText = false;
  let hasTool = false;
  let hasFailedTool = false;

  message.parts.forEach((part) => {
    if (part.type === "text" && part.text.trim().length > 0) {
      hasVisibleText = true;
    }

    if (!toolNameFromPartType(part.type)) return;
    hasTool = true;
    if (partState(part) === "output-error") hasFailedTool = true;
  });

  return { hasVisibleText, hasTool, hasFailedTool };
}

/** Policy murni agar aturan handoff dapat diuji tanpa timer atau DOM. */
export function shouldRevealAssistantContent(
  state: AssistantContentState,
  options: {
    readonly isBusy: boolean;
    readonly toolDelayElapsed: boolean;
  },
): boolean {
  if (state.hasVisibleText || state.hasFailedTool) return true;
  if (!state.hasTool) return false;
  return !options.isBusy || options.toolDelayElapsed;
}

/**
 * Menahan tool trace sukses/running paling lama 400ms. Teks dan failure selalu
 * menembus penahanan itu supaya UI tidak pernah memperlambat informasi nyata.
 */
export function useReplyContentVisibility(
  message: UIMessage | null,
  isBusy: boolean,
  replyCycle: number,
): boolean {
  const state = React.useMemo(() => readAssistantContentState(message), [message]);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [elapsedCycle, setElapsedCycle] = React.useState<number | null>(null);

  const clearTimer = React.useCallback((): void => {
    if (timerRef.current === null) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const immediate = state.hasVisibleText || state.hasFailedTool || !isBusy;

  React.useEffect(() => {
    clearTimer();
    if (!isBusy || !state.hasTool || immediate || elapsedCycle === replyCycle) {
      return undefined;
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setElapsedCycle(replyCycle);
    }, TOOL_TRACE_HANDOFF_DELAY_MS);

    return clearTimer;
  }, [clearTimer, elapsedCycle, immediate, isBusy, replyCycle, state.hasTool]);

  React.useEffect(() => clearTimer, [clearTimer]);

  return shouldRevealAssistantContent(state, {
    isBusy,
    toolDelayElapsed: elapsedCycle === replyCycle,
  });
}
