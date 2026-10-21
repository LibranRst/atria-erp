import { submitExpenseBatchTx } from "@backend/server/usecases/finance/submit-expense-batch";
import { resolveActor } from "@backend/server/actor";
import { submitFieldRequestTx } from "@backend/server/usecases/finance/submit-field-request";
import { db } from "@backend/db";
import { projectCost } from "@backend/db/schema";
import { ActionResponse } from "@atria/core/types/action-response";
import {
  submitFieldRequestSchema,
  ApproveFieldRequestInput,
  SubmitFieldRequestInput,
  submitFieldRequestsSchema,
  SubmitFieldRequestsInput,
} from "@atria/core/validations/finance";
import { authorizeFieldRequestAction } from "./field-request-auth";
import { payFieldRequest as payFieldRequestWrite } from "./field-request-payment";
import {
  approveFieldRequest as approveFieldRequestWrite,
  approveVendorPayment as approveVendorPaymentWrite,
  verifyFieldRequest as verifyFieldRequestWrite,
} from "./field-request-review";
import { mapSubmitFieldRequestError } from "./field-request-utils";

/**
 * PM mengajukan biaya pengeluaran lapangan baru (Project Cost / Field Claim).
 */
export async function submitFieldRequest(
  input: SubmitFieldRequestInput,
): Promise<ActionResponse<typeof projectCost.$inferSelect>> {
  const validation = submitFieldRequestSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Parameter pengajuan biaya lapangan tidak valid.",
      },
    };
  }

  try {
    const actor = await resolveActor();
    if (!actor)
      return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
    const result = await db.transaction((tx) => submitFieldRequestTx(tx, actor, validation.data));

    return {
      success: true,
      data: result,
    };
  } catch (error: unknown) {
    return mapSubmitFieldRequestError(error);
  }
}

/**
 * PM mengajukan beberapa biaya pengeluaran lapangan sekaligus (Multi-Item) di bawah satu nota.
 */
export async function submitFieldRequests(
  input: SubmitFieldRequestsInput,
): Promise<ActionResponse<Array<typeof projectCost.$inferSelect>>> {
  const validation = submitFieldRequestsSchema.safeParse(input);
  if (!validation.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Parameter pengajuan biaya lapangan tidak valid.",
      },
    };
  }

  const { projectId } = validation.data;

  try {
    const authResult = await authorizeFieldRequestAction({
      permission: "create:cost",
      projectId,
    });
    if (!authResult.success) return authResult;

    const actor = await resolveActor();
    if (!actor)
      return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
    const results = await db.transaction((tx) => submitExpenseBatchTx(tx, actor, validation.data));

    return {
      success: true,
      data: results,
    };
  } catch (error: unknown) {
    return mapSubmitFieldRequestError(error);
  }
}

/**
 * Admin atau PM Senior memverifikasi biaya lapangan (dari SUBMITTED ke VERIFIED).
 */
export async function verifyFieldRequest(
  projectCostId: string,
): Promise<ActionResponse<typeof projectCost.$inferSelect>> {
  return verifyFieldRequestWrite(projectCostId);
}

/**
 * Owner menyetujui atau menolak pengajuan pengeluaran lapangan.
 */
export async function approveFieldRequest(
  input: ApproveFieldRequestInput,
): Promise<ActionResponse<typeof projectCost.$inferSelect>> {
  return approveFieldRequestWrite(input);
}

/**
 * Finance Admin atau Owner melakukan pelunasan biaya lapangan dari kas kecil (Petty Cash).
 */
export async function payFieldRequest(
  projectCostId: string,
  bankAccountId: string,
  referenceNumber: string,
): Promise<ActionResponse<{ costId: string; nextBalance: number }>> {
  return payFieldRequestWrite(projectCostId, bankAccountId, referenceNumber);
}

/**
 * Owner menyetujui atau menolak permohonan pembayaran vendor yang dipending.
 */
export async function approveVendorPayment(
  vendorPaymentId: string,
  notes?: string,
  status: "APPROVED" | "REJECTED" = "APPROVED",
  emergencyOverride = false,
): Promise<ActionResponse<{ paymentId: string; status: string }>> {
  return approveVendorPaymentWrite(vendorPaymentId, notes, status, emergencyOverride);
}
