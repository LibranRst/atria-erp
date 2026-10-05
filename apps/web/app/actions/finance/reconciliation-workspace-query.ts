"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/reconciliation-workspace-query";

export async function getReconciliationWorkspace(
  ...args: WebRpcArgs<"app/actions/finance/reconciliation-workspace-query.getReconciliationWorkspace">
): Promise<
  WebRpcResult<"app/actions/finance/reconciliation-workspace-query.getReconciliationWorkspace">
> {
  return callBackendAction(
    "app/actions/finance/reconciliation-workspace-query.getReconciliationWorkspace",
    args,
    { allowCookieWrites: true },
  );
}
