import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { materialMaster } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertPermission, resolveRoleName } from "@/lib/auth/permissions";
import { assertProjectAccess } from "@/lib/auth/scoping";
import { calculateRabSellingUnitPrice, getRapItemAvailabilityStatus } from "@/lib/project/rap-rab";
import type { ActionResponse } from "@/lib/types/action-response";
import type { AddProjectRapItemInput, UpdateProjectRapItemInput } from "@/lib/validations/rap-rab";

export type SessionUser = {
  readonly id: string;
  readonly roleId?: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({
    headers: {
      cookie: (await cookies()).toString(),
    },
  });
  return session?.user ? (session.user as SessionUser) : null;
}

export async function assertProjectMutationAccess(
  user: SessionUser,
  projectId: string,
  permission:
    "create:rap" | "update:rap" | "lock:rap" | "create:rab" | "update:rab" | "approve:rab",
): Promise<void> {
  await assertPermission(user, permission);
  const roleName = await resolveRoleName(user.roleId ?? "");
  await assertProjectAccess(projectId, user.id, roleName);
}

export function toError<T>(error: unknown, fallbackMessage: string): ActionResponse<T> {
  const message = error instanceof Error ? error.message : fallbackMessage;
  if (message.includes("FORBIDDEN") || message.includes("Akses")) {
    return { success: false, error: { code: "FORBIDDEN", message } };
  }
  if (message.includes("NOT_FOUND")) {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: fallbackMessage },
    };
  }
  return { success: false, error: { code: "TRANSACTION_FAILED", message } };
}

export async function getAvailableStockForMaterial(
  materialId: string | null | undefined,
): Promise<number> {
  if (!materialId) return 0;
  const material = await db.query.materialMaster.findFirst({
    where: eq(materialMaster.id, materialId),
    with: {
      inventory: true,
    },
  });
  return (
    material?.inventory.reduce((sum, inventory) => {
      return sum + Number(inventory.currentStock) - Number(inventory.reservedStock);
    }, 0) ?? 0
  );
}

export async function buildRapItemValues(
  input: AddProjectRapItemInput | UpdateProjectRapItemInput,
) {
  const totalQuantity = input.requiredQuantity + input.bufferQuantity;
  const estimatedTotalCost = totalQuantity * input.estimatedUnitCost;
  const availableStock = await getAvailableStockForMaterial(input.materialId);

  return {
    materialId: input.materialId ?? null,
    area: input.area,
    name: input.name,
    description: input.description ?? null,
    requiredQuantity: input.requiredQuantity.toFixed(2),
    bufferQuantity: input.bufferQuantity.toFixed(2),
    totalQuantity: totalQuantity.toFixed(2),
    unit: input.unit,
    estimatedUnitCost: input.estimatedUnitCost.toFixed(2),
    estimatedTotalCost: estimatedTotalCost.toFixed(2),
    source: input.source,
    status: getRapItemAvailabilityStatus({
      totalQuantity,
      availableStock,
      source: input.source,
    }),
    internalNote: input.internalNote ?? null,
  };
}

export function buildRabMaterialItemValues({
  rabEstimateId,
  item,
  targetGrossPercentage,
  displayOrder,
  description,
}: {
  readonly rabEstimateId: string;
  readonly item: {
    readonly id: string;
    readonly sourceLibraryItemId: string | null;
    readonly revision?: number;
    readonly updatedAt: Date;
    readonly name: string;
    readonly area: string;
    readonly description?: string | null;
    readonly totalQuantity: string;
    readonly unit: string;
    readonly suggestedClientUnitPrice: string;
    readonly estimatedUnitCost: string;
  };
  readonly targetGrossPercentage: number;
  readonly displayOrder: number;
  readonly description?: string;
}) {
  const quantity = Number(item.totalQuantity);
  const unitPrice =
    Number(item.suggestedClientUnitPrice) > 0
      ? Number(item.suggestedClientUnitPrice)
      : calculateRabSellingUnitPrice({
          costUnitPrice: Number(item.estimatedUnitCost),
          targetGrossPercentage,
        });

  return {
    rabEstimateId,
    sourceType: "RAP_MATERIAL",
    sourceProjectRapItemId: item.id,
    sourceProjectCategoryPlanItemId: null,
    sourceLibraryItemId: item.sourceLibraryItemId,
    sourceRevision: item.revision,
    sourceUpdatedAt: item.updatedAt,
    clientLabel: item.name,
    description: description ?? `${item.area} - ${item.name}`,
    quantity: quantity.toFixed(2),
    unit: item.unit,
    unitPrice: unitPrice.toFixed(2),
    lineTotal: (quantity * unitPrice).toFixed(2),
    displayOrder,
    isHidden: false,
    isBundle: false,
  };
}

export function buildRabCategoryPlanItemValues({
  rabEstimateId,
  item,
  targetGrossPercentage,
  displayOrder,
}: {
  readonly rabEstimateId: string;
  readonly item: {
    readonly id: string;
    readonly sourceLibraryItemId: string | null;
    readonly revision: number;
    readonly updatedAt: Date;
    readonly name: string;
    readonly area: string;
    readonly quantity: string;
    readonly unit: string;
    readonly suggestedClientUnitPrice: string;
    readonly estimatedUnitCost: string;
  };
  readonly targetGrossPercentage: number;
  readonly displayOrder: number;
}) {
  const quantity = Number(item.quantity);
  const unitPrice =
    Number(item.suggestedClientUnitPrice) > 0
      ? Number(item.suggestedClientUnitPrice)
      : calculateRabSellingUnitPrice({
          costUnitPrice: Number(item.estimatedUnitCost),
          targetGrossPercentage,
        });

  return {
    rabEstimateId,
    sourceType: "CATEGORY_PLAN",
    sourceProjectRapItemId: null,
    sourceProjectCategoryPlanItemId: item.id,
    sourceLibraryItemId: item.sourceLibraryItemId,
    sourceRevision: item.revision,
    sourceUpdatedAt: item.updatedAt,
    clientLabel: item.name,
    description: `${item.area} - ${item.name}`,
    quantity: quantity.toFixed(2),
    unit: item.unit,
    unitPrice: unitPrice.toFixed(2),
    lineTotal: (quantity * unitPrice).toFixed(2),
    displayOrder,
    isHidden: false,
    isBundle: false,
  };
}
