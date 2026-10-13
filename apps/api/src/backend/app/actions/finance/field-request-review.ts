import { decideVendorPaymentTx } from "@backend/server/usecases/finance/vendor-payment-writer";
import { assertFinancePermission } from "@backend/server/usecases/finance/mutation-access";
import { resolveActor } from "@backend/server/actor";
import {
  approveFieldRequestTx,
  verifyFieldRequestTx,
} from "@backend/server/usecases/finance/review-field-request";

import { db } from "@backend/db";
import { projectCost } from "@backend/db/schema";
import type { ActionResponse } from "@atria/core/types/action-response";
import {
  approveFieldRequestSchema,
  type ApproveFieldRequestInput,
} from "@atria/core/validations/finance";
import {
  mapApproveFieldRequestError,
  mapApproveVendorPaymentError,
  mapVerifyFieldRequestError,
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
    if (!actor)
      return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
    assertFinancePermission(actor, "approve:cost");
    const result = await db.transaction(async (tx) => {
      return decideVendorPaymentTx(tx, actor, {
        vendorPaymentId,
        notes,
        status,
        emergencyOverride,
      });
    });

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
    return mapApproveVendorPaymentError(error);
  }
}
