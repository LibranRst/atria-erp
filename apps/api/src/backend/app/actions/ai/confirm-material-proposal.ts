import type { ActionResponse } from "@atria/core/types/action-response";
import { procurementWarehouseIdentitySchema } from "@atria/core/ai/procurement-warehouse";
import {
  confirmAiProcurementWarehouseProposal,
  getAiProcurementWarehouseProposal,
} from "./procurement-warehouse";

/** Historical payload previews must regenerate an owned source proof. */
export async function confirmAiGoodsReceiptProposal(
  input: unknown,
): Promise<ActionResponse<{ receiptId: string; alreadyConfirmed: boolean }>> {
  const identity = procurementWarehouseIdentitySchema.safeParse(input);
  if (!identity.success)
    return {
      success: false,
      error: {
        code: "CONFLICT",
        message:
          "Preview penerimaan lama perlu dibuat ulang. Minta preview terbaru sebelum mencatat stok.",
      },
    };
  const view = await getAiProcurementWarehouseProposal(identity.data);
  if (!view.success) return view;
  if (view.data.proposal.action !== "PROJECT_RECEIPT")
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Identitas ini bukan usulan penerimaan material proyek.",
      },
    };
  const result = await confirmAiProcurementWarehouseProposal(identity.data);
  return result.success
    ? {
        success: true,
        data: { receiptId: result.data.resultId, alreadyConfirmed: result.data.alreadyConfirmed },
      }
    : result;
}
