"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function getFinanceDashboardDesktopTabData(
  ...args: WebRpcArgs<"app/actions/finance/dashboard-desktop.getFinanceDashboardDesktopTabData">
): Promise<
  WebRpcResult<"app/actions/finance/dashboard-desktop.getFinanceDashboardDesktopTabData">
> {
  return callBackendAction(
    "app/actions/finance/dashboard-desktop.getFinanceDashboardDesktopTabData",
    args,
    { allowCookieWrites: true },
  );
}
export async function getFinanceDashboardCashFlowTrend(
  ...args: WebRpcArgs<"app/actions/finance/dashboard-desktop.getFinanceDashboardCashFlowTrend">
): Promise<WebRpcResult<"app/actions/finance/dashboard-desktop.getFinanceDashboardCashFlowTrend">> {
  return callBackendAction(
    "app/actions/finance/dashboard-desktop.getFinanceDashboardCashFlowTrend",
    args,
    { allowCookieWrites: true },
  );
}
