import { z } from "zod";
import type { PermissionKey } from "../auth/permissions";
import { hasTwoDecimalPrecision, RAP_COST_MAX, RAP_QUANTITY_MAX } from "../project/rap-cost";
import { calculateQuotationTotal } from "../project/quotation-total";
import { rabLineTotal } from "./rab-draft";

export const RAB_WORKFLOW_KIND = "RAB_WORKFLOW";
const id = z.string().guid();
const reason = z.string().trim().min(10).max(2000);
const lineFields = z
  .object({
    clientLabel: z.string().trim().min(3).max(255),
    description: z.string().trim().max(1000).default(""),
    quantity: z.number().finite().positive().max(RAP_QUANTITY_MAX).refine(hasTwoDecimalPrecision),
    unit: z.string().trim().min(1).max(50),
    unitPrice: z.number().finite().nonnegative().max(RAP_COST_MAX).refine(hasTwoDecimalPrecision),
    itemNature: z.enum(["PRODUCTION", "SERVICE_FEE"]).default("PRODUCTION"),
    isHidden: z.boolean().default(false),
  })
  .strict();
export const rabWorkflowLineFieldsSchema = lineFields.refine(
  (row) => rabLineTotal(row) <= RAP_COST_MAX,
  "Subtotal melampaui batas RAB.",
);
export const rabWorkflowItemSchema = rabWorkflowLineFieldsSchema.safeExtend({
  id,
  bundleId: id.nullable(),
  lineTotal: z.number().finite().nonnegative().optional(),
});
export const rabWorkflowBundleFieldsSchema = lineFields
  .omit({ itemNature: true })
  .refine((row) => rabLineTotal(row) <= RAP_COST_MAX, "Subtotal melampaui batas RAB.");
export const rabWorkflowBundleSchema = rabWorkflowBundleFieldsSchema.safeExtend({
  id,
  itemIds: z.array(id),
  lineTotal: z.number().finite().nonnegative().optional(),
});
const itemChange = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ADD"), fields: rabWorkflowLineFieldsSchema }).strict(),
  z
    .object({
      action: z.literal("UPDATE"),
      itemId: id,
      fields: rabWorkflowLineFieldsSchema.safeExtend({
        itemNature: z.enum(["PRODUCTION", "SERVICE_FEE"]),
        isHidden: z.boolean(),
      }),
    })
    .strict(),
  z.object({ action: z.enum(["EXCLUDE", "RESTORE"]), itemId: id }).strict(),
]);
export const rabWorkflowRequestSchema = z
  .discriminatedUnion("action", [
    z
      .object({
        action: z.literal("EDIT_DRAFT"),
        title: z.string().trim().min(3).max(255).optional(),
        clientNotes: z.string().trim().max(1000).optional(),
        rows: z.array(itemChange).max(100).default([]),
      })
      .strict(),
    z
      .object({
        action: z.literal("CREATE_BUNDLE"),
        itemIds: z.array(id).min(2).max(100),
        fields: rabWorkflowBundleFieldsSchema,
      })
      .strict(),
    z
      .object({
        action: z.literal("UPDATE_BUNDLE"),
        bundleId: id,
        fields: rabWorkflowBundleFieldsSchema.safeExtend({ isHidden: z.boolean() }),
      })
      .strict(),
    z.object({ action: z.literal("DISSOLVE_BUNDLE"), bundleId: id }).strict(),
    z.object({ action: z.literal("REFRESH_SOURCES") }).strict(),
    z.object({ action: z.literal("APPROVE_INITIAL") }).strict(),
    z.object({ action: z.literal("CREATE_REVISION"), reason }).strict(),
    z.object({ action: z.literal("VOID_REVISION"), reason: reason.max(1000) }).strict(),
    z
      .object({
        action: z.literal("CREATE_CHANGE_ORDER"),
        reason,
        scopeSummary: z.string().trim().min(10).max(4000),
      })
      .strict(),
    z
      .object({
        action: z.literal("CONFIRM_CLIENT"),
        changeOrderId: id,
        confirmedAt: z.string().datetime({ offset: true }),
        confirmationReference: z.string().trim().min(3).max(255),
      })
      .strict(),
    z
      .object({
        action: z.literal("APPROVE_CHANGE_ORDER"),
        changeOrderId: id,
        emergencyOverride: z.boolean().default(false),
        reason: reason.max(1000).optional(),
      })
      .strict(),
    z.object({ action: z.literal("REJECT_CHANGE_ORDER"), changeOrderId: id, reason }).strict(),
  ])
  .superRefine((request, ctx) => {
    if (request.action === "EDIT_DRAFT") {
      if (!request.rows.length && request.title === undefined && request.clientNotes === undefined)
        ctx.addIssue({ code: "custom", message: "Isi minimal satu koreksi." });
      const ids = request.rows.flatMap((row) => ("itemId" in row ? [row.itemId] : []));
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({ code: "custom", message: "Baris koreksi berulang." });
    }
    if (
      request.action === "CREATE_BUNDLE" &&
      new Set(request.itemIds).size !== request.itemIds.length
    )
      ctx.addIssue({ code: "custom", message: "Anggota paket berulang." });
    if (request.action === "CREATE_BUNDLE" && request.fields.isHidden)
      ctx.addIssue({ code: "custom", message: "Paket baru harus ditampilkan pada penawaran." });
    if (request.action === "APPROVE_CHANGE_ORDER" && request.emergencyOverride && !request.reason)
      ctx.addIssue({ code: "custom", message: "Alasan override wajib diisi." });
  });
