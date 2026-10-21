import { resolveActor } from "@backend/server/actor";
import { payFieldRequestUseCase } from "@backend/server/usecases/finance/pay-field-request";
import type { ActionResponse } from "@atria/core/types/action-response";
import { payFieldRequestSchema } from "@atria/core/validations/finance";

/**
 * Pembungkus tipis di atas `payFieldRequestUseCase`.
 *
 * Signature posisionalnya sengaja dipertahankan supaya seluruh call site UI dan
 * barrel `field-requests.ts` tidak berubah. Logika finansialnya ada di
 * use-case, yang dipakai bersama oleh prosedur tRPC untuk klien native.
 */
export async function payFieldRequest(
  projectCostId: string,
  bankAccountId: string,
  referenceNumber: string,
): Promise<ActionResponse<{ costId: string; nextBalance: number }>> {
  const actor = await resolveActor();
  if (!actor) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." },
    };
  }

  const parsed = payFieldRequestSchema.safeParse({
    projectCostId,
    bankAccountId,
    referenceNumber,
  });
  if (!parsed.success) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Data pembayaran tidak valid.",
        details: parsed.error.flatten().fieldErrors,
      },
    };
  }

  return payFieldRequestUseCase(actor, parsed.data);
}
