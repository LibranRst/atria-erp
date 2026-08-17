import { db } from "@/db";
import {
  auditLog,
  materialInventory,
  projectBudgets,
  projectExpenses,
  stockMovement,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertProjectAccess, assertProjectIsOperational } from "@/lib/auth/scoping";
import { resolveRoleName } from "@/lib/auth/permissions";
import { syncProjectBudgetCategory } from "@/lib/budget/budget-sync";
export {
  calculateOutstandingProjectReservations,
  type ProjectMaterialMovement as ProjectReservationMovement,
} from "@/lib/material/project-material-projection";
import { ActionResponse } from "@/lib/types/action-response";
import { and, eq } from "drizzle-orm";

type MaterialInventoryTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type SessionUser = {
  readonly id: string;
  readonly roleId: string;
};

export type MaterialInventoryStatus = "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK" | "RESERVED";

export type StockMovementInsertArgs = {
  materialId: string;
  inventoryLocationId: string;
  projectId?: string | null;
  projectRapItemId?: string | null;
  projectCostId?: string | null;
  vendorBillId?: string | null;
  movementType: string;
  quantity: string;
  unitCost: string;
  note?: string | null;
  createdById: string;
};

export async function getSessionUser(): Promise<
  ActionResponse<{ user: SessionUser; roleName: string }>
> {
  const session = await auth.api.getSession({
    headers: {
      cookie: (await (await import("next/headers")).cookies()).toString(),
    },
  });

  if (!session?.user) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid. Harap login kembali." },
    };
  }

  const roleName = await resolveRoleName(session.user.roleId);
  return {
    success: true,
    data: {
      user: {
        id: session.user.id,
        roleId: session.user.roleId,
      },
      roleName,
    },
  };
}

export async function assertProjectScopeForMaterialAction(
  projectId: string | null | undefined,
  userId: string,
  roleName: string,
): Promise<void> {
  if (!projectId) return;
  if (roleName !== "OWNER" && roleName !== "FINANCE_ADMIN" && roleName !== "PURCHASING") {
    await assertProjectAccess(projectId, userId, roleName);
  }
  await assertProjectIsOperational(projectId);
}

export function toDecimal(value: number): string {
  return value.toFixed(2);
}

export function calculateInventoryStatus(row: {
  currentStock: string;
  reservedStock: string;
  minimumStock: string;
}): MaterialInventoryStatus {
  const currentStock = Number(row.currentStock);
  const reservedStock = Number(row.reservedStock);
  const availableStock = currentStock - reservedStock;
  const minimumStock = Number(row.minimumStock);

  if (availableStock <= 0) return "OUT_OF_STOCK";
  if (reservedStock > 0 && availableStock <= minimumStock) return "RESERVED";
  if (availableStock <= minimumStock) return "LOW_STOCK";
  return "AVAILABLE";
}

export function ensureNonNegativeStock(value: bigint, message: string): void {
  if (value < BigInt(0)) {
    throw new Error(message);
  }
}

export async function findLockedInventory(
  tx: MaterialInventoryTx,
  materialId: string,
  locationId: string,
): Promise<typeof materialInventory.$inferSelect> {
  const [inventory] = await tx
    .select()
    .from(materialInventory)
    .where(
      and(
        eq(materialInventory.materialId, materialId),
        eq(materialInventory.locationId, locationId),
      ),
    )
    .for("update");

  if (!inventory) {
    throw new Error("INVENTORY_NOT_FOUND");
  }

  return inventory;
}

export async function insertStockMovement(
  tx: MaterialInventoryTx,
  args: StockMovementInsertArgs,
): Promise<typeof stockMovement.$inferSelect> {
  const [movement] = await tx.insert(stockMovement).values(args).returning();
  return movement;
}

export async function writeStockMovementAuditTx(
  tx: MaterialInventoryTx,
  args: {
    userId: string;
    action: string;
    inventoryId: string;
    originalState: object;
    newState: object;
  },
): Promise<void> {
  await tx.insert(auditLog).values({
    userId: args.userId,
    action: args.action,
    targetTable: "material_inventory",
    targetId: args.inventoryId,
    originalState: JSON.stringify(args.originalState),
    newState: JSON.stringify(args.newState),
    createdAt: new Date(),
  });
}

export async function recordStandaloneStockProjectCostTx(
  tx: MaterialInventoryTx,
  args: {
    readonly movement: typeof stockMovement.$inferSelect;
    readonly projectId: string;
    readonly requestedById: string;
    readonly quantity: number;
    readonly unitCost: number;
    readonly description: string;
    readonly sourceType: "STOCK_USAGE" | "STOCK_RETURN" | "STOCK_WASTE";
    readonly sign: 1 | -1;
  },
): Promise<void> {
  const budget = await tx.query.projectBudgets.findFirst({
    where: eq(projectBudgets.projectId, args.projectId),
    with: { categories: { with: { expenseCategory: true } } },
  });
  const category = budget?.categories.find((row) => row.expenseCategory.code === "MATERIAL");
  if (!budget || !category) throw new Error("PROJECT_MATERIAL_BUDGET_NOT_FOUND");

  const amount = args.quantity * args.unitCost * args.sign;
  await tx.insert(projectExpenses).values({
    projectId: args.projectId,
    projectBudgetId: category.projectBudgetId,
    projectBudgetCategoryId: category.id,
    expenseCategoryId: category.expenseCategoryId,
    materialId: args.movement.materialId,
    projectRapItemId: args.movement.projectRapItemId,
    stockMovementId: args.movement.id,
    requestedById: args.requestedById,
    description: args.description,
    quantity: (args.quantity * args.sign).toFixed(2),
    unitCost: args.unitCost.toFixed(2),
    amount: amount.toFixed(2),
    sourceType: args.sourceType,
    isCashImpact: false,
    paymentStatus: "NON_CASH",
    status: "APPROVED",
    auditNote: args.movement.note,
  });
  await syncProjectBudgetCategory({ tx, projectBudgetCategoryId: category.id });
}

export function mapStockError<T>(error: unknown, fallbackMessage: string): ActionResponse<T> {
  const message = error instanceof Error ? error.message : fallbackMessage;
  if (message === "INVENTORY_NOT_FOUND") {
    return {
      success: false,
      error: { code: "NOT_FOUND", message: "Inventory material tidak ditemukan." },
    };
  }
  if (message === "INSUFFICIENT_AVAILABLE_STOCK") {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Stock tersedia tidak cukup untuk reservasi." },
    };
  }
  if (message === "INSUFFICIENT_CURRENT_STOCK") {
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Stock fisik tidak cukup untuk aksi ini." },
    };
  }
  if (message === "STOCK_RESERVED_FOR_OTHER_PROJECTS") {
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Aksi ini akan memakai stock yang direservasi untuk project lain.",
      },
    };
  }
  if (message === "RETURN_EXCEEDS_PROJECT_USAGE") {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Jumlah return melebihi pemakaian bersih material pada proyek.",
      },
    };
  }
  return {
    success: false,
    error: {
      code: "TRANSACTION_FAILED",
      message,
    },
  };
}
