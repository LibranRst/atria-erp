import { recordNotificationEvent } from "@backend/server/services/notification-events";

import { and, eq } from "drizzle-orm";

import { approval, projectBudgetCategory, projectCost } from "@backend/db/schema";
import {
  ensureCanonicalExpenseForProjectCost,
  syncProjectBudgetCategory,
} from "@backend/lib/budget/budget-sync";
import { decideExpenseApproval } from "@atria/core/finance/expense-approval-rule";
import {
  approveFieldRequestSchema,
  type ApproveFieldRequestInput,
} from "@atria/core/validations/finance";

import {
  createProjectCostApprovalTx,
  upsertApprovalTx,
  writeFieldRequestAuditTx,
} from "@backend/app/actions/finance/field-request-utils";

import type { Actor } from "@backend/server/actor";
import { assertProjectStatusIsOperational } from "@backend/lib/auth/scoping";
import { actorCan } from "@backend/lib/auth/permissions";
import {
  assertFinancePermission,
  lockFinanceProject,
  type FinanceTransaction,
} from "./mutation-access";

export async function verifyFieldRequestTx(
  tx: FinanceTransaction,
  actor: Actor,
  projectCostId: string,
): Promise<typeof projectCost.$inferSelect> {
  assertFinancePermission(actor, "update:cost");
  assertFinancePermission(actor, "verify:cost");

  const [cost] = await tx
    .select()
    .from(projectCost)
    .where(eq(projectCost.id, projectCostId))
    .for("update");

  if (!cost) {
    throw new Error("PROJECT_COST_NOT_FOUND");
  }
  const currentProject = await lockFinanceProject(tx, actor, cost.projectId);
  assertProjectStatusIsOperational(currentProject.status);

  if (cost.status !== "SUBMITTED") {
    throw new Error("COST_NOT_IN_SUBMITTED_STATE");
  }

  const amount = Number(cost.amount);
  /**
   * Kondisi overbudget diperiksa ulang di sini, bukan hanya dipercaya dari
   * penanda saat pengajuan. Antara pengajuan dan verifikasi, pengeluaran
   * lain pada kategori yang sama bisa disetujui lebih dulu dan mendorong
   * kategori melewati alokasinya — pengajuan ini baru menjadi overbudget
   * pada saat diverifikasi.
   *
   * `pendingAmount` masih memuat pengajuan ini, jadi ia dikurangkan agar
   * tidak dihitung dua kali bersama `amount`.
   */
  const budgetCategory = cost.projectBudgetCategoryId
    ? await tx.query.projectBudgetCategory.findFirst({
        where: eq(projectBudgetCategory.id, cost.projectBudgetCategoryId),
        with: { expenseCategory: true },
      })
    : null;
  const overrunNow = budgetCategory
    ? decideExpenseApproval({
        amount,
        allocatedAmount: Number(budgetCategory.allocatedAmount),
        actualAmount: Number(budgetCategory.actualAmount),
        // Pengajuan ini masih tercatat pending, jadi dikeluarkan agar tidak
        // dihitung dua kali bersama `amount`.
        otherPendingAmount: Math.max(0, Number(budgetCategory.pendingAmount) - amount),
      }).isOverrun
    : false;
  /*
   * Keputusan ambang dibaca dari baris pengajuan, bukan dihitung ulang:
   * ambang bisa berubah setelah pengajuan masuk, dan pengajuan yang sudah
   * menunggu tidak boleh berpindah jalur karena angka di Settings digeser.
   * Overrun tetap dinilai ulang — itu memang kondisi yang bisa berubah.
   */
  const requiresApproval = cost.requiresOwnerApproval || cost.budgetOverrun || overrunNow;
  const nextStatus = requiresApproval ? "VERIFIED" : "APPROVED";

  if (requiresApproval) {
    const existingApproval = await tx.query.approval.findFirst({
      where: and(
        eq(approval.referenceType, "project_cost"),
        eq(approval.referenceId, projectCostId),
      ),
    });
    if (!existingApproval) {
      await createProjectCostApprovalTx(tx, {
        projectCostId,
        isOverrun: cost.budgetOverrun || overrunNow,
        label: budgetCategory?.expenseCategory?.name,
      });
    }
  }

  const [updatedCost] = await tx
    .update(projectCost)
    .set({
      status: nextStatus,
      requiresOwnerApproval: cost.requiresOwnerApproval || requiresApproval,
      budgetOverrun: cost.budgetOverrun || overrunNow,
      verifiedById: actor.userId,
      verifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(projectCost.id, projectCostId))
    .returning();

  await writeFieldRequestAuditTx(tx, {
    userId: actor.userId,
    action: "VERIFY_FIELD_REQUEST",
    targetTable: "project_cost",
    targetId: projectCostId,
    originalState: { status: cost.status },
    newState: { status: nextStatus },
  });

  const syncedCategoryId = await ensureCanonicalExpenseForProjectCost({
    tx,
    costId: projectCostId,
  });
  await syncProjectBudgetCategory({
    tx,
    projectBudgetCategoryId: syncedCategoryId,
  });

  await recordNotificationEvent(tx, {
    referenceType: "project_cost",
    referenceId: updatedCost.id,
    projectId: updatedCost.projectId,
    stage: `${updatedCost.status}:${updatedCost.updatedAt.toISOString()}`,
    title:
      updatedCost.status === "VERIFIED"
        ? "Biaya menunggu persetujuan"
        : updatedCost.status === "APPROVED"
          ? "Biaya disetujui"
          : "Biaya ditolak",
    message: updatedCost.description,
    permission: updatedCost.status === "VERIFIED" ? "decide:all_approvals" : undefined,
    recipients: updatedCost.status === "VERIFIED" ? undefined : [updatedCost.requestedById],
    actionRequired: updatedCost.status === "VERIFIED",
    actionUrl:
      updatedCost.status === "VERIFIED"
        ? "/approvals"
        : `/projects/${updatedCost.projectId}?tab=budget`,
    actorId: actor.userId,
  });
  if (updatedCost.status === "APPROVED")
    await recordNotificationEvent(tx, {
      referenceType: "project_cost",
      referenceId: updatedCost.id,
      projectId: updatedCost.projectId,
      stage: `READY_TO_PAY:${updatedCost.updatedAt.toISOString()}`,
      title: "Biaya siap dibayar",
      message: updatedCost.description,
      permission: "pay:cost",
      actionRequired: true,
      actionUrl: `/projects/${updatedCost.projectId}?tab=budget`,
      actorId: actor.userId,
    });
  return updatedCost;
}

export async function approveFieldRequestTx(
  tx: FinanceTransaction,
  actor: Actor,
  input: ApproveFieldRequestInput,
): Promise<typeof projectCost.$inferSelect> {
  const { projectCostId, status, notes, emergencyOverride } =
    approveFieldRequestSchema.parse(input);
  assertFinancePermission(actor, "approve:cost");

  const [cost] = await tx
    .select()
    .from(projectCost)
    .where(eq(projectCost.id, projectCostId))
    .for("update");

  if (!cost) {
    throw new Error("PROJECT_COST_NOT_FOUND");
  }
  const currentProject = await lockFinanceProject(tx, actor, cost.projectId);
  assertProjectStatusIsOperational(currentProject.status);

  if (cost.status !== "VERIFIED") {
    throw new Error("COST_NOT_IN_VERIFIED_STATE");
  }
  if (status === "APPROVED" && cost.requestedById === actor.userId) {
    if (
      !actorCan(actor, "override:self_approval") ||
      !emergencyOverride ||
      (notes?.trim().length ?? 0) < 10
    )
      throw new Error("MAKER_CHECKER_REQUIRED");
  }

  await upsertApprovalTx(tx, {
    approverId: actor.userId,
    referenceType: "project_cost",
    referenceId: projectCostId,
    status,
    notes,
  });

  const [updatedCost] = await tx
    .update(projectCost)
    .set({
      status,
      approvedById: actor.userId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(projectCost.id, projectCostId))
    .returning();

  await writeFieldRequestAuditTx(tx, {
    userId: actor.userId,
    action:
      status === "APPROVED"
        ? cost.requestedById === actor.userId
          ? "EMERGENCY_APPROVE_FIELD_REQUEST"
          : "APPROVE_FIELD_REQUEST"
        : "REJECT_FIELD_REQUEST",
    targetTable: "project_cost",
    targetId: projectCostId,
    originalState: { status: cost.status },
    newState: { status },
  });

  const syncedCategoryId = await ensureCanonicalExpenseForProjectCost({
    tx,
    costId: projectCostId,
  });
  await syncProjectBudgetCategory({
    tx,
    projectBudgetCategoryId: syncedCategoryId,
  });

  await recordNotificationEvent(tx, {
    referenceType: "project_cost",
    referenceId: updatedCost.id,
    projectId: updatedCost.projectId,
    stage: `${updatedCost.status}:${updatedCost.updatedAt.toISOString()}`,
    title:
      updatedCost.status === "VERIFIED"
        ? "Biaya menunggu persetujuan"
        : updatedCost.status === "APPROVED"
          ? "Biaya disetujui"
          : "Biaya ditolak",
    message: updatedCost.description,
    permission: updatedCost.status === "VERIFIED" ? "decide:all_approvals" : undefined,
    recipients: updatedCost.status === "VERIFIED" ? undefined : [updatedCost.requestedById],
    actionRequired: updatedCost.status === "VERIFIED",
    actionUrl:
      updatedCost.status === "VERIFIED"
        ? "/approvals"
        : `/projects/${updatedCost.projectId}?tab=budget`,
    actorId: actor.userId,
  });
  if (updatedCost.status === "APPROVED")
    await recordNotificationEvent(tx, {
      referenceType: "project_cost",
      referenceId: updatedCost.id,
      projectId: updatedCost.projectId,
      stage: `READY_TO_PAY:${updatedCost.updatedAt.toISOString()}`,
      title: "Biaya siap dibayar",
      message: updatedCost.description,
      permission: "pay:cost",
      actionRequired: true,
      actionUrl: `/projects/${updatedCost.projectId}?tab=budget`,
      actorId: actor.userId,
    });
  return updatedCost;
}
