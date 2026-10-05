"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/bank-account-movements";

export async function postManualCashMovement(
  ...args: WebRpcArgs<"app/actions/finance/bank-account-movements.postManualCashMovement">
): Promise<WebRpcResult<"app/actions/finance/bank-account-movements.postManualCashMovement">> {
  return callBackendAction(
    "app/actions/finance/bank-account-movements.postManualCashMovement",
    args,
    { allowCookieWrites: true },
  );
}

export async function transferBetweenBankAccounts(
  ...args: WebRpcArgs<"app/actions/finance/bank-account-movements.transferBetweenBankAccounts">
): Promise<WebRpcResult<"app/actions/finance/bank-account-movements.transferBetweenBankAccounts">> {
  return callBackendAction(
    "app/actions/finance/bank-account-movements.transferBetweenBankAccounts",
    args,
    { allowCookieWrites: true },
  );
}
