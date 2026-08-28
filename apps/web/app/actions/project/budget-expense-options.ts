"use server";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { inventoryLocation, materialMaster, project } from "@/db/schema";
import { scopeProjectQuery } from "@/lib/auth/scoping";
import type { ActionResponse } from "@atria/core/types/action-response";
import type { ProjectForExpense } from "./budget-types";
import { getBudgetActionSession } from "./budget-utils";

export async function getActiveProjectsForExpense(): Promise<ActionResponse<ProjectForExpense[]>> {
  try {
    const sessionResult = await getBudgetActionSession("Sesi tidak valid. Harap login kembali.");
    if (!sessionResult.success) return sessionResult;
    const { user, roleName } = sessionResult.data;
    const projectFilter = await scopeProjectQuery(user.id, roleName);

    const projectsData = await db.query.project.findMany({
      where: projectFilter
        ? and(eq(project.status, "ACTIVE"), projectFilter)
        : eq(project.status, "ACTIVE"),
      with: {
        budget: {
          with: {
            items: {
              with: {
                costCategory: true,
              },
            },
          },
        },
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
    });
    const materialOptionsData = await db.query.materialMaster.findMany({
      where: eq(materialMaster.isActive, true),
      with: {
        inventory: true,
      },
    });
    const materialOptions = materialOptionsData.map((material) => ({
      id: material.id,
      name: material.name,
      unit: material.unit,
      availableStock: material.inventory.reduce((sum, inventory) => {
        return sum + Number(inventory.currentStock) - Number(inventory.reservedStock);
      }, 0),
    }));
    const inventoryLocations = await db.query.inventoryLocation.findMany({
      where: eq(inventoryLocation.isActive, true),
    });

    const projectsForExpense: ProjectForExpense[] = projectsData.map((proj) => ({
      id: proj.id,
      name: proj.name,
      budget: proj.budget,
      canonicalBudgets: proj.canonicalBudgets.map((budget) => ({
        id: budget.id,
        status: budget.status,
        categories: budget.categories.map((category) => ({
          id: category.id,
          code: category.expenseCategory.code,
          name: category.expenseCategory.name,
          allocatedAmount: category.allocatedAmount,
          pendingAmount: category.pendingAmount,
          actualAmount: category.actualAmount,
          paidAmount: category.paidAmount,
          remainingAmount: category.remainingAmount,
          usedPercentage: category.usedPercentage,
          status: category.status,
          sortOrder: category.sortOrder,
        })),
      })),
      materialOptions,
      rapItems: proj.raps.flatMap((rap) =>
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
      categoryPlanItems: proj.categoryPlanItems.map((item) => ({
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
      inventoryLocations: inventoryLocations.map((location) => ({
        id: location.id,
        name: location.name,
      })),
    }));

    return {
      success: true,
      data: projectsForExpense,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan server saat mengambil data proyek.",
      },
    };
  }
}
