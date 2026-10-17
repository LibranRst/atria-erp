import type { UIMessage } from "ai";
import { z } from "zod";
import { cardNarrativeSchema } from "@atria/core/ai/answer-presentation";
import {
  getBankBalancesOutputSchema,
  getProjectBudgetOutputSchema,
} from "@atria/core/ai/tool-output";

export type RenderedReadCard = {
  readonly toolName: string;
  readonly toolCallId: string;
};
type Narrative = z.infer<typeof cardNarrativeSchema>;
const usableNarrativeSchema = cardNarrativeSchema.refine(
  (narrative): boolean =>
    narrative.fullText.trim().length > 0 && narrative.cardText.trim().length > 0,
);

const groundedNarrativesSchema = z.object({
  status: z.enum(["verified", "partial"]),
  sources: z
    .array(
      z.object({
        toolName: z.string().min(1),
        toolCallId: z.string().min(1),
        entityIds: z.array(z.string()),
        query: z.record(z.string(), z.unknown()),
      }),
    )
    .min(1),
  cardNarratives: z.array(usableNarrativeSchema),
});

function hasUsableReadCard(message: UIMessage, narrative: Narrative): boolean {
  const parts = message.parts.filter(
    (part): boolean =>
      part.type === `tool-${narrative.toolName}` &&
      "toolCallId" in part &&
      part.toolCallId === narrative.toolCallId,
  );
  if (parts.length !== 1) return false;
  const part = parts[0];
  if (!("state" in part) || part.state !== "output-available" || !("output" in part)) return false;
  const output: unknown = part.output;
  if (typeof output === "object" && output !== null && "error" in output) return false;
  if (narrative.toolName === "getBankBalances") {
    const parsed = getBankBalancesOutputSchema.safeParse(output);
    return parsed.success && parsed.data.accounts.length > 0;
  }
  const parsed = getProjectBudgetOutputSchema.safeParse(output);
  return parsed.success && parsed.data.categories.length > 0;
}

function anchoredSection(
  text: string,
  fullText: string,
): { readonly start: number; readonly end: number } | null {
  const start = text.indexOf(fullText);
  if (start < 0 || text.indexOf(fullText, start + 1) >= 0) return null;
  const end = start + fullText.length;
  const startsSection = start === 0 || text.slice(start - 2, start) === "\n\n";
  const endsSection = end === text.length || text.slice(end, end + 2) === "\n\n";
  return startsSection && endsSection ? { start, end } : null;
}

/**
 * Replace only a server-authored exact section whose verified source is represented
 * by a card actually displayed for this same message. Canonical stored text remains
 * the complete fallback for streaming, hidden cards, legacy or invalid metadata.
 */
export function projectCardAwareAnswerText(
  message: UIMessage,
  text: string,
  renderedCards: readonly RenderedReadCard[],
): string {
  if (message.role !== "assistant" || renderedCards.length === 0) return text;
  const latest = message.parts.findLast((part): boolean => part.type === "data-grounded-facts");
  if (!latest || !("data" in latest)) return text;
  const parsed = groundedNarrativesSchema.safeParse(latest.data);
  if (!parsed.success) return text;

  const replacements = parsed.data.cardNarratives
    .flatMap((narrative) => {
      const selected = renderedCards.some(
        (card): boolean =>
          card.toolName === narrative.toolName && card.toolCallId === narrative.toolCallId,
      );
      const sourced = parsed.data.sources.some(
        (source): boolean =>
          source.toolName === narrative.toolName && source.toolCallId === narrative.toolCallId,
      );
      if (!selected || !sourced || !hasUsableReadCard(message, narrative)) return [];
      const anchor = anchoredSection(text, narrative.fullText);
      return anchor ? [{ ...anchor, cardText: narrative.cardText }] : [];
    })
    .sort((left, right) => left.start - right.start);

  // Ambiguous metadata must not delete arbitrary answer content.
  if (
    replacements.some(
      (replacement, index): boolean => index > 0 && replacement.start < replacements[index - 1].end,
    )
  )
    return text;

  let projected = text;
  for (let index = replacements.length - 1; index >= 0; index--) {
    const replacement = replacements[index];
    projected =
      projected.slice(0, replacement.start) +
      replacement.cardText +
      projected.slice(replacement.end);
  }
  return projected;
}
