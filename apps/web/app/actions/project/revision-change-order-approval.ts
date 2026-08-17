"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLog,
  project,
  projectBudgetCategory,
  projectBudgets,
  projectCategoryPlanItem,
  projectChangeOrder,
  projectRap,
  rabEstimate,
} from "@/db/schema";
import { getBudgetCategoryStatus } from "@/lib/budget/excel-budget";
import { calculateQuotationTotal } from "@/lib/project/quotation-total";
import type { ActionResponse } from "@/lib/types/action-response";
import { approveChangeOrderSchema } from "@/lib/validations/workflow-governance";
import {
  assertRevisionProjectScope,
  getRevisionActionUser,
  revisionActionFailure,
} from "./revision-change-order-utils";

type ChangeOrder = typeof projectChangeOrder.$inferSelect;

export async function approveProjectChangeOrder(
  input: unknown,
): Promise<ActionResponse<ChangeOrder>> {
  const validation = approveChangeOrderSchema.safeParse(input);
  if (!validation.success)
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Change Order tidak valid." },
    };
  const user = await getRevisionActionUser();
  if (!user)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  try {
    const result = await db.transaction(async (tx) => {
      const changeOrder = await tx.query.projectChangeOrder.findFirst({
        where: eq(projectChangeOrder.id, validation.data.changeOrderId),
      });
      if (!changeOrder) throw new Error("CHANGE_ORDER_NOT_FOUND");
      if (
        changeOrder.status !== "PENDING_APPROVAL" ||
        !changeOrder.clientConfirmedAt ||
        !changeOrder.clientConfirmationReference
      ) {
        throw new Error("Change Order belum memiliki konfirmasi client yang lengkap.");
      }
      const roleName = await assertRevisionProjectScope(user, changeOrder.projectId, "approve:rab");
      if (roleName !== "OWNER" && roleName !== "FINANCE_ADMIN")
        throw new Error("FORBIDDEN: Approval Change Order hanya untuk Owner/Finance.");
      const selfApproval = changeOrder.createdById === user.id;
      if (
        selfApproval &&
        !(roleName === "OWNER" && validation.data.emergencyOverride && validation.data.reason)
      ) {
        throw new Error(
          "MAKER_CHECKER_REQUIRED: Change Order harus disetujui user lain. Owner dapat memakai emergency override dengan alasan.",
        );
      }
      const base = await tx.query.rabEstimate.findFirst({
        where: eq(rabEstimate.id, changeOrder.baseRabEstimateId),
      });
      const revised = await tx.query.rabEstimate.findFirst({
        where: eq(rabEstimate.id, changeOrder.revisedRabEstimateId),
        with: { items: true, bundles: true },
      });
      if (!base || !revised || base.status !== "APPROVED" || revised.status !== "DRAFT")
        throw new Error("RAB revision state sudah berubah.");
      const approvedValue = calculateQuotationTotal(revised.items, revised.bundles);
      if (Math.abs(approvedValue - Number(changeOrder.revisedContractValue)) > 0.01)
        throw new Error("Nilai RAB berubah setelah Change Order dibuat. Buat ulang Change Order.");

      await tx
        .update(rabEstimate)
        .set({ status: "SUPERSEDED", updatedAt: new Date() })
        .where(eq(rabEstimate.id, base.id));
      await tx
        .update(rabEstimate)
        .set({
          status: "APPROVED",
          approvedValue: approvedValue.toFixed(2),
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(rabEstimate.id, revised.id));
      await tx
        .update(project)
        .set({ totalContractValue: approvedValue.toFixed(2), updatedAt: new Date() })
        .where(eq(project.id, changeOrder.projectId));

      const budget = await tx.query.projectBudgets.findFirst({
        where: eq(projectBudgets.projectId, changeOrder.projectId),
        with: { categories: true },
      });
      if (budget) {
        const internalBudget = approvedValue * Number(budget.budgetCapRatio);
        await tx
          .update(projectBudgets)
          .set({
            contractValue: approvedValue.toFixed(2),
            approvedRabValue: approvedValue.toFixed(2),
            internalBudget: internalBudget.toFixed(2),
            targetGrossAmount: (approvedValue - internalBudget).toFixed(2),
            targetGrossPercentage:
              approvedValue > 0
                ? (((approvedValue - internalBudget) / approvedValue) * 100).toFixed(4)
                : "0.0000",
            updatedAt: new Date(),
          })
          .where(eq(projectBudgets.id, budget.id));
        for (const category of budget.categories) {
          if (category.isManualOverride) continue;
          const allocated = internalBudget * Number(category.ratioPercentage);
          const actual = Number(category.actualAmount);
          const used = allocated > 0 ? (actual / allocated) * 100 : actual > 0 ? 100 : 0;
          await tx
            .update(projectBudgetCategory)
            .set({
              allocatedAmount: allocated.toFixed(2),
              remainingAmount: (allocated - actual).toFixed(2),
              usedPercentage: used.toFixed(4),
              status: getBudgetCategoryStatus(used),
              updatedAt: new Date(),
            })
            .where(eq(projectBudgetCategory.id, category.id));
        }
      }

      if (revised.sourceProjectRapId) {
        const revisedRap = await tx.query.projectRap.findFirst({
          where: eq(projectRap.id, revised.sourceProjectRapId),
        });
        if (revisedRap?.supersedesProjectRapId) {
          await tx
            .update(projectRap)
            .set({ status: "SUPERSEDED", updatedAt: new Date() })
            .where(eq(projectRap.id, revisedRap.supersedesProjectRapId));
        }
        await tx
          .update(projectRap)
          .set({
            status: "LOCKED",
            lockedById: user.id,
            lockedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(projectRap.id, revised.sourceProjectRapId));
      }
      const planIds = revised.items
        .map((item) => item.sourceProjectCategoryPlanItemId)
        .filter((id): id is string => Boolean(id));
      if (planIds.length > 0) {
        const plans = await tx.query.projectCategoryPlanItem.findMany({
          where: inArray(projectCategoryPlanItem.id, planIds),
        });
        const supersededIds = plans
          .map((plan) => plan.supersedesProjectCategoryPlanItemId)
          .filter((id): id is string => Boolean(id));
        if (supersededIds.length > 0)
          await tx
            .update(projectCategoryPlanItem)
            .set({ status: "SUPERSEDED", updatedAt: new Date() })
            .where(inArray(projectCategoryPlanItem.id, supersededIds));
        await tx
          .update(projectCategoryPlanItem)
          .set({
            status: "LOCKED",
            lockedById: user.id,
            lockedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(inArray(projectCategoryPlanItem.id, planIds));
      }

      const [approved] = await tx
        .update(projectChangeOrder)
        .set({
          status: "APPROVED",
          approvedById: user.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(projectChangeOrder.id, changeOrder.id))
        .returning();
      await tx.insert(auditLog).values({
        userId: user.id,
        action: selfApproval ? "EMERGENCY_SELF_APPROVE_CHANGE_ORDER" : "APPROVE_CHANGE_ORDER",
        targetTable: "project_change_order",
        targetId: approved.id,
        originalState: JSON.stringify(changeOrder),
        newState: JSON.stringify({
          ...approved,
          emergencyReason: selfApproval ? validation.data.reason : null,
        }),
      });
      return approved;
    });
    revalidatePath(`/projects/${result.projectId}`);
    return { success: true, data: result };
  } catch (error) {
    return revisionActionFailure(error, "Gagal approve Change Order.");
  }
}
