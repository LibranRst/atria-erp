import { resolveActor } from "@backend/server/actor";
import {
  processReceiptUseCase,
  type ParsedReceipt,
} from "@backend/server/usecases/ai/process-receipt";
import type { ActionResponse } from "@atria/core/types/action-response";

/**
 * Pembungkus Server Action untuk OCR nota.
 *
 * Actor selalu dibaca dari sesi server. Klien native memakai prosedur tRPC
 * yang menyelesaikan actor dari bearer token lalu memanggil use-case yang sama.
 */
export async function processReceipt(
  receiptImageUrl: string,
): Promise<ActionResponse<ParsedReceipt>> {
  const actor = await resolveActor();
  if (!actor) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." },
    };
  }

  return processReceiptUseCase(actor, receiptImageUrl);
}
