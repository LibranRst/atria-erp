import { z } from "zod";

/**
 * Optional presentation alternatives for an executed, validated factual section.
 * The complete text remains canonical. A client may use cardText only when the
 * corresponding card is actually shown; unsupported/old clients keep fullText.
 */
export const cardNarrativeSchema = z.object({
  toolName: z.enum(["getBankBalances", "getProjectBudget"]),
  toolCallId: z.string().min(1),
  fullText: z.string().min(1),
  cardText: z.string().min(1),
});

export type CardNarrative = Readonly<z.infer<typeof cardNarrativeSchema>>;
