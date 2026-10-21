import { z } from "zod";

export const MATERIAL_IMPORT_LIMIT = 500;
export const MATERIAL_IMPORT_FORM = "MATERIAL_MASTER_IMPORT";
export const materialFieldsSchema = z.object({
  name: z.string().trim().max(255).default(""),
  categoryName: z.string().trim().max(100).default(""),
  unit: z.string().trim().max(50).default(""),
  locationName: z.string().trim().max(100).default(""),
  vendorName: z.string().trim().max(255).default(""),
  withoutVendor: z.boolean().default(false),
  specification: z.string().max(1000).default(""),
  brand: z.string().max(100).default(""),
  code: z.string().trim().max(100).default(""),
  color: z.string().max(100).default(""),
  minimumStock: z.number().finite().nonnegative().default(0),
  lastPurchasePrice: z.number().finite().nonnegative().default(0),
});
export type MaterialFields = z.infer<typeof materialFieldsSchema>;
export const materialSourceSchema = z.object({
  attachmentUrl: z.string().max(2000).optional(),
  fileName: z.string().max(255).optional(),
  sheet: z.string().max(255).optional(),
  page: z.number().int().positive().optional(),
  imageRegion: z
    .object({
      index: z.number().int().nonnegative(),
      top: z.number().int().nonnegative(),
      height: z.number().int().positive(),
      width: z.number().int().positive(),
      originalHeight: z.number().int().positive(),
    })
    .optional(),
  row: z.number().int().nonnegative(),
  raw: z.string().max(32000),
});
export type MaterialSource = z.infer<typeof materialSourceSchema>;
export const materialCandidateSchema = z.object({
  id: z.guid(),
  fields: materialFieldsSchema,
  source: materialSourceSchema,
  issues: z.array(z.string()),
  similarNames: z.array(z.string()).default([]),
  selected: z.boolean(),
  needsSourceReview: z.boolean().default(false),
  materialId: z.guid().nullable().default(null),
});
export type MaterialCandidate = z.infer<typeof materialCandidateSchema>;
export const materialReferenceSchema = z.object({
  kind: z.enum(["category", "location", "vendor"]),
  name: z.string().trim().min(2).max(255),
  phone: z.string().trim().max(50).default(""),
});
export type MaterialReference = z.infer<typeof materialReferenceSchema>;
export const materialBulkCorrectionSchema = z.object({
  rowIds: z.array(z.guid()).max(500).default([]),
  fields: z.object({
    categoryName: z.string().trim().max(100).optional(),
    unit: z.string().trim().max(50).optional(),
    locationName: z.string().trim().max(100).optional(),
    vendorName: z.string().trim().max(255).optional(),
    withoutVendor: z.boolean().optional(),
    specification: z.string().max(1000).optional(),
    brand: z.string().max(100).optional(),
    color: z.string().max(100).optional(),
    minimumStock: z.number().finite().nonnegative().optional(),
    lastPurchasePrice: z.number().finite().nonnegative().optional(),
  }),
  selected: z.boolean().optional(),
});
export type MaterialBulkCorrection = z.infer<typeof materialBulkCorrectionSchema>;
export function applyMaterialBulkCorrections(
  rows: readonly MaterialCandidate[],
  corrections: readonly MaterialBulkCorrection[],
): MaterialCandidate[] {
  let result = [...rows];
  for (const correction of corrections) {
    const ids = new Set(correction.rowIds);
    if ([...ids].some((id) => !result.some((row) => row.id === id && !row.materialId)))
      throw new Error("Baris koreksi tidak tersedia atau sudah tersimpan.");
    result = result.map((row) =>
      row.materialId || (ids.size > 0 && !ids.has(row.id))
        ? row
        : {
            ...row,
            fields: { ...row.fields, ...correction.fields },
            selected: correction.selected ?? row.selected,
          },
    );
  }
  return result;
}
export const materialProposalSchema = z.object({
  kind: z.literal("MATERIAL_MASTER_IMPORT"),
  rows: z.array(materialFieldsSchema).max(MATERIAL_IMPORT_LIMIT).default([]),
  attachmentUrls: z.array(z.string().max(2000)).max(4).default([]),
  correctionDraftId: z.guid().optional(),
  bulkCorrections: z.array(materialBulkCorrectionSchema).max(20).default([]),
  corrections: z
    .array(z.object({ rowId: z.guid(), fields: materialFieldsSchema }))
    .max(500)
    .default([]),
});
export type MaterialProposal = z.infer<typeof materialProposalSchema>;
export const materialReceiptSchema = z.object({
  operationId: z.guid(),
  rows: z.array(z.object({ rowId: z.guid(), materialId: z.guid() })),
});
export const materialDraftPayloadSchema = z.object({
  conversationId: z.guid(),
  sourceInstruction: z.string().max(2000).optional(),
  toolCallId: z.string().min(1).max(255),
  rows: z.array(materialCandidateSchema).max(MATERIAL_IMPORT_LIMIT),
  receipts: z.array(materialReceiptSchema).default([]),
  appliedCorrections: z.array(z.string()).default([]),
  referenceReceipts: z.record(z.string(), z.guid()).default({}),
  referenceBatchReceipts: z.record(z.string(), z.array(z.guid())).optional(),
  analysisStatus: z.enum(["QUEUED", "PROCESSING", "READY", "FAILED", "CANCELLED"]),
  progress: z.number().int().min(0).max(500).default(0),
  error: z.string().nullable().default(null),
});
export type MaterialDraftPayload = z.infer<typeof materialDraftPayloadSchema>;
export type MaterialDraftView = {
  readonly id: string;
  readonly revision: number;
  readonly payload: MaterialDraftPayload;
  readonly canCreateVendor: boolean;
  readonly options: { categories: string[]; locations: string[]; vendors: string[] };
};
export const materialDraftIdentitySchema = z.object({ draftId: z.guid() });
export const materialStartSchema = z.object({
  conversationId: z.guid(),
  toolCallId: z.string().min(1).max(255),
});
export const materialPatchSchema = materialDraftIdentitySchema.extend({
  expectedRevision: z.number().int().positive(),
  rows: z
    .array(z.object({ id: z.guid(), fields: materialFieldsSchema, selected: z.boolean() }))
    .max(500),
});
export const materialSelectionSchema = materialDraftIdentitySchema.extend({
  expectedRevision: z.number().int().positive(),
  selectedRowIds: z.array(z.guid()).max(500),
});
export const materialSaveSchema = materialDraftIdentitySchema.extend({
  expectedRevision: z.number().int().positive(),
  operationId: z.guid(),
  rowIds: z.array(z.guid()).min(1).max(500),
});
const materialReferenceConfirmationBase = materialDraftIdentitySchema.extend({
  expectedRevision: z.number().int().positive(),
  operationId: z.guid(),
});
export const materialConfirmReferenceSchema = z.union([
  materialReferenceConfirmationBase.extend({
    reference: materialReferenceSchema,
    sourceName: z.string().trim().min(1).max(255).optional(),
  }),
  materialReferenceConfirmationBase.extend({
    references: z
      .array(
        z.object({
          reference: materialReferenceSchema,
          sourceName: z.string().trim().min(1).max(255),
        }),
      )
      .min(1)
      .max(MATERIAL_IMPORT_LIMIT * 3),
  }),
]);

export function normalizeMaterialIdentity(value: string): string {
  return value.trim().toLocaleLowerCase("id-ID");
}
export function materialDraftCounts(rows: readonly MaterialCandidate[]): {
  ready: number;
  review: number;
  excluded: number;
  created: number;
  duplicate: number;
} {
  return {
    duplicate: rows.filter(
      (row) =>
        !row.materialId && row.issues.some((issue) => issue.toLowerCase().includes("duplikat")),
    ).length,
    ready: rows.filter((row) => !row.materialId && row.selected && row.issues.length === 0).length,
    review: rows.filter((row) => !row.materialId && row.issues.length > 0).length,
    excluded: rows.filter((row) => !row.materialId && !row.selected).length,
    created: rows.filter((row) => Boolean(row.materialId)).length,
  };
}
