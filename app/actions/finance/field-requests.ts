"use server";

import { db } from "@/db";
import { projectCost } from "@/db/schema";
import { ActionResponse } from "@/lib/types/action-response";
import {
  submitFieldRequestSchema,
  ApproveFieldRequestInput,
  SubmitFieldRequestInput,
  submitFieldRequestsSchema,
  SubmitFieldRequestsInput,
} from "@/lib/validations/finance";
import crypto from "crypto";
import { authorizeFieldRequestAction } from "./field-request-auth";
import { payFieldRequest as payFieldRequestWrite } from "./field-request-payment";
import {
  approveFieldRequest as approveFieldRequestWrite,
  approveVendorPayment as approveVendorPaymentWrite,
  verifyFieldRequest as verifyFieldRequestWrite,
} from "./field-request-review";
import { createSubmittedFieldRequestTx } from "./field-request-submit";
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

  const { projectId, receiptImageUrl } = validation.data;

  try {
    const authResult = await authorizeFieldRequestAction({
      permission: "create:cost",
      projectId,
    });
    if (!authResult.success) return authResult;
    const currentUser = authResult.data.user;

    const result = await db.transaction(async (tx) => {
      return createSubmittedFieldRequestTx(tx, {
        projectId,
        requestedById: currentUser.id,
        receiptImageUrl,
        item: validation.data,
      });
    });

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

  const { projectId, receiptImageUrl, items } = validation.data;

  try {
    const authResult = await authorizeFieldRequestAction({
      permission: "create:cost",
      projectId,
    });
    if (!authResult.success) return authResult;
    const currentUser = authResult.data.user;

    const receiptGroupId = crypto.randomUUID();

    const results = await db.transaction(async (tx) => {
      const createdCosts: Array<typeof projectCost.$inferSelect> = [];

      for (const item of items) {
        const cost = await createSubmittedFieldRequestTx(tx, {
          projectId,
          requestedById: currentUser.id,
          receiptImageUrl,
          receiptGroupId,
          item,
          includeApprovalCategoryLabel: true,
        });

        createdCosts.push(cost);
      }

      return createdCosts;
    });

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
