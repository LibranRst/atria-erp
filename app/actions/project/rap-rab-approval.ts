"use server";

import { and, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLog,
  project,
  projectBudgetCategory,
  projectBudgets,
  projectCategoryPlanItem,
  projectRap,
  rabEstimate,
} from "@/db/schema";
import { getBudgetCategoryStatus } from "@/lib/budget/excel-budget";
import { calculateQuotationTotal } from "@/lib/project/quotation-total";
import type { ActionResponse } from "@/lib/types/action-response";
import { approveRabEstimateSchema } from "@/lib/validations/rap-rab";
import { assertProjectMutationAccess, getSessionUser, toError } from "./rap-rab-utils";

export async function approveRabEstimate(
  rabEstimateId: string,
): Promise<ActionResponse<typeof rabEstimate.$inferSelect>> {
  const validation = approveRabEstimateSchema.safeParse({ rabEstimateId });
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "ID RAB estimate tidak valid." },
    };
  }

  const user = await getSessionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };

  try {
    const result = await db.transaction(async (tx) => {
      const estimate = await tx.query.rabEstimate.findFirst({
        where: eq(rabEstimate.id, validation.data.rabEstimateId),
        with: {
          items: true,
          bundles: true,
        },
      });
      if (!estimate) throw new Error("RAB_NOT_FOUND");
      if (estimate.status !== "DRAFT") throw new Error("Hanya RAB DRAFT yang dapat di-approve.");
      await assertProjectMutationAccess(user, estimate.projectId, "approve:rab");

      const existingApproved = await tx.query.rabEstimate.findFirst({
        where: and(
          eq(rabEstimate.projectId, estimate.projectId),
          eq(rabEstimate.status, "APPROVED"),
          ne(rabEstimate.id, estimate.id),
        ),
      });
      if (existingApproved) {
        throw new Error("RAB approved sudah ada. Gunakan Change Order untuk revision berikutnya.");
      }

      const approvedValue = calculateQuotationTotal(estimate.items, estimate.bundles);

      const [updated] = await tx
        .update(rabEstimate)
        .set({
          status: "APPROVED",
          approvedValue: approvedValue.toFixed(2),
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(rabEstimate.id, estimate.id))
        .returning();

      await tx
        .update(project)
        .set({
          totalContractValue: approvedValue.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(project.id, estimate.projectId));

      const budget = await tx.query.projectBudgets.findFirst({
        where: eq(projectBudgets.projectId, estimate.projectId),
        with: {
          categories: true,
        },
      });
      if (budget) {
        const ratio = Number(budget.budgetCapRatio);
        const internalBudget = approvedValue * ratio;
        const targetGrossAmount = approvedValue - internalBudget;

        await tx
          .update(projectBudgets)
          .set({
            contractValue: approvedValue.toFixed(2),
            approvedRabValue: approvedValue.toFixed(2),
            internalBudget: internalBudget.toFixed(2),
            targetGrossAmount: targetGrossAmount.toFixed(2),
            targetGrossPercentage:
              approvedValue > 0 ? ((targetGrossAmount / approvedValue) * 100).toFixed(4) : "0.0000",
            status: "APPROVED",
            updatedAt: new Date(),
          })
          .where(eq(projectBudgets.id, budget.id));

        for (const cat of budget.categories) {
          if (!cat.isManualOverride) {
            const catRatio = Number(cat.ratioPercentage);
            const allocatedAmount = internalBudget * catRatio;
            const actualAmount = Number(cat.actualAmount);
            const usedPercentage = allocatedAmount > 0 ? (actualAmount / allocatedAmount) * 100 : 0;

            await tx
              .update(projectBudgetCategory)
              .set({
                allocatedAmount: allocatedAmount.toFixed(2),
                remainingAmount: (allocatedAmount - actualAmount).toFixed(2),
                usedPercentage: usedPercentage.toFixed(4),
                status: getBudgetCategoryStatus(usedPercentage),
                updatedAt: new Date(),
              })
              .where(eq(projectBudgetCategory.id, cat.id));
          }
        }
      }

      const categoryPlanIds = estimate.items
        .map((item) => item.sourceProjectCategoryPlanItemId)
        .filter((id): id is string => Boolean(id));
      if (categoryPlanIds.length > 0) {
        await tx
          .update(projectCategoryPlanItem)
          .set({
            status: "LOCKED",
            lockedById: user.id,
            lockedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(inArray(projectCategoryPlanItem.id, categoryPlanIds));
      }
      if (estimate.sourceProjectRapId) {
        await tx
          .update(projectRap)
          .set({
            status: "LOCKED",
            lockedById: user.id,
            lockedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(projectRap.id, estimate.sourceProjectRapId));
      }
      await tx.insert(auditLog).values({
        userId: user.id,
        action: "APPROVE_INITIAL_RAB",
        targetTable: "rab_estimate",
        targetId: updated.id,
        originalState: JSON.stringify(estimate),
        newState: JSON.stringify(updated),
      });

      return updated;
    });

    return { success: true, data: result };
  } catch (error) {
    return toError(error, "Gagal approve RAB estimate.");
  }
}
