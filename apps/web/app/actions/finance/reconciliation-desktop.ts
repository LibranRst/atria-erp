"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";

export async function getReconciliationDesktopWorkspace(
  ...args: WebRpcArgs<"app/actions/finance/reconciliation-desktop.getReconciliationDesktopWorkspace">
): Promise<
  WebRpcResult<"app/actions/finance/reconciliation-desktop.getReconciliationDesktopWorkspace">
> {
  return callBackendAction(
    "app/actions/finance/reconciliation-desktop.getReconciliationDesktopWorkspace",
    args,
  );
}

export async function getReconciliationMatchContext(
  ...args: WebRpcArgs<"app/actions/finance/reconciliation-desktop.getReconciliationMatchContext">
): Promise<
  WebRpcResult<"app/actions/finance/reconciliation-desktop.getReconciliationMatchContext">
> {
  return callBackendAction(
    "app/actions/finance/reconciliation-desktop.getReconciliationMatchContext",
    args,
  );
}
