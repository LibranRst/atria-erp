import type { UIMessage } from "ai";

/** Publish the SDK's complete reply without replacing another conversation. */
export function finishChatReply(current: UIMessage[], completed: UIMessage): UIMessage[] {
  const last = current.at(-1);
  if (completed.role !== "assistant" || last?.role !== "assistant" || last.id !== completed.id)
    return current;
  return [
    ...current.slice(0, -1),
    { ...completed, parts: completed.parts.map((part) => ({ ...part })) },
  ];
}
