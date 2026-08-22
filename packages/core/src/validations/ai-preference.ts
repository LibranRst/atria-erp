import { z } from "zod";

export const aiResponseStyleSchema = z.enum(["STANDARD", "VERY_CONCISE", "DETAILED"]);
export const aiPrimaryFocusSchema = z.enum([
  "AUTO",
  "BUDGET_MARGIN",
  "CASH_BILLS",
  "MATERIAL_STOCK",
  "ACTIONS_APPROVALS",
]);

export const aiPreferenceInputSchema = z.object({
  responseStyle: aiResponseStyleSchema,
  primaryFocus: aiPrimaryFocusSchema,
  customNote: z
    .string()
    .trim()
    .max(300, "Catatan preferensi maksimal 300 karakter.")
    .nullish()
    .transform((value) => value || null),
});

export type AiResponseStyle = z.infer<typeof aiResponseStyleSchema>;
export type AiPrimaryFocus = z.infer<typeof aiPrimaryFocusSchema>;
export type AiPreferenceInput = z.infer<typeof aiPreferenceInputSchema>;

export const DEFAULT_AI_PREFERENCE: AiPreferenceInput = {
  responseStyle: "STANDARD",
  primaryFocus: "AUTO",
  customNote: null,
};
