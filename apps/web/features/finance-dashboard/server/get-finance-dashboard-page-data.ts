import "server-only";

import { callBackend } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/features/finance-dashboard/server/get-finance-dashboard-page-data";

export async function getFinanceDashboardPageData(
  ...args: WebRpcArgs<"features/finance-dashboard/server/get-finance-dashboard-page-data.getFinanceDashboardPageData">
): Promise<
  WebRpcResult<"features/finance-dashboard/server/get-finance-dashboard-page-data.getFinanceDashboardPageData">
> {
  return callBackend(
    "features/finance-dashboard/server/get-finance-dashboard-page-data.getFinanceDashboardPageData",
    args,
  );
}
