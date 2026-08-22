import type { UIMessage } from "ai";
import type { RequestUserInputPayload } from "@/lib/ai/tools/input-request-tools";

export type ActiveInputRequest = {
  readonly toolCallId: string;
  readonly payload: RequestUserInputPayload;
};

/**
 * Memeriksa apakah pesan asisten terakhir meminta input dari pengguna
 * lewat pemanggilan tool `requestUserInput`.
 */
export function readActiveInputRequest(
  messages: readonly UIMessage[],
  dismissedToolCallIds: ReadonlySet<string>,
): ActiveInputRequest | null {
  if (messages.length === 0) return null;

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== "assistant") return null;

  for (const part of lastMessage.parts) {
    if (part.type === "tool-requestUserInput") {
      const toolPart = part as unknown as {
        toolCallId?: string;
        args?: unknown;
        output?: unknown;
      };

      const toolCallId = toolPart.toolCallId ?? "req-input-default";
      if (dismissedToolCallIds.has(toolCallId)) {
        continue;
      }

      // Read payload from output or args
      const data = (toolPart.output ?? toolPart.args) as RequestUserInputPayload | undefined;
      if (data && typeof data === "object" && "fields" in data && Array.isArray(data.fields)) {
        return {
          toolCallId,
          payload: data,
        };
      }
    }
  }

  return null;
}
