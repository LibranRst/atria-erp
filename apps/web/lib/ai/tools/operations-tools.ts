import "server-only";

import { db } from "@/db";
import {
  expenseCategory,
  project,
  projectExpenses,
  projectRap,
  projectRapItem,
  stockMovement,
} from "@/db/schema";
import { projectMaterialProjection } from "@atria/core/material/project-material-projection";
import { tool } from "ai";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import {
  accessibleProjectIds,
  canAccessProject,
  hasPermission,
  permissionDenied,
  PROJECT_ACCESS_DENIED,
  projectScopeCondition,
  type AiToolContext,
} from "./context";
import { money, toNumber } from "./shared";

/**
 * Tool batch 3: kebutuhan material lapangan, pengeluaran terakhir, dan kategori
 * biaya dari Settings. Ini bagian yang paling dipakai PM di lokasi proyek.
 */

const MAX_ROWS = 20;

export function buildOperationsTools(context: AiToolContext) {
  return {
    getMaterialShortage: tool({
      description:
        "For one project, list RAP material items that still need to be bought, comparing required quantity against what is already secured through purchase, receipt, or reservation.",
      inputSchema: z.object({
        projectId: z.guid().describe("The project id, obtained from listProjects."),
        limit: z.number().int().min(1).max(MAX_ROWS).default(10),
      }),
      execute: async ({ projectId, limit }) => {
        if (!hasPermission(context, "view:material")) {
          return permissionDenied("data material dan stok");
        }
        if (!(await canAccessProject(context, projectId))) {
          return PROJECT_ACCESS_DENIED;
        }

        const rap = await db.query.projectRap.findFirst({
          where: eq(projectRap.projectId, projectId),
          columns: { id: true, status: true },
          orderBy: [desc(projectRap.revision)],
        });

        if (!rap) {
          return { error: "Proyek ini belum memiliki RAP material." };
        }

        const items = await db.query.projectRapItem.findMany({
          where: eq(projectRapItem.projectRapId, rap.id),
          columns: {
            id: true,
            name: true,
            unit: true,
            totalQuantity: true,
            estimatedUnitCost: true,
          },
        });

        if (items.length === 0) {
          return { rapStatus: rap.status, shortages: [], note: "RAP belum berisi item material." };
        }

        const movements = await db
          .select({
            projectRapItemId: stockMovement.projectRapItemId,
            movementType: stockMovement.movementType,
            quantity: stockMovement.quantity,
            createdAt: stockMovement.createdAt,
            id: stockMovement.id,
          })
          .from(stockMovement)
          .where(
            and(
              eq(stockMovement.projectId, projectId),
              inArray(
                stockMovement.projectRapItemId,
                items.map((item) => item.id),
              ),
            ),
          );

        const shortages = items
          .map((item) => {
            const itemMovements = movements
              .filter((movement) => movement.projectRapItemId === item.id)
              .map((movement) => ({
                projectRapItemId: movement.projectRapItemId,
                movementType: movement.movementType,
                quantity: movement.quantity,
                createdAt: movement.createdAt,
                id: movement.id,
              }));

            const required = toNumber(item.totalQuantity);
            const projection = projectMaterialProjection(itemMovements, required);

            return {
              materialName: item.name,
              unit: item.unit,
              requiredQuantity: required,
              securedQuantity: projection.securedQuantity,
              needToBuyQuantity: projection.needToBuy,
              estimatedPurchaseCost: money(
                String(projection.needToBuy * toNumber(item.estimatedUnitCost)),
              ),
            };
          })
          .filter((item) => item.needToBuyQuantity > 0)
          .sort(
            (left, right) => right.estimatedPurchaseCost.amount - left.estimatedPurchaseCost.amount,
          )
          .slice(0, limit);

        const totalCost = shortages.reduce(
          (sum, item) => sum + item.estimatedPurchaseCost.amount,
          0,
        );

        return {
          projectId,
          rapStatus: rap.status,
          shortageCount: shortages.length,
          estimatedTotalPurchaseCost: money(String(totalCost)),
          shortages,
        };
      },
    }),

    getRecentExpenses: tool({
      description:
        "List the most recent recorded expenses, with project, category, amount, and approval status. Optionally narrow to one project.",
      inputSchema: z.object({
        projectId: z
          .guid()
          .optional()
          .describe("Narrow to one project. Omit to cover every project the user can access."),
        limit: z.number().int().min(1).max(MAX_ROWS).default(10),
      }),
      execute: async ({ projectId, limit }) => {
        if (!hasPermission(context, "view:cost")) {
          return permissionDenied("data pengeluaran proyek");
        }

        if (projectId && !(await canAccessProject(context, projectId))) {
          return PROJECT_ACCESS_DENIED;
        }

        const projectIds = await accessibleProjectIds(context);
        const conditions = [];
        if (projectId) {
          conditions.push(eq(projectExpenses.projectId, projectId));
        } else {
          const scope = projectScopeCondition(projectIds, projectExpenses.projectId);
          if (scope) conditions.push(scope);
        }

        const rows = await db
          .select({
            description: projectExpenses.description,
            amount: projectExpenses.amount,
            status: projectExpenses.status,
            paymentStatus: projectExpenses.paymentStatus,
            expenseDate: projectExpenses.expenseDate,
            projectId: projectExpenses.projectId,
            projectName: project.name,
            categoryName: expenseCategory.name,
          })
          .from(projectExpenses)
          .innerJoin(project, eq(projectExpenses.projectId, project.id))
          .innerJoin(expenseCategory, eq(projectExpenses.expenseCategoryId, expenseCategory.id))
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(projectExpenses.expenseDate))
          .limit(limit);

        return {
          expenses: rows.map((row) => ({
            description: row.description,
            projectId: row.projectId,
            projectName: row.projectName,
            categoryName: row.categoryName,
            amount: money(row.amount),
            status: row.status,
            paymentStatus: row.paymentStatus,
            expenseDate: row.expenseDate.toISOString().slice(0, 10),
          })),
        };
      },
    }),

    getExpenseCategories: tool({
      description:
        "List the active expense categories configured in Settings. Use to map a user's wording onto a real category before drafting an expense.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await db.query.expenseCategory.findMany({
          where: eq(expenseCategory.isActive, true),
          columns: { code: true, name: true, description: true },
          orderBy: [expenseCategory.sortOrder],
        });

        return {
          categories: rows.map((row) => ({
            code: row.code,
            name: row.name,
            description: row.description,
          })),
        };
      },
    }),
  };
}