export const rabWorkflowInputSchema = z
  .object({ projectId: id, rabEstimateId: id, request: rabWorkflowRequestSchema })
  .strict();
export const rabWorkflowIdentitySchema = z
  .object({ conversationId: id, toolCallId: z.string().min(1).max(200) })
  .strict();
export const rabWorkflowReviewRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  action: z.string(),
  before: rabWorkflowLineFieldsSchema.nullable(),
  after: rabWorkflowLineFieldsSchema.nullable(),
  beforeState: z.string().nullable(),
  afterState: z.string().nullable(),
});
export const rabWorkflowBudgetSchema = z.object({
  contractBefore: z.number(),
  contractAfter: z.number(),
  capBefore: z.number(),
  capAfter: z.number(),
  categories: z.array(
    z.object({
      name: z.string(),
      before: z.number(),
      after: z.number(),
      actual: z.number(),
      manual: z.boolean(),
    }),
  ),
});
export const rabWorkflowProposalSchema = z
  .object({
    kind: z.literal(RAB_WORKFLOW_KIND),
    projectId: id,
    projectName: z.string(),
    rabEstimateId: id,
    title: z.string(),
    revision: z.number().int().positive(),
    request: rabWorkflowRequestSchema,
    expectedContext: z.string().length(64),
    rows: z.array(rabWorkflowReviewRowSchema).max(1000),
    totalBefore: z.number().finite().nonnegative(),
    totalAfter: z.number().finite().nonnegative(),
    budgetImpact: rabWorkflowBudgetSchema.nullable(),
    warning: z.string().nullable(),
  })
  .strict();
export type RabWorkflowLine = z.infer<typeof rabWorkflowLineFieldsSchema>;
export type RabWorkflowItem = z.infer<typeof rabWorkflowItemSchema>;
export type RabWorkflowBundle = z.infer<typeof rabWorkflowBundleSchema>;
export type RabWorkflowRequest = z.infer<typeof rabWorkflowRequestSchema>;
export type RabWorkflowInput = z.infer<typeof rabWorkflowInputSchema>;
export type RabWorkflowProposal = z.infer<typeof rabWorkflowProposalSchema>;
export type RabWorkflowView = {
  readonly proposal: RabWorkflowProposal;
  readonly status: "READY" | "STALE" | "EXPIRED" | "CONFIRMED";
  readonly resultId: string | null;
};
export type RabWorkflowReceipt = { readonly resultId: string; readonly alreadyConfirmed: boolean };

