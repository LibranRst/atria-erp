import { resolveActor } from "@backend/server/actor";
import {
  getFinanceDashboardCashFlowTrendUseCase,
  getFinanceDashboardDesktopTabDataUseCase,
} from "@backend/server/usecases/finance/dashboard-desktop";
import type {
  DashboardDesktopRequest,
  DashboardDesktopData,
} from "@atria/core/finance/dashboard-desktop";
import type {
  DashboardCashFlowInput,
  DashboardCashFlowTrend,
} from "@atria/core/finance/dashboard-cash-flow";
import type { ActionResponse } from "@atria/core/types/action-response";
export async function getFinanceDashboardDesktopTabData(
  input: DashboardDesktopRequest,
): Promise<ActionResponse<DashboardDesktopData>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  return getFinanceDashboardDesktopTabDataUseCase(actor, input);
}
export async function getFinanceDashboardCashFlowTrend(
  input: DashboardCashFlowInput,
): Promise<ActionResponse<DashboardCashFlowTrend>> {
  const actor = await resolveActor();
  if (!actor)
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sesi tidak valid." } };
  return getFinanceDashboardCashFlowTrendUseCase(actor, input);
}
