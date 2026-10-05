import { recordNotificationEvent } from "@backend/server/services/notification-events";

import { and, eq, inArray, ne } from "drizzle-orm";

import { db } from "@backend/db";
import {
  auditLog,
  project,
  projectBudgetCategory,
  projectBudgets,
  projectCategoryPlanItem,
  projectRap,
  rabEstimate,
} from "@backend/db/schema";
import {
  calculateRabBudgetDerivation,
  getBudgetCategoryStatus,
} from "@atria/core/budget/excel-budget";
import type { ActionResponse } from "@atria/core/types/action-response";
import { approveRabEstimateSchema } from "@atria/core/validations/rap-rab";
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

      const budget = await tx.query.projectBudgets.findFirst({
        where: eq(projectBudgets.projectId, estimate.projectId),
        with: {
          categories: true,
        },
      });

      const budgetCapRatio = budget ? Number(budget.budgetCapRatio) : 0.9;
      const derivation = calculateRabBudgetDerivation({
        items: estimate.items,
        bundles: estimate.bundles,
        budgetCapRatio,
      });
      const approvedValue = derivation.approvedValue;

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

      if (budget) {
        await tx
          .update(projectBudgets)
          .set({
            contractValue: derivation.approvedValue.toFixed(2),
            approvedRabValue: derivation.approvedValue.toFixed(2),
            internalBudget: derivation.internalBudget.toFixed(2),
            targetGrossAmount: derivation.targetGrossAmount.toFixed(2),
            targetGrossPercentage: derivation.targetGrossPercentage.toFixed(4),
            status: "APPROVED",
            updatedAt: new Date(),
          })
          .where(eq(projectBudgets.id, budget.id));

        for (const cat of budget.categories) {
          if (!cat.isManualOverride) {
            const catRatio = Number(cat.ratioPercentage);
            const allocatedAmount = derivation.internalBudget * catRatio;
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

      await recordNotificationEvent(tx, {
        referenceType: "rab",
        referenceId: updated.id,
        projectId: updated.projectId,
        stage: "APPROVED",
        title: "RAB disetujui",
        message: "Persetujuan RAB telah dicatat.",
        permission: "view:rab",
        actionUrl: `/projects/${updated.projectId}`,
        actorId: user.id,
      });
      return updated;
    });

    return { success: true, data: result };
  } catch (error) {
    return toError(error, "Gagal approve RAB estimate.");
  }
}
