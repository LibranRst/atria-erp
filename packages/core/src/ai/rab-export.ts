import { z } from "zod";

export const rabExportFormatSchema = z.enum(["PDF", "EXCEL", "PNG"]);
export type RabExportFormat = z.infer<typeof rabExportFormatSchema>;
const decimal = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/)
  .max(20);
const printableLine = z.object({
  id: z.string().guid(),
  clientLabel: z.string().max(500),
  description: z.string().max(10000).nullable(),
  quantity: decimal,
  unit: z.string().max(50),
  unitPrice: decimal,
  lineTotal: decimal,
  isHidden: z.boolean(),
  displayOrder: z.number().int(),
});
export const rabPrintableSchema = z.object({
  id: z.string().guid(),
  status: z.string(),
  revision: z.number().int().positive(),
  title: z.string().max(500),
  clientNotes: z.string().max(20000).nullable(),
  approvedValue: decimal,
  items: z
    .array(
      printableLine.extend({
        itemNature: z.string().nullable().optional(),
        bundleId: z.string().guid().nullable(),
      }),
    )
    .max(1000),
  bundles: z.array(printableLine).max(1000),
});
export type RabPrintableEstimate = z.infer<typeof rabPrintableSchema>;
export const rabExportMetaSchema = z.object({
  projectName: z.string(),
  projectNumber: z.string().optional(),
  projectAddress: z.string().optional(),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  clientAddress: z.string().optional(),
  companyName: z.string(),
  date: z.string(),
});
export const rabExportInputSchema = z
  .object({
    projectId: z.string().guid(),
    rabEstimateId: z.string().guid(),
    format: rabExportFormatSchema.default("PDF"),
  })
  .strict();
export type RabExportInput = z.infer<typeof rabExportInputSchema>;
export const rabExportProposalSchema = z.object({
  kind: z.literal("RAB_EXPORT"),
  input: rabExportInputSchema,
  expectedContext: z.string().regex(/^[a-f0-9]{64}$/),
  projectName: z.string(),
  clientName: z.string(),
  title: z.string(),
  revision: z.number().int().positive(),
  status: z.enum(["DRAFT", "APPROVED"]),
  total: decimal,
  rowCount: z.number().int().positive(),
  issuedAt: z.string().datetime(),
});
export type RabExportProposal = z.infer<typeof rabExportProposalSchema>;
export const rabExportIdentitySchema = z
  .object({ conversationId: z.string().guid(), toolCallId: z.string().min(1).max(200) })
  .strict();
export type RabExportView = {
  readonly proposal: RabExportProposal;
  readonly status: "READY" | "STALE" | "EXPIRED";
  readonly document: {
    readonly estimate: RabPrintableEstimate;
    readonly meta: z.infer<typeof rabExportMetaSchema>;
  } | null;
};

/** Includes bundle prices once; their component prices are never added again. */
export function rabExportTotal(estimate: RabPrintableEstimate): string {
  const amounts = [
    ...estimate.bundles.filter((b) => !b.isHidden).map((b) => b.lineTotal),
    ...estimate.items.filter((i) => !i.isHidden && !i.bundleId).map((i) => i.lineTotal),
  ];
  const cents = amounts.reduce((sum, value) => {
    const [whole, fraction = ""] = value.split(".");
    return sum + BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  }, 0n);
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}

/** Continuous A4 slices; avoid splitting a normal-sized row/text block. */
export function rabPageSlices(
  height: number,
  pageHeight: number,
  blocks: readonly { top: number; bottom: number }[],
): readonly { top: number; height: number }[] {
  if (!Number.isFinite(height) || !Number.isFinite(pageHeight) || height <= 0 || pageHeight <= 0)
    throw new Error("Ukuran dokumen tidak valid.");
  const pages: { top: number; height: number }[] = [];
  let top = 0;
  while (top < height) {
    let end = Math.min(height, top + pageHeight);
    const crossing = blocks.filter(
      (b) => b.top > top && b.top < end && b.bottom > end && b.bottom - b.top <= pageHeight,
    );
    if (crossing.length) end = Math.min(...crossing.map((b) => b.top));
    if (end <= top) throw new Error("Dokumen tidak dapat dibagi.");
    pages.push({ top, height: end - top });
    top = end;
    if (pages.length > 150) throw new Error("Dokumen terlalu panjang. Gunakan Excel.");
  }
  return pages;
}
