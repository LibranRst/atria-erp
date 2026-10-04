"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/dashboard-overview";

export async function getFinanceDashboardOverview(
  ...args: WebRpcArgs<"app/actions/finance/dashboard-overview.getFinanceDashboardOverview">
): Promise<WebRpcResult<"app/actions/finance/dashboard-overview.getFinanceDashboardOverview">> {
  return callBackendAction(
    "app/actions/finance/dashboard-overview.getFinanceDashboardOverview",
    args,
    { allowCookieWrites: true },
  );
}
