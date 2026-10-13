import { z } from "zod";
import { updateMaterialSchema } from "../validations/settings";

export const MATERIAL_UPDATE_PROPOSAL = "MATERIAL_MASTER_UPDATE";
export const MATERIAL_UPDATE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
/** Keep the same PostgreSQL UUID contract as Settings, including seeded identities. */
export const materialEditIdSchema = updateMaterialSchema.shape.materialId;

export const materialUpdateChangesSchema = updateMaterialSchema
  .omit({ materialId: true })
  .partial()
  .strict()
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "Sebutkan data material yang ingin diubah.",
  });

export const materialEditFieldsSchema = z.object({
  categoryId: updateMaterialSchema.shape.categoryId,
  defaultVendorId: materialEditIdSchema.nullable(),
  name: z.string().max(255),
  specification: z.string().max(1000).nullable(),
  brand: z.string().max(100).nullable(),
  code: z.string().max(100).nullable(),
  color: z.string().max(100).nullable(),
  unit: z.string().max(50),
  isActive: z.boolean(),
});
export const materialEditSnapshotSchema = materialEditFieldsSchema.extend({
  categoryName: z.string(),
  vendorName: z.string().nullable(),
});
export const materialUpdateProposalSchema = z
  .object({
    kind: z.literal(MATERIAL_UPDATE_PROPOSAL),
    materialId: materialEditIdSchema,
    expectedUpdatedAt: z.iso.datetime(),
    before: materialEditSnapshotSchema,
    after: materialEditSnapshotSchema,
  })
  .strict();
export const materialUpdateIdentitySchema = z
  .object({
    conversationId: materialEditIdSchema,
    toolCallId: z.string().min(1).max(128),
  })
  .strict();
export const materialUpdateViewSchema = z.object({
  proposal: materialUpdateProposalSchema,
  status: z.enum(["READY", "STALE", "EXPIRED", "CONFIRMED"]),
  confirmedAt: z.iso.datetime().nullable(),
});
export type MaterialUpdateChanges = z.infer<typeof materialUpdateChangesSchema>;
export type MaterialEditFields = z.infer<typeof materialEditFieldsSchema>;
export type MaterialEditSnapshot = z.infer<typeof materialEditSnapshotSchema>;
export type MaterialUpdateProposal = z.infer<typeof materialUpdateProposalSchema>;
export type MaterialUpdateView = z.infer<typeof materialUpdateViewSchema>;
export type MaterialUpdateReceipt = {
  readonly materialId: string;
  readonly alreadyConfirmed: boolean;
};

const FIELD_LABELS = {
  name: "Nama",
  categoryId: "Kategori",
  unit: "Satuan",
  specification: "Spesifikasi",
  brand: "Merek",
  code: "Kode",
  color: "Warna",
  defaultVendorId: "Vendor",
  isActive: "Status",
} satisfies Record<keyof MaterialEditFields, string>;
export type MaterialChange = {
  readonly key: keyof MaterialEditFields;
  readonly label: string;
  readonly before: string;
  readonly after: string;
};
const FIELD_KEYS: readonly (keyof MaterialEditFields)[] = [
  "name",
  "categoryId",
  "unit",
  "specification",
  "brand",
  "code",
  "color",
  "defaultVendorId",
  "isActive",
];
function displayField(snapshot: MaterialEditSnapshot, key: keyof MaterialEditFields): string {
  if (key === "categoryId") return snapshot.categoryName;
  if (key === "defaultVendorId") return snapshot.vendorName ?? "Tanpa vendor";
  if (key === "isActive") return snapshot.isActive ? "Aktif" : "Nonaktif";
  const value = String(snapshot[key] ?? "");
  return value.trim() ? value : "Belum diisi";
}
export function materialUpdateDiff(
  before: MaterialEditSnapshot,
  after: MaterialEditSnapshot,
): readonly MaterialChange[] {
  return FIELD_KEYS.filter((key) => before[key] !== after[key]).map((key) => ({
    key,
    label: FIELD_LABELS[key],
    before: displayField(before, key),
    after: displayField(after, key),
  }));
}
export function isMaterialStatusOnly(proposal: MaterialUpdateProposal): boolean {
  const diff = materialUpdateDiff(proposal.before, proposal.after);
  return diff.length === 1 && diff[0].key === "isActive";
}
function nullableText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}
export function normalizeMaterialEdit(input: MaterialEditFields): MaterialEditFields {
  return {
    ...input,
    name: input.name.trim(),
    unit: input.unit.trim(),
    specification: nullableText(input.specification),
    brand: nullableText(input.brand),
    code: nullableText(input.code),
    color: nullableText(input.color),
  };
}
export function applyMaterialUpdate(
  before: MaterialEditFields,
  changes: MaterialUpdateChanges,
): MaterialEditFields {
  const supplied = Object.fromEntries(
    Object.entries(changes).filter(([, value]) => value !== undefined),
  );
  const merged = materialEditFieldsSchema.parse({ ...before, ...supplied });
  if (Object.keys(supplied).every((key) => key === "isActive")) return merged;
  const normalized = normalizeMaterialEdit(merged);
  updateMaterialSchema.omit({ materialId: true }).parse(normalized);
  return normalized;
}
