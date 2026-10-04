"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/material/operations-dashboard";

export async function getMaterialMovementPage(
  ...args: WebRpcArgs<"app/actions/material/operations-dashboard.getMaterialMovementPage">
): Promise<WebRpcResult<"app/actions/material/operations-dashboard.getMaterialMovementPage">> {
  return callBackendAction(
    "app/actions/material/operations-dashboard.getMaterialMovementPage",
    args,
    { allowCookieWrites: true },
  );
}

export async function getMaterialOperationsDashboard(
  ...args: WebRpcArgs<"app/actions/material/operations-dashboard.getMaterialOperationsDashboard">
): Promise<
  WebRpcResult<"app/actions/material/operations-dashboard.getMaterialOperationsDashboard">
> {
  return callBackendAction(
    "app/actions/material/operations-dashboard.getMaterialOperationsDashboard",
    args,
    { allowCookieWrites: true },
  );
}
