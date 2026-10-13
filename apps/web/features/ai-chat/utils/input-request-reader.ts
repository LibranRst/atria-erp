import type { UIMessage } from "ai";
import { requestUserInputSchema, type RequestUserInputPayload } from "@atria/core/ai/input-request";
import { normalizeInputRequestPayload } from "@atria/core/ai/input-request-flow";

export type ActiveInputRequest = {
  readonly toolCallId: string;
  readonly payload: RequestUserInputPayload;
  /** Current local wizard values, attached only by the presentation owner. */
  readonly values?: Readonly<Record<string, string>>;
};

/**
 * Retain the latest unanswered request through unrelated chat replies.
 * Persisted formatted replies/cancellation keep completed wizards closed on reload.
 */
export function readActiveInputRequest(
  messages: readonly UIMessage[],
  dismissedToolCallIds: ReadonlySet<string>,
): ActiveInputRequest | null {
  if (messages.length === 0) return null;

  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.role !== "assistant") continue;
    for (const part of [...message.parts].reverse()) {
      if (part.type === "tool-requestUserInput") {
        const toolPart = part as unknown as {
          toolCallId?: string;
          args?: unknown;
          input?: unknown;
          output?: unknown;
        };

        const toolCallId = toolPart.toolCallId ?? message.id + ":input";
        if (dismissedToolCallIds.has(toolCallId)) {
          return null;
        }

        const parsed = requestUserInputSchema.safeParse(
          toolPart.output ?? toolPart.input ?? toolPart.args,
        );
        if (parsed.success) {
          const title = parsed.data.actionTitle;
          const completed = messages
            .slice(index + 1)
            .some(
              (later) =>
                later.role === "user" &&
                later.parts.some(
                  (item) =>
                    item.type === "text" &&
                    (item.text.startsWith("Berikut data untuk " + title + ":") ||
                      item.text.startsWith("Saya batalkan pengisian data untuk " + title + ".")),
                ),
            );
          return completed
            ? null
            : { toolCallId, payload: normalizeInputRequestPayload(parsed.data) };
        }
      }
    }
  }

  return null;
}
