import { z } from "zod";
import type { PermissionKey } from "../auth/permissions";
import { fromCents, parseNumericToCents } from "../finance/money-minor";
import { reservedAfterOwnRelease } from "../material/stock-guards";
const decimal = z
  .number()
  .finite()
  .min(0)
  .max(9999999999.99)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.0001,
    "Gunakan maksimal dua angka desimal.",
  );
const stockPrice = z
  .number()
  .finite()
  .min(0)
  .max(9999999999999.99)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.0001,
    "Gunakan maksimal dua angka desimal.",
  );
export const projectStockActionSchema = z.enum([
  "RESERVE",
  "USE",
  "RETURN",
  "RELEASE_RESERVATION",
  "WASTE",
]);
export type ProjectStockAction = z.infer<typeof projectStockActionSchema>;
export const projectStockRowInputSchema = z
  .object({
    materialId: z.guid(),
    inventoryLocationId: z.guid(),
    quantity: decimal.refine((n) => n > 0),
    projectRapItemId: z.guid().nullable().default(null),
    projectCostId: z.guid().nullable().default(null),
    vendorBillId: z.guid().nullable().default(null),
    unitCost: stockPrice.optional(),
    note: z.string().trim().min(3).max(500),
  })
  .strict();
export const projectStockInputSchema = z
  .object({
    projectId: z.guid(),
    action: projectStockActionSchema,
    rows: z.array(projectStockRowInputSchema).min(1).max(20),
  })
  .strict()
  .superRefine((input, ctx) => {
    const keys = input.rows.map((row) => `${row.materialId}:${row.inventoryLocationId}`);
    const costs = input.rows
      .map((row) => row.projectCostId)
      .filter((id): id is string => Boolean(id));
    if (input.action === "WASTE" && input.rows.some((row) => row.note.trim().length < 10))
      ctx.addIssue({
        code: "custom",
        path: ["rows"],
        message: "Alasan waste minimal 10 karakter.",
      });
    if (
      input.action === "RELEASE_RESERVATION" &&
      input.rows.some((row) => row.projectCostId || row.vendorBillId || row.unitCost !== undefined)
    )
      ctx.addIssue({
        code: "custom",
        path: ["rows"],
        message: "Pelepasan reservasi tidak memakai sumber atau override biaya.",
      });
    if (new Set(costs).size !== costs.length)
      ctx.addIssue({
        code: "custom",
        path: ["rows"],
        message: "Satu sumber biaya hanya boleh dipakai sekali per usulan.",
      });
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({
        code: "custom",
        path: ["rows"],
        message:
          "Gabungkan material/lokasi yang sama atau siapkan usulan terpisah untuk sumber RAP berbeda.",
      });
  });
export const projectStockStateSchema = z.object({
  current: decimal,
  reserved: decimal,
  available: decimal,
  ownReserved: decimal,
  netUsed: decimal,
});
export type ProjectStockState = z.infer<typeof projectStockStateSchema>;
export type ProjectStockInput = z.infer<typeof projectStockInputSchema>;
export function projectStockPermission(action: ProjectStockAction): PermissionKey {
  return action === "RESERVE" || action === "RELEASE_RESERVATION"
    ? "reserve:stock"
    : action === "WASTE"
      ? "waste:stock"
      : "use:stock";
}
export function previewProjectStock(
  action: ProjectStockAction,
  before: ProjectStockState,
  quantity: number,
): ProjectStockState {
  decimal.refine((n) => n > 0).parse(quantity);
  projectStockStateSchema.parse(before);
  const q = parseNumericToCents(quantity.toFixed(2)),
    c = parseNumericToCents(before.current.toFixed(2)),
    r = parseNumericToCents(before.reserved.toFixed(2)),
    own = parseNumericToCents(before.ownReserved.toFixed(2));
  let current = c,
    reserved = r,
    ownReserved = own,
    netUsed = parseNumericToCents(before.netUsed.toFixed(2));
  if (action === "RESERVE") {
    if (q > c - r) throw new Error("INSUFFICIENT_AVAILABLE_STOCK");
    reserved += q;
    ownReserved += q;
  }
  if (action === "RELEASE_RESERVATION") {
    if (q > own || q > r) throw new Error("RELEASE_EXCEEDS_PROJECT_RESERVATION");
    reserved -= q;
    ownReserved -= q;
  }
  if (action === "USE" || action === "WASTE") {
    current -= q;
    reserved = reservedAfterOwnRelease({ reserved: r, ownReserved: own, quantity: q });
    if (current < 0n) throw new Error("INSUFFICIENT_CURRENT_STOCK");
    if (current < reserved) throw new Error("STOCK_RESERVED_FOR_OTHER_PROJECTS");
    ownReserved -= q > own ? own : q;
    if (action === "USE") netUsed += q;
  }
  if (action === "RETURN") {
    if (q > netUsed) throw new Error("RETURN_EXCEEDS_PROJECT_USAGE");
    current += q;
    netUsed -= q;
  }
  return projectStockStateSchema.parse({
    current: Number(fromCents(current)),
    reserved: Number(fromCents(reserved)),
    available: Number(fromCents(current - reserved)),
    ownReserved: Number(fromCents(ownReserved)),
    netUsed: Number(fromCents(netUsed)),
  });
}
export const projectStockProposalSchema = z.object({
  kind: z.literal("PROJECT_STOCK"),
  projectId: z.guid(),
  projectName: z.string(),
  action: projectStockActionSchema,
  expectedContext: z.string().regex(/^[a-f0-9]{64}$/),
  input: projectStockInputSchema,
  rows: z
    .array(
      z.object({
        id: z.string(),
        materialName: z.string(),
        locationName: z.string(),
        unit: z.string(),
        quantity: decimal,
        unitCost: stockPrice,
        costOverride: z.boolean(),
        note: z.string(),
        sourceLabel: z.string(),
        before: projectStockStateSchema,
        after: projectStockStateSchema,
      }),
    )
    .min(1)
    .max(20),
  budget: z
    .object({
      allocated: z.number().finite(),
      actualBefore: z.number().finite(),
      actualAfter: z.number().finite(),
      pending: z.number().finite(),
      remainingAfter: z.number().finite(),
      costDelta: z.number().finite(),
      overAllocation: z.number().finite(),
      rapTotal: z.number().finite(),
    })
    .nullable(),
  costEffect: z.enum(["NONE", "DEBIT", "CREDIT"]),
});
export type ProjectStockProposal = z.infer<typeof projectStockProposalSchema>;
export const projectStockIdentitySchema = z
  .object({ conversationId: z.guid(), toolCallId: z.string().min(1).max(200) })
  .strict();
export type ProjectStockView = {
  readonly proposal: ProjectStockProposal;
  readonly status: "READY" | "STALE" | "EXPIRED" | "CONFIRMED";
  readonly resultId: string | null;
};
export type ProjectStockReceipt = { readonly resultId: string; readonly alreadyConfirmed: boolean };
export const PROJECT_STOCK_KIND = "PROJECT_STOCK";
