import type { UIMessage } from "ai";
import { z } from "zod";

const introductionSchema = z.object({ text: z.string().trim().min(1) });

export type AssistantIntroduction = {
  readonly key: string;
  readonly text: string;
};

/**
 * Model commentary belongs to the same assistant turn but is not its answer.
 * A data part keeps stop/retry, factual verification and final text independent.
 */
export function readAssistantIntroduction(message: UIMessage | null): AssistantIntroduction | null {
  if (!message || message.role !== "assistant") return null;

  for (let index = message.parts.length - 1; index >= 0; index--) {
    const part = message.parts[index];
    if (part.type !== "data-assistant-introduction" || !("data" in part)) continue;
    const parsed = introductionSchema.safeParse(part.data);
    if (!parsed.success) continue;
    const id = "id" in part && typeof part.id === "string" ? part.id : index;
    return { key: `${message.id}-introduction-${id}`, text: parsed.data.text };
  }

  return null;
}
