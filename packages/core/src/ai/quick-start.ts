import { z } from "zod";
import { invoiceMoneySchema } from "./procurement-warehouse";
export const QUICK_START_KIND = "QUICK_START";
const step = z.enum(["welcome", "financial_defaults", "first_project", "success"]);
export const quickStartProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    clientId: z.string().guid().optional(),
    newClientName: z.string().trim().min(1).max(150).optional(),
    newClientEmail: z.email().max(254).optional(),
    newClientPhone: z.string().trim().max(50).optional(),
    newClientAddress: z.string().trim().max(500).optional(),
    projectManagerId: z.string().guid().nullable().default(null),
    totalContractValue: invoiceMoneySchema,
    approvedRabValue: invoiceMoneySchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Boolean(value.clientId) === Boolean(value.newClientName))
      ctx.addIssue({
        code: "custom",
        message: "Pilih satu klien tersimpan atau satu klien baru.",
        path: ["clientId"],
      });
    if (
      value.clientId &&
      [value.newClientEmail, value.newClientPhone, value.newClientAddress].some(
        (v) => v !== undefined,
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Keterangan klien baru tidak berlaku pada klien tersimpan.",
        path: ["clientId"],
      });
  });
export const quickStartInputSchema = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("ADVANCE"), stepId: z.enum(["welcome", "financial_defaults"]) })
    .strict(),
  z
    .object({
      action: z.literal("PAUSE"),
      stepId: z.enum(["welcome", "financial_defaults", "first_project"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("RESUME"),
      stepId: z.enum(["welcome", "financial_defaults", "first_project"]),
    })
    .strict(),
  z.object({ action: z.literal("RETRY"), stepId: step }).strict(),
  z
    .object({
      action: z.literal("STOCK_DECISION"),
      decision: z.enum(["NO_LEGACY_STOCK", "HAS_LEGACY_STOCK", "SKIPPED"]),
    })
    .strict(),
  z.object({ action: z.literal("CREATE_PROJECT"), project: quickStartProjectSchema }).strict(),
]);
const fact = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number()]),
  money: z.boolean().optional(),
});
export const quickStartProposalSchema = z
  .object({
    kind: z.literal(QUICK_START_KIND),
    input: quickStartInputSchema,
    title: z.string(),
    changed: z.boolean(),
    contextHash: z.string().length(64),
    comparisons: z.array(z.object({ label: z.string(), before: z.string(), after: z.string() })),
    facts: z.array(fact),
    categories: z.array(
      z.object({ id: z.string().guid(), name: z.string(), ratio: z.number(), amount: z.number() }),
    ),
    effect: z.string(),
  })
  .strict();
export const quickStartIdentitySchema = z
  .object({ conversationId: z.string().guid(), toolCallId: z.string().min(1).max(200) })
  .strict();
export type QuickStartInput = z.infer<typeof quickStartInputSchema>;
export type QuickStartProposal = z.infer<typeof quickStartProposalSchema>;
export type QuickStartView = {
  readonly proposal: QuickStartProposal;
  readonly status: "READY" | "NO_CHANGE" | "STALE" | "EXPIRED" | "CONFIRMED";
  readonly resultId: string | null;
  readonly destination: string;
  readonly blockedReason: string | null;
};
export const quickStartLabels = {
  step: {
    welcome: "Mulai setup",
    financial_defaults: "Default finansial",
    first_project: "Proyek pertama",
    success: "Selesai",
  },
  status: { IN_PROGRESS: "Berjalan", PAUSED: "Ditunda", COMPLETED: "Selesai" },
  decision: {
    UNDECIDED: "Belum dipilih",
    NO_LEGACY_STOCK: "Tidak ada stok lama",
    HAS_LEGACY_STOCK: "Ada stok lama",
    SKIPPED: "Lengkapi nanti",
  },
} as const;
