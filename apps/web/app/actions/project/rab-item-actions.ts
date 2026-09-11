"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { auditLog, rabEstimateItem } from "@/db/schema";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  updateRabEstimateItemSchema,
  type UpdateRabEstimateItemInput,
} from "@atria/core/validations/rap-rab";
import { assertProjectMutationAccess, getSessionUser, toError } from "./rap-rab-utils";

export async function updateRabEstimateItem(
  input: UpdateRabEstimateItemInput,
): Promise<ActionResponse<typeof rabEstimateItem.$inferSelect>> {
  const validation = updateRabEstimateItemSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: validation.error.issues[0]?.message ?? "Data item RAB tidak valid.",
      },
    };
  }
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  }
  try {
    const item = await db.query.rabEstimateItem.findFirst({
      where: eq(rabEstimateItem.id, validation.data.rabEstimateItemId),
      with: { estimate: true },
    });
    if (!item) throw new Error("RAB_ITEM_NOT_FOUND");
    if (item.estimate.status !== "DRAFT") throw new Error("Hanya RAB DRAFT yang dapat diubah.");
    await assertProjectMutationAccess(user, item.estimate.projectId, "update:rab");
    const lineTotal = validation.data.quantity * validation.data.unitPrice;
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(rabEstimateItem)
        .set({
          clientLabel: validation.data.clientLabel,
          description: validation.data.description ?? null,
          quantity: validation.data.quantity.toFixed(2),
          unit: validation.data.unit,
          unitPrice: validation.data.unitPrice.toFixed(2),
          lineTotal: lineTotal.toFixed(2),
          itemNature: validation.data.itemNature ?? item.itemNature,
          displayOrder: validation.data.displayOrder ?? item.displayOrder,
          isHidden: validation.data.isHidden ?? item.isHidden,
          isBundle: validation.data.isBundle ?? item.isBundle,
          updatedAt: new Date(),
        })
        .where(eq(rabEstimateItem.id, item.id))
        .returning();
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "UPDATE_RAB_ITEM_DRAFT",
        targetTable: "rab_estimate_item",
        targetId: item.id,
        originalState: JSON.stringify(item),
        newState: JSON.stringify(row),
      });
      return row;
    });
    return { success: true, data: updated };
  } catch (error) {
    return toError(error, "Gagal mengubah item RAB.");
  }
}
