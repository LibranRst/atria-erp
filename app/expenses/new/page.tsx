import { db } from "@/db";
import { inventoryLocation, materialMaster, project } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveRoleName } from "@/lib/auth/permissions";
import { scopeProjectQuery } from "@/lib/auth/scoping";
import { ExpenseForm } from "@/features/expenses/components/expense-form";
import { requireServerSession } from "@/lib/server/session";
import React from "react";

export const dynamic = "force-dynamic";

export default async function NewExpensePage(): Promise<React.JSX.Element> {
  // 1. Dapatkan session server-side
  const session = await requireServerSession();

  // 2. Selesaikan resolusi peran dan scoping proyek
  const roleName = await resolveRoleName(session.user.roleId);
  const projectFilter = scopeProjectQuery(session.user.id, roleName);

  // 3. Kueri proyek aktif yang dapat diakses oleh PM
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
  const projectsForForm = projectsData.map((proj) => ({
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
  }));

  return (
    <section className="space-y-sm select-none">
      <ExpenseForm
        projects={projectsForForm}
        inventoryLocations={inventoryLocations.map((location) => ({
          id: location.id,
          name: location.name,
        }))}
      />
    </section>
  );
}
