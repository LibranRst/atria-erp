import {
  auditLog,
  INSTANCE_TENANT_ID,
  materialCategory,
  materialMaster,
  vendor,
} from "@backend/db/schema";
import type { FinanceTransaction } from "../finance/mutation-access";
import { normalizeMaterialEdit, materialEditFieldsSchema } from "@atria/core/ai/material-update";
import {
  updateMaterialSchema,
  type UpdateMaterialInput,
  type SetMaterialActiveInput,
} from "@atria/core/validations/settings";
import type { ActionResponse } from "@atria/core/types/action-response";
import { and, eq } from "drizzle-orm";
import { assertMaterialIdentityAvailable, lockMaterialCatalog } from "./master-writer";

export class MaterialEditError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "MaterialEditError";
  }
}
export function materialEditFailure(error: unknown): ActionResponse<never> {
  if (error instanceof MaterialEditError)
    return { success: false, error: { code: error.code, message: error.message } };
  return {
    success: false,
    error: {
      code: "TRANSACTION_FAILED",
      message: "Perubahan material belum tersimpan. Coba lagi.",
    },
  };
}
type MaterialWriteOptions = {
  readonly expectedUpdatedAt?: string;
  readonly source?: { readonly conversationId: string; readonly toolCallId: string };
};
async function lockEditableMaterial(
  tx: FinanceTransaction,
  materialId: string,
  options: MaterialWriteOptions,
): Promise<typeof materialMaster.$inferSelect> {
  await lockMaterialCatalog(tx);
  const [row] = await tx
    .select()
    .from(materialMaster)
    .where(and(eq(materialMaster.id, materialId), eq(materialMaster.tenantId, INSTANCE_TENANT_ID)))
    .for("update");
  if (!row) throw new MaterialEditError("NOT_FOUND", "Material tidak ditemukan.");
  if (options.expectedUpdatedAt && row.updatedAt.toISOString() !== options.expectedUpdatedAt)
    throw new MaterialEditError(
      "CONFLICT",
      "Material berubah sejak usulan disiapkan. Minta asisten membuat usulan terbaru sebelum menyimpan.",
    );
  return row;
}
function nextVersion(current: Date): Date {
  return new Date(Math.max(Date.now(), current.getTime() + 1));
}
async function auditMaterialEdit(
  tx: FinanceTransaction,
  userId: string,
  action: string,
  before: typeof materialMaster.$inferSelect,
  after: typeof materialMaster.$inferSelect,
  options: MaterialWriteOptions,
): Promise<void> {
  await tx.insert(auditLog).values({
    userId,
    action,
    targetTable: "material_master",
    targetId: after.id,
    originalState: JSON.stringify(before),
    newState: JSON.stringify(options.source ? { ...after, aiSource: options.source } : after),
  });
}
export async function updateMaterialMasterTx(
  tx: FinanceTransaction,
  userId: string,
  input: UpdateMaterialInput,
  options: MaterialWriteOptions = {},
): Promise<typeof materialMaster.$inferSelect> {
  const fields = normalizeMaterialEdit(
    materialEditFieldsSchema.parse({
      ...input,
      defaultVendorId: input.defaultVendorId ?? null,
      specification: input.specification ?? null,
      brand: input.brand ?? null,
      code: input.code ?? null,
      color: input.color ?? null,
    }),
  );
  const validation = updateMaterialSchema.safeParse({ materialId: input.materialId, ...fields });
  if (!validation.success)
    throw new MaterialEditError(
      "VALIDATION_ERROR",
      "Nama, kategori, dan satuan material wajib valid.",
    );
  const before = await lockEditableMaterial(tx, input.materialId, options);
  const [category] = await tx
    .select({ id: materialCategory.id })
    .from(materialCategory)
    .where(
      and(
        eq(materialCategory.id, fields.categoryId),
        eq(materialCategory.tenantId, INSTANCE_TENANT_ID),
      ),
    )
    .for("share");
  if (!category)
    throw new MaterialEditError(
      "VALIDATION_ERROR",
      "Kategori material tidak tersedia. Pilih kategori yang terdaftar.",
    );
  if (fields.defaultVendorId) {
    const [supplier] = await tx
      .select({ id: vendor.id, isActive: vendor.isActive })
      .from(vendor)
      .where(and(eq(vendor.id, fields.defaultVendorId), eq(vendor.tenantId, INSTANCE_TENANT_ID)))
      .for("share");
    if (!supplier || (fields.defaultVendorId !== before.defaultVendorId && !supplier.isActive))
      throw new MaterialEditError(
        "VALIDATION_ERROR",
        "Vendor tidak tersedia. Pilih vendor aktif atau tanpa vendor.",
      );
  }
  try {
    await assertMaterialIdentityAvailable(tx, fields.name, fields.code, before.id);
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message === "Nama atau kode material sudah digunakan. Periksa kandidat duplikat."
    )
      throw new MaterialEditError("CONFLICT", error.message);
    throw error;
  }
  const [after] = await tx
    .update(materialMaster)
    .set({ ...fields, updatedAt: nextVersion(before.updatedAt) })
    .where(eq(materialMaster.id, before.id))
    .returning();
  await auditMaterialEdit(tx, userId, "UPDATE_MATERIAL_SETTING", before, after, options);
  return after;
}
export async function setMaterialActiveTx(
  tx: FinanceTransaction,
  userId: string,
  input: SetMaterialActiveInput,
  options: MaterialWriteOptions = {},
): Promise<typeof materialMaster.$inferSelect> {
  const before = await lockEditableMaterial(tx, input.materialId, options);
  const [after] = await tx
    .update(materialMaster)
    .set({ isActive: input.isActive, updatedAt: nextVersion(before.updatedAt) })
    .where(eq(materialMaster.id, before.id))
    .returning();
  await auditMaterialEdit(
    tx,
    userId,
    input.isActive ? "REACTIVATE_MATERIAL_SETTING" : "ARCHIVE_MATERIAL_SETTING",
    before,
    after,
    options,
  );
  return after;
}
