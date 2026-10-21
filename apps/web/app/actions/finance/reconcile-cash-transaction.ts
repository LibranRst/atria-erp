"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/reconcile-cash-transaction";

export async function reconcileCashTransaction(
  ...args: WebRpcArgs<"app/actions/finance/reconcile-cash-transaction.reconcileCashTransaction">
): Promise<
  WebRpcResult<"app/actions/finance/reconcile-cash-transaction.reconcileCashTransaction">
> {
  return callBackendAction(
    "app/actions/finance/reconcile-cash-transaction.reconcileCashTransaction",
    args,
    { allowCookieWrites: true },
  );
}

export async function markReconciliationException(
  ...args: WebRpcArgs<"app/actions/finance/reconcile-cash-transaction.markReconciliationException">
): Promise<
  WebRpcResult<"app/actions/finance/reconcile-cash-transaction.markReconciliationException">
> {
  return callBackendAction(
    "app/actions/finance/reconcile-cash-transaction.markReconciliationException",
    args,
    { allowCookieWrites: true },
  );
}

export async function clearReconciliationException(
  ...args: WebRpcArgs<"app/actions/finance/reconcile-cash-transaction.clearReconciliationException">
): Promise<
  WebRpcResult<"app/actions/finance/reconcile-cash-transaction.clearReconciliationException">
> {
  return callBackendAction(
    "app/actions/finance/reconcile-cash-transaction.clearReconciliationException",
    args,
    { allowCookieWrites: true },
  );
}
