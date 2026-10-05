import type { Actor } from "@backend/server/actor";
import { actorCan } from "@backend/lib/auth/permissions";
import { resolveCashTransaction } from "@backend/app/actions/activity-detail-finance-resolvers";
import type { ActivityDetailView } from "@atria/core/activity-detail/types";
import type { ActionResponse } from "@atria/core/types/action-response";

/** Native cash detail has the same global ledger boundary as the Home loader. */
export async function getCashActivityDetail(
  actor: Actor,
  id: string,
): Promise<ActionResponse<ActivityDetailView>> {
  if (!actorCan(actor, "view:ledger") || actor.dataScope !== "GLOBAL")
    return {
      success: false,
      error: { code: "FORBIDDEN", message: "Anda tidak memiliki akses ke detail transaksi ini." },
    };
  try {
    const detail = await resolveCashTransaction(id);
    if (!detail)
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Transaksi tidak ditemukan atau sudah tidak tersedia.",
        },
      };
    return { success: true, data: detail };
  } catch {
    return {
      success: false,
      error: { code: "INTERNAL_SERVER_ERROR", message: "Detail transaksi belum dapat dimuat." },
    };
  }
}
