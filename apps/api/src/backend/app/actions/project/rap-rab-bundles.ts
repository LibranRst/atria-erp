import { eq, inArray } from "drizzle-orm";

import { db } from "@backend/db";
import { auditLog, rabEstimate, rabEstimateBundle, rabEstimateItem } from "@backend/db/schema";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  addRabManualItemSchema,
  createRabBundleSchema,
  deleteRabBundleSchema,
  updateRabBundleSchema,
  type AddRabManualItemInput,
} from "@atria/core/validations/rap-rab";
import { assertProjectMutationAccess, getSessionUser, toError } from "./rap-rab-utils";

export async function addRabManualItem(
  input: AddRabManualItemInput,
): Promise<ActionResponse<typeof rabEstimateItem.$inferSelect>> {
  const validation = addRabManualItemSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Manual quotation line tidak valid.",
      },
    };
  }
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const created = await db.transaction(async (tx) => {
      const estimate = await tx.query.rabEstimate.findFirst({
        where: eq(rabEstimate.id, validation.data.rabEstimateId),
        with: { items: true },
      });
      if (!estimate) throw new Error("RAB_NOT_FOUND");
      if (estimate.status !== "DRAFT")
        throw new Error("Manual line hanya dapat ditambahkan ke RAB DRAFT.");
      await assertProjectMutationAccess(user, estimate.projectId, "update:rab");
      const lineTotal = validation.data.quantity * validation.data.unitPrice;
      const displayOrder =
        estimate.items.reduce((highest, item) => Math.max(highest, item.displayOrder), 0) + 1;
      const [manualItem] = await tx
        .insert(rabEstimateItem)
        .values({
          rabEstimateId: estimate.id,
          sourceType: "MANUAL",
          itemNature: validation.data.itemNature ?? "PRODUCTION",
          clientLabel: validation.data.clientLabel,
          description: validation.data.description ?? null,
          quantity: validation.data.quantity.toFixed(2),
          unit: validation.data.unit,
          unitPrice: validation.data.unitPrice.toFixed(2),
          lineTotal: lineTotal.toFixed(2),
          displayOrder,
          isHidden: validation.data.isHidden ?? false,
          isBundle: validation.data.isBundle ?? false,
        })
        .returning();
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "ADD_RAB_MANUAL_ITEM",
        targetTable: "rab_estimate_item",
        targetId: manualItem.id,
        newState: JSON.stringify(manualItem),
      });
      return manualItem;
    });
    return { success: true, data: created };
  } catch (error) {
    return toError(error, "Gagal menambahkan manual quotation line.");
  }
}

export async function createRabBundle(
  input: unknown,
): Promise<ActionResponse<typeof rabEstimateBundle.$inferSelect>> {
  const validation = createRabBundleSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Paket quotation tidak valid.",
      },
    };
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const created = await db.transaction(async (tx) => {
      const estimate = await tx.query.rabEstimate.findFirst({
        where: eq(rabEstimate.id, validation.data.rabEstimateId),
        with: { bundles: true },
      });
      if (!estimate) throw new Error("RAB_NOT_FOUND");
      if (estimate.status !== "DRAFT") throw new Error("Paket hanya dapat dibuat pada RAB DRAFT.");
      await assertProjectMutationAccess(user, estimate.projectId, "update:rab");
      const uniqueIds = [...new Set(validation.data.itemIds)];
      if (uniqueIds.length < 2) throw new Error("Pilih minimal dua quotation line.");
      const items = await tx.query.rabEstimateItem.findMany({
        where: inArray(rabEstimateItem.id, uniqueIds),
      });
      if (
        items.length !== uniqueIds.length ||
        items.some((item) => item.rabEstimateId !== estimate.id)
      )
        throw new Error("Quotation line tidak valid.");
      if (items.some((item) => item.isHidden || item.bundleId))
        throw new Error("Line hidden atau sudah tergabung tidak dapat dipaketkan.");
      const [bundle] = await tx
        .insert(rabEstimateBundle)
        .values({
          rabEstimateId: estimate.id,
          clientLabel: validation.data.clientLabel,
          description: validation.data.description ?? null,
          quantity: validation.data.quantity.toFixed(2),
          unit: validation.data.unit,
          unitPrice: validation.data.unitPrice.toFixed(2),
          lineTotal: (validation.data.quantity * validation.data.unitPrice).toFixed(2),
          displayOrder:
            estimate.bundles.reduce((max, row) => Math.max(max, row.displayOrder), 0) + 1,
        })
        .returning();
      await tx
        .update(rabEstimateItem)
        .set({ bundleId: bundle.id, isBundle: true, updatedAt: new Date() })
        .where(inArray(rabEstimateItem.id, uniqueIds));
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "CREATE_RAB_BUNDLE",
        targetTable: "rab_estimate_bundle",
        targetId: bundle.id,
        newState: JSON.stringify({ ...bundle, itemIds: uniqueIds }),
      });
      return bundle;
    });
    return { success: true, data: created };
  } catch (error) {
    return toError(error, "Gagal membuat paket quotation.");
  }
}

