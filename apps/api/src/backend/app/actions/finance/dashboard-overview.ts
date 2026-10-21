import type { FinanceDashboardOverview } from "@backend/app/actions/finance/dashboard-overview-utils";
import { resolveActor } from "@backend/server/actor";
import { getFinanceDashboardOverviewUseCase } from "@backend/server/usecases/finance/dashboard-overview";
import type { ActionResponse } from "@atria/core/types/action-response";

export type {
  FinanceDashboardBankAccount,
  FinanceDashboardCashDueItem,
  FinanceDashboardCashDueGroup,
  FinanceDashboardMaterialIssue,
  FinanceDashboardOverview,
  FinanceDashboardRecentTransaction,
  FinanceDashboardTabDetails,
} from "@backend/app/actions/finance/dashboard-overview-utils";

/**
 * Pembungkus Server Action untuk dashboard finansial.
 *
 * Identitas selalu diselesaikan dari sesi server dan tidak pernah diterima
 * sebagai argumen klien. Loader tRPC memanggil use-case yang sama dengan actor
 * yang diselesaikan dari header bearer.
 */
export async function getFinanceDashboardOverview(): Promise<
  ActionResponse<FinanceDashboardOverview>
> {
  const actor = await resolveActor();
  if (!actor) {
    return {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." },
    };
  }

  return getFinanceDashboardOverviewUseCase(actor);
}
