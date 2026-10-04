import { actorCan } from "@backend/lib/auth/permissions";
import { assertProjectStatusIsOperational } from "@backend/lib/auth/scoping";
import { assertFinancePermission, lockFinanceProject } from "@backend/server/usecases/finance/mutation-access";
import { resolveActor } from "@backend/server/actor";
import {
  approveFieldRequestTx,
  verifyFieldRequestTx,
} from "@backend/server/usecases/finance/review-field-request";
import { reconcileVendorBillAction } from "@backend/server/services/notification-job";
import { vendorBill } from "@backend/db/schema";
import { recordNotificationEvent } from "@backend/server/services/notification-events";

import { eq } from "drizzle-orm";

import { db } from "@backend/db";
import { projectCost, vendorPayment } from "@backend/db/schema";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  approveFieldRequestSchema,
  type ApproveFieldRequestInput,
} from "@atria/core/validations/finance";
import {
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
    const actor = await resolveActor();
    if (!actor)
      return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
    const result = await db.transaction((tx) => verifyFieldRequestTx(tx, actor, projectCostId));

    return {
      success: true,
      data: result,
    };
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error.message.startsWith("FORBIDDEN:") || error.message.startsWith("PROJECT_NOT_ACTIVE:"))
    )
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Akses proyek atau verifikasi ditolak." },
      };
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

  try {
    const actor = await resolveActor();
    if (!actor)
      return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
    const result = await db.transaction((tx) => approveFieldRequestTx(tx, actor, validation.data));

    return {
      success: true,
      data: result,
    };
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error.message.startsWith("FORBIDDEN:") || error.message.startsWith("PROJECT_NOT_ACTIVE:"))
    )
      return {
        success: false,
        error: { code: "FORBIDDEN", message: "Akses proyek atau persetujuan ditolak." },
      };
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
    const actor = await resolveActor();
    if (!actor) return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
    assertFinancePermission(actor, "approve:cost");
    const result = await db.transaction(async (tx) => {
      const [payment] = await tx.select().from(vendorPayment).where(eq(vendorPayment.id, vendorPaymentId)).for("update");

      if (!payment) {
        throw new Error("PAYMENT_RECORD_NOT_FOUND");
      }
      const bill = await tx.query.vendorBill.findFirst({ where: eq(vendorBill.id, payment.vendorBillId) });
      if (!bill) throw new Error("VENDOR_BILL_NOT_FOUND");
      const currentProject = await lockFinanceProject(tx, actor, bill.projectId);
      assertProjectStatusIsOperational(currentProject.status);
      if (payment.status !== "PENDING") {
        throw new Error("PAYMENT_NOT_PENDING");
      }
      if (status === "APPROVED" && payment.paidById === actor.userId) {
        if (!actorCan(actor, "override:self_approval") || !emergencyOverride || (notes?.trim().length ?? 0) < 10)
          throw new Error("MAKER_CHECKER_REQUIRED");
      }

      await upsertApprovalTx(tx, {
        approverId: actor.userId,
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
        userId: actor.userId,
        action:
          status === "APPROVED"
            ? payment.paidById === actor.userId
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
          actorId: actor.userId,
        });
      await reconcileVendorBillAction(tx, payment.vendorBillId);
      return { paymentId: vendorPaymentId, status };
    });

    return {
      success: true,
      data: result,
    };
  } catch (error: unknown) {
    if (error instanceof Error && (error.message.startsWith("FORBIDDEN:") || error.message.startsWith("PROJECT_NOT_ACTIVE:"))) return { success: false, error: { code: "FORBIDDEN", message: "Akses proyek atau persetujuan ditolak." } };
    return mapApproveVendorPaymentError(error);
  }
}
