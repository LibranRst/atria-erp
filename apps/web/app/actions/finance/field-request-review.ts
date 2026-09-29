"use server";

import { roleNameHasPermission } from "@/lib/auth/role-access";
import { reconcileVendorBillAction } from "@/server/services/notification-job";
import { vendorBill } from "@/db/schema";
import { recordNotificationEvent } from "@/server/services/notification-events";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { approval, projectBudgetCategory, projectCost, vendorPayment } from "@/db/schema";
import {
  ensureCanonicalExpenseForProjectCost,
  syncProjectBudgetCategory,
} from "@/lib/budget/budget-sync";
import type { ActionResponse } from "@atria/core/types/action-response";
import { decideExpenseApproval } from "@atria/core/finance/expense-approval-rule";
import { resolveRoleName } from "@/lib/auth/permissions";
import {
  approveFieldRequestSchema,
  type ApproveFieldRequestInput,
} from "@atria/core/validations/finance";
import { authorizeFieldRequestAction, authorizeOwnerVendorApproval } from "./field-request-auth";
import {
  createProjectCostApprovalTx,
  mapApproveFieldRequestError,
  mapApproveVendorPaymentError,
  mapVerifyFieldRequestError,
  upsertApprovalTx,
  writeFieldRequestAuditTx,
} from "./field-request-utils";

export async function verifyFieldRequest(
  projectCostId: string,
): Promise<ActionResponse<typeof projectCost.$inferSelect>> {
  try {
    const authResult = await authorizeFieldRequestAction({
      permission: "update:cost",
    });
    if (!authResult.success) return authResult;
    const currentUser = authResult.data.user;
    const roleName = await resolveRoleName(currentUser.roleId);
    if (!(await roleNameHasPermission(roleName, "verify:cost"))) {
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Verifikasi pengeluaran hanya dapat dilakukan Owner atau Finance Admin.",
        },
      };
    }

    const result = await db.transaction(async (tx) => {
      const cost = await tx.query.projectCost.findFirst({
        where: eq(projectCost.id, projectCostId),
      });

      if (!cost) {
        throw new Error("PROJECT_COST_NOT_FOUND");
      }

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
          verifiedById: currentUser.id,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(projectCost.id, projectCostId))
        .returning();

      await writeFieldRequestAuditTx(tx, {
        userId: currentUser.id,
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
        actorId: currentUser.id,
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
          actorId: currentUser.id,
        });
      return updatedCost;
    });

    return {
      success: true,
      data: result,
    };
  } catch (error: unknown) {
    return mapVerifyFieldRequestError(error);
  }
}

export async function approveFieldRequest(
  input: ApproveFieldRequestInput,
): Promise<ActionResponse<typeof projectCost.$inferSelect>> {
  const validation = approveFieldRequestSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Parameter persetujuan tidak valid." },
    };
  }

  const { projectCostId, status, notes, emergencyOverride } = validation.data;

  try {
    const authResult = await authorizeFieldRequestAction({
      permission: "approve:cost",
    });
    if (!authResult.success) return authResult;
    const currentUser = authResult.data.user;

    const result = await db.transaction(async (tx) => {
      const cost = await tx.query.projectCost.findFirst({
        where: eq(projectCost.id, projectCostId),
      });

      if (!cost) {
        throw new Error("PROJECT_COST_NOT_FOUND");
      }

      if (cost.status !== "VERIFIED") {
        throw new Error("COST_NOT_IN_VERIFIED_STATE");
      }
      if (status === "APPROVED" && cost.requestedById === currentUser.id) {
        if (!emergencyOverride || (notes?.trim().length ?? 0) < 10)
          throw new Error("MAKER_CHECKER_REQUIRED");
      }

      await upsertApprovalTx(tx, {
        approverId: currentUser.id,
        referenceType: "project_cost",
        referenceId: projectCostId,
        status,
        notes,
      });

      const [updatedCost] = await tx
        .update(projectCost)
        .set({
          status,
          approvedById: currentUser.id,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(projectCost.id, projectCostId))
        .returning();

      await writeFieldRequestAuditTx(tx, {
        userId: currentUser.id,
        action:
          status === "APPROVED"
            ? cost.requestedById === currentUser.id
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
        actorId: currentUser.id,
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
          actorId: currentUser.id,
        });
      return updatedCost;
    });

    return {
      success: true,
      data: result,
    };
  } catch (error: unknown) {
    return mapApproveFieldRequestError(error);
  }
}

