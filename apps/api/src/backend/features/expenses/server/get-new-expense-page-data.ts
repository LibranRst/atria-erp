import { and, eq } from "drizzle-orm";

import { db } from "@backend/db";
import { inventoryLocation, materialMaster, project } from "@backend/db/schema";
import type { ExpenseFormProject, InventoryLocationOption } from "@atria/core/types/expenses";
import { scopeProjectQuery } from "@backend/lib/auth/scoping";
import type { Actor } from "@backend/server/actor";

export type NewExpensePageData = {
  readonly projects: ExpenseFormProject[];
  readonly inventoryLocations: InventoryLocationOption[];
};

export async function getNewExpensePageData(actor: Actor): Promise<NewExpensePageData> {
  const projectFilter = await scopeProjectQuery(actor.userId, actor.roleName);

  const [projects, materials, locations] = await Promise.all([
    db.query.project.findMany({
      where: projectFilter
        ? and(eq(project.status, "ACTIVE"), projectFilter)
        : eq(project.status, "ACTIVE"),
      with: {
        canonicalBudgets: {
          with: {
            categories: {
              with: {
                expenseCategory: true,
              },
            },
          },
        },
        raps: {
          with: {
            items: true,
          },
        },
        categoryPlanItems: {
          with: {
            expenseCategory: true,
          },
        },
      },
    }),
    db.query.materialMaster.findMany({
      where: eq(materialMaster.isActive, true),
      with: {
        inventory: true,
      },
    }),
    db.query.inventoryLocation.findMany({
      where: eq(inventoryLocation.isActive, true),
    }),
  ]);

  const materialOptions = materials.map((material) => ({
    id: material.id,
    name: material.name,
    unit: material.unit,
    availableStock: material.inventory.reduce(
      (total, inventory) =>
        total + Number(inventory.currentStock) - Number(inventory.reservedStock),
      0,
    ),
  }));

  return {
    projects: projects.map((projectRow) => ({
      id: projectRow.id,
      name: projectRow.name,
      canonicalBudgets: projectRow.canonicalBudgets.map((budget) => ({
        id: budget.id,
        status: budget.status,
        categories: budget.categories.map((category) => ({
          id: category.id,
          code: category.expenseCategory.code,
          name: category.expenseCategory.name,
          allocatedAmount: category.allocatedAmount,
          pendingAmount: category.pendingAmount,
          actualAmount: category.actualAmount,
          remainingAmount: category.remainingAmount,
          usedPercentage: category.usedPercentage,
          status: category.status,
          sortOrder: category.sortOrder,
        })),
      })),
      materialOptions,
      rapItems: projectRow.raps.flatMap((rap) =>
        rap.items.map((item) => ({
          id: item.id,
          materialId: item.materialId,
          label: item.name,
          area: item.area,
          quantity: item.totalQuantity,
          unit: item.unit,
          status: item.status,
        })),
      ),
      categoryPlanItems: projectRow.categoryPlanItems.map((item) => ({
        id: item.id,
        projectBudgetCategoryId: item.projectBudgetCategoryId,
        expenseCategoryCode: item.expenseCategory.code,
        label: item.name,
        area: item.area,
        quantity: item.quantity,
        unit: item.unit,
        estimatedTotalCost: item.estimatedTotalCost,
        status: item.status,
      })),
    })),
    inventoryLocations: locations.map((location) => ({
      id: location.id,
      name: location.name,
    })),
  };
}