export function rabWorkflowPermission(request: RabWorkflowRequest): PermissionKey {
  if (
    request.action === "APPROVE_INITIAL" ||
    request.action === "APPROVE_CHANGE_ORDER" ||
    request.action === "REJECT_CHANGE_ORDER"
  )
    return "approve:rab";
  return request.action === "CREATE_REVISION" ? "create:rab" : "update:rab";
}
export function rabWorkflowTotal(
  items: readonly RabWorkflowItem[],
  bundles: readonly RabWorkflowBundle[],
): number {
  return calculateQuotationTotal(
    items.map((row) => ({ ...row, lineTotal: row.lineTotal ?? rabLineTotal(row) })),
    bundles.map((row) => ({ ...row, lineTotal: row.lineTotal ?? rabLineTotal(row) })),
  );
}
export function previewRabChanges(
  items: readonly RabWorkflowItem[],
  bundles: readonly RabWorkflowBundle[],
  request: RabWorkflowRequest,
): { items: RabWorkflowItem[]; bundles: RabWorkflowBundle[]; rows: RabWorkflowProposal["rows"] } {
  let nextItems = items.map((row) => ({ ...row })),
    nextBundles = bundles.map((row) => ({ ...row }));
  const rows: RabWorkflowProposal["rows"] = [];
  const add = (
    id: string,
    title: string,
    action: string,
    before: RabWorkflowLine | null,
    after: RabWorkflowLine | null,
    detail = "",
  ): void => {
    const fields = (row: RabWorkflowLine): RabWorkflowLine => ({
      clientLabel: row.clientLabel,
      description: row.description,
      quantity: row.quantity,
      unit: row.unit,
      unitPrice: row.unitPrice,
      itemNature: row.itemNature,
      isHidden: row.isHidden,
    });
    rows.push({
      id,
      title,
      action,
      before: before ? fields(before) : null,
      after: after ? fields(after) : null,
      detail,
      beforeState: null,
      afterState: null,
    });
  };
  if (request.action === "EDIT_DRAFT") {
    for (const [index, change] of request.rows.entries()) {
      if (change.action === "ADD") {
        const row = { ...change.fields, id: `add:${index}`, bundleId: null };
        nextItems.push(row);
        add(row.id, row.clientLabel, "Tambah baris", null, row);
        continue;
      }
      const row = nextItems.find((item) => item.id === change.itemId);
      if (!row) throw new Error("Baris RAB tidak ditemukan.");
      const after =
        change.action === "UPDATE"
          ? { ...row, ...change.fields, lineTotal: rabLineTotal(change.fields) }
          : { ...row, isHidden: change.action === "EXCLUDE" };
      nextItems = nextItems.map((item) => (item.id === row.id ? after : item));
      add(
        row.id,
        after.clientLabel,
        change.action === "EXCLUDE"
          ? "Keluarkan dari penawaran"
          : change.action === "RESTORE"
            ? "Tampilkan kembali"
            : "Koreksi baris",
        row,
        after,
        row.bundleId ? "Anggota paket; subtotal penawaran tetap memakai harga paket." : "",
      );
    }
  } else if (request.action === "CREATE_BUNDLE") {
    const members = items.filter((row) => request.itemIds.includes(row.id));
    if (
      members.length !== request.itemIds.length ||
      members.some((row) => row.isHidden || row.bundleId)
    )
      throw new Error("Pilih baris terlihat yang belum masuk paket pada RAB ini.");
    const bundle = { ...request.fields, id: "new-bundle", itemIds: request.itemIds };
    nextBundles.push(bundle);
    nextItems = nextItems.map((row) =>
      request.itemIds.includes(row.id) ? { ...row, bundleId: bundle.id } : row,
    );
    add(
      bundle.id,
      bundle.clientLabel,
      "Buat paket",
      null,
      { ...bundle, itemNature: "PRODUCTION" },
      members.map((row) => row.clientLabel).join(" · "),
    );
  } else if (request.action === "UPDATE_BUNDLE" || request.action === "DISSOLVE_BUNDLE") {
    const bundle = bundles.find((row) => row.id === request.bundleId);
    if (!bundle) throw new Error("Paket RAB tidak ditemukan.");
    if (request.action === "UPDATE_BUNDLE") {
      const after = { ...bundle, ...request.fields, lineTotal: rabLineTotal(request.fields) };
      nextBundles = nextBundles.map((row) => (row.id === bundle.id ? after : row));
      add(
        bundle.id,
        after.clientLabel,
        "Koreksi paket",
        { ...bundle, itemNature: "PRODUCTION" },
        { ...after, itemNature: "PRODUCTION" },
      );
    } else {
      nextBundles = nextBundles.filter((row) => row.id !== bundle.id);
      nextItems = nextItems.map((row) =>
        row.bundleId === bundle.id ? { ...row, bundleId: null } : row,
      );
      add(
        bundle.id,
        bundle.clientLabel,
        "Bongkar paket",
        { ...bundle, itemNature: "PRODUCTION" },
        null,
        "Anggota kembali menjadi baris tersendiri dengan harga jual masing-masing.",
      );
    }
  }
  if (rabWorkflowTotal(nextItems, nextBundles) > RAP_COST_MAX)
    throw new Error("Total RAB melampaui batas nilai.");
  return { items: nextItems, bundles: nextBundles, rows };
}
