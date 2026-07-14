"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { projectCost, vendorPayment } from "@/db/schema";
import {
  ensureCanonicalExpenseForProjectCost,
  syncProjectBudgetCategory,
} from "@/lib/budget/budget-sync";
import type { ActionResponse } from "@/lib/types/action-response";
import {
  approveFieldRequestSchema,
  type ApproveFieldRequestInput,
} from "@/lib/validations/finance";
import {
  authorizeFieldRequestAction,
  authorizeOwnerVendorApproval,
} from "./field-request-auth";
import {
  mapApproveFieldRequestError,
  mapApproveVendorPaymentError,
  mapVerifyFieldRequestError,
  upsertApprovalTx,
  writeFieldRequestAuditTx,
} from "./field-request-utils";

export async function verifyFieldRequest(
  projectCostId: string
): Promise<ActionResponse<typeof projectCost.$inferSelect>> {
  try {
    const authResult = await authorizeFieldRequestAction({
      permission: "update:cost",
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

      if (cost.status !== "SUBMITTED") {
        throw new Error("COST_NOT_IN_SUBMITTED_STATE");
      }

      const amount = Number(cost.amount);
      const requiresApproval = amount >= 5000000 || cost.budgetOverrun;
      const nextStatus = requiresApproval ? "VERIFIED" : "APPROVED";

      const [updatedCost] = await tx
        .update(projectCost)
        .set({
          status: nextStatus,
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
  input: ApproveFieldRequestInput
): Promise<ActionResponse<typeof projectCost.$inferSelect>> {
  const validation = approveFieldRequestSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Parameter persetujuan tidak valid." },
    };
  }

  const { projectCostId, status, notes } = validation.data;

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
        action: status === "APPROVED" ? "APPROVE_FIELD_REQUEST" : "REJECT_FIELD_REQUEST",
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
  status: "APPROVED" | "REJECTED" = "APPROVED"
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

      await upsertApprovalTx(tx, {
        approverId: currentUser.id,
        referenceType: "vendor_payment",
        referenceId: vendorPaymentId,
        status,
        notes,
      });

      if (status === "REJECTED") {
        await tx
          .update(vendorPayment)
          .set({
            status: "FAILED",
            referenceNumber: notes || "Ditolak oleh Owner",
            paymentDate: new Date(),
          })
          .where(eq(vendorPayment.id, vendorPaymentId));
      }

      await writeFieldRequestAuditTx(tx, {
        userId: currentUser.id,
        action: status === "APPROVED" ? "APPROVE_VENDOR_PAYMENT" : "REJECT_VENDOR_PAYMENT",
        targetTable: "vendor_payment",
        targetId: vendorPaymentId,
        originalState: { paymentStatus: payment.status },
        newState: { paymentStatus: payment.status, approved: status === "APPROVED", status },
      });

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
