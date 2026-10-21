import { cookies } from "@runtime/request-context";
import { and, eq } from "drizzle-orm";

import { db } from "@backend/db";
import { INSTANCE_TENANT_ID, materialMaster } from "@backend/db/schema";
import { availableRapStock, calculateRapMaterialCost } from "@atria/core/project/rap-cost";
import { auth } from "@backend/lib/auth";
import { assertPermission, resolveRoleName } from "@backend/lib/auth/permissions";
import { assertProjectAccess } from "@backend/lib/auth/scoping";
import {
  calculateRabSellingUnitPrice,
  getRapItemAvailabilityStatus,
} from "@atria/core/project/rap-rab";
import type { ActionResponse } from "@atria/core/types/action-response";
import type {
  AddProjectRapItemInput,
  UpdateProjectRapItemInput,
} from "@atria/core/validations/rap-rab";

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
  connection: Pick<typeof db, "query"> = db,
): Promise<number> {
  if (!materialId) return 0;
  const material = await connection.query.materialMaster.findFirst({
    where: and(eq(materialMaster.id, materialId), eq(materialMaster.tenantId, INSTANCE_TENANT_ID)),
    with: {
      inventory: true,
    },
  });
  return availableRapStock(material?.inventory ?? []);
}

export async function buildRapItemValues(
  input: AddProjectRapItemInput | UpdateProjectRapItemInput,
  connection: Pick<typeof db, "query"> = db,
): Promise<{
  materialId: string | null;
  area: string;
  name: string;
  description: string | null;
  requiredQuantity: string;
  bufferQuantity: string;
  totalQuantity: string;
  unit: string;
  estimatedUnitCost: string;
  estimatedTotalCost: string;
  source: string;
  status: string;
  internalNote: string | null;
}> {
  const calculated = calculateRapMaterialCost(input);
  if (input.materialId) {
    const material = await connection.query.materialMaster.findFirst({
      where: and(
        eq(materialMaster.id, input.materialId),
        eq(materialMaster.tenantId, INSTANCE_TENANT_ID),
      ),
      columns: { isActive: true },
    });
    if (!material?.isActive) throw new Error("Material tidak tersedia atau nonaktif.");
  }
  const availableStock = await getAvailableStockForMaterial(input.materialId, connection);

  return {
    materialId: input.materialId ?? null,
    area: input.area,
    name: input.name,
    description: input.description ?? null,
    requiredQuantity: calculated.requiredQuantity,
    bufferQuantity: calculated.bufferQuantity,
    totalQuantity: calculated.totalQuantity,
    unit: input.unit,
    estimatedUnitCost: calculated.estimatedUnitCost,
    estimatedTotalCost: calculated.estimatedTotalCost,
    source: input.source,
    status: getRapItemAvailabilityStatus({
      totalQuantity: Number(calculated.totalQuantity),
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