export async function approveVendorPayment(
  vendorPaymentId: string,
  notes?: string,
  status: "APPROVED" | "REJECTED" = "APPROVED",
  emergencyOverride = false,
): Promise<ActionResponse<{ paymentId: string; status: string }>> {
  try {
    const authResult = await authorizeOwnerVendorApproval();
    if (!authResult.success) return authResult;
    const currentUser = authResult.data.user;

    const result = await db.transaction(async (tx) => {
      const payment = await tx.query.vendorPayment.findFirst({
        where: eq(vendorPayment.id, vendorPaymentId),
      });

      if (!payment) {
        throw new Error("PAYMENT_RECORD_NOT_FOUND");
      }
      if (payment.status !== "PENDING") {
        throw new Error("PAYMENT_NOT_PENDING");
      }
      if (status === "APPROVED" && payment.paidById === currentUser.id) {
        if (!emergencyOverride || (notes?.trim().length ?? 0) < 10)
          throw new Error("MAKER_CHECKER_REQUIRED");
      }

      await upsertApprovalTx(tx, {
        approverId: currentUser.id,
        referenceType: "vendor_payment",
        referenceId: vendorPaymentId,
        status,
        notes,
      });

      if (status === "REJECTED") {
        // `referenceNumber` adalah nomor referensi mutasi bank — pada jalur
        // pencairan ia menjadi `cashTransaction.bankReference` yang dipakai
        // rekonsiliasi dan deteksi duplikat. Alasan penolakan tidak boleh
        // menempatinya; alasan itu sudah tersimpan pada `approval.notes` lewat
        // `upsertApprovalTx` di atas, yang memang tempat auditnya.
        await tx
          .update(vendorPayment)
          .set({
            status: "FAILED",
            paymentDate: new Date(),
          })
          .where(eq(vendorPayment.id, vendorPaymentId));
      }

      await writeFieldRequestAuditTx(tx, {
        userId: currentUser.id,
        action:
          status === "APPROVED"
            ? payment.paidById === currentUser.id
              ? "EMERGENCY_APPROVE_VENDOR_PAYMENT"
              : "APPROVE_VENDOR_PAYMENT"
            : "REJECT_VENDOR_PAYMENT",
        targetTable: "vendor_payment",
        targetId: vendorPaymentId,
        originalState: { paymentStatus: payment.status },
        newState: { paymentStatus: payment.status, approved: status === "APPROVED", status },
      });

      const notificationBill = await tx.query.vendorBill.findFirst({
        where: eq(vendorBill.id, payment.vendorBillId),
      });
      if (notificationBill)
        await recordNotificationEvent(tx, {
          referenceType: "vendor_payment",
          referenceId: payment.id,
          projectId: notificationBill.projectId,
          stage: status,
          title:
            status === "APPROVED" ? "Pembayaran vendor siap diproses" : "Pembayaran vendor ditolak",
          message: notificationBill.billNumber,
          permission: status === "APPROVED" ? "pay:vendor_bill" : "view:vendor_bill",
          recipients: status === "REJECTED" ? [payment.paidById] : undefined,
          actionRequired: status === "APPROVED",
          actionUrl: `/projects/${notificationBill.projectId}?tab=budget`,
          actorId: currentUser.id,
        });
      await reconcileVendorBillAction(tx, payment.vendorBillId);
      return { paymentId: vendorPaymentId, status };
    });

    return {
      success: true,
      data: result,
    };
  } catch (error: unknown) {
    return mapApproveVendorPaymentError(error);
  }
}
