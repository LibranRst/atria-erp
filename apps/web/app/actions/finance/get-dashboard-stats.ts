"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/get-dashboard-stats";

export async function getDashboardStats(
  ...args: WebRpcArgs<"app/actions/finance/get-dashboard-stats.getDashboardStats">
): Promise<WebRpcResult<"app/actions/finance/get-dashboard-stats.getDashboardStats">> {
  return callBackendAction("app/actions/finance/get-dashboard-stats.getDashboardStats", args, {
    allowCookieWrites: true,
  });
}