export async function updateRabBundle(
  input: unknown,
): Promise<ActionResponse<typeof rabEstimateBundle.$inferSelect>> {
  const validation = updateRabBundleSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Paket quotation tidak valid.",
      },
    };
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const updated = await db.transaction(async (tx) => {
      const bundle = await tx.query.rabEstimateBundle.findFirst({
        where: eq(rabEstimateBundle.id, validation.data.bundleId),
        with: { estimate: true },
      });
      if (!bundle) throw new Error("RAB_BUNDLE_NOT_FOUND");
      if (bundle.estimate.status !== "DRAFT") throw new Error("Paket approved tidak dapat diubah.");
      await assertProjectMutationAccess(user, bundle.estimate.projectId, "update:rab");
      const [row] = await tx
        .update(rabEstimateBundle)
        .set({
          clientLabel: validation.data.clientLabel,
          description: validation.data.description ?? null,
          quantity: validation.data.quantity.toFixed(2),
          unit: validation.data.unit,
          unitPrice: validation.data.unitPrice.toFixed(2),
          lineTotal: (validation.data.quantity * validation.data.unitPrice).toFixed(2),
          isHidden: validation.data.isHidden ?? bundle.isHidden,
          updatedAt: new Date(),
        })
        .where(eq(rabEstimateBundle.id, bundle.id))
        .returning();
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "UPDATE_RAB_BUNDLE",
        targetTable: "rab_estimate_bundle",
        targetId: row.id,
        originalState: JSON.stringify(bundle),
        newState: JSON.stringify(row),
      });
      return row;
    });
    return { success: true, data: updated };
  } catch (error) {
    return toError(error, "Gagal memperbarui paket quotation.");
  }
}

export async function deleteRabBundle(
  input: unknown,
): Promise<ActionResponse<{ readonly id: string }>> {
  const validation = deleteRabBundleSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Paket quotation tidak valid." },
    };
  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const removed = await db.transaction(async (tx) => {
      const bundle = await tx.query.rabEstimateBundle.findFirst({
        where: eq(rabEstimateBundle.id, validation.data.bundleId),
        with: { estimate: true, items: true },
      });
      if (!bundle) throw new Error("RAB_BUNDLE_NOT_FOUND");
      if (bundle.estimate.status !== "DRAFT")
        throw new Error("Paket approved tidak dapat dibongkar.");
      await assertProjectMutationAccess(user, bundle.estimate.projectId, "update:rab");
      await tx
        .update(rabEstimateItem)
        .set({ bundleId: null, isBundle: false, updatedAt: new Date() })
        .where(eq(rabEstimateItem.bundleId, bundle.id));
      await tx.delete(rabEstimateBundle).where(eq(rabEstimateBundle.id, bundle.id));
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "DELETE_RAB_BUNDLE",
        targetTable: "rab_estimate_bundle",
        targetId: bundle.id,
        originalState: JSON.stringify(bundle),
      });
      return { id: bundle.id };
    });
    return { success: true, data: removed };
  } catch (error) {
    return toError(error, "Gagal membongkar paket quotation.");
  }
}
