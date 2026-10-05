"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/bank-account-management";

export async function createBankAccount(
  ...args: WebRpcArgs<"app/actions/finance/bank-account-management.createBankAccount">
): Promise<WebRpcResult<"app/actions/finance/bank-account-management.createBankAccount">> {
  return callBackendAction("app/actions/finance/bank-account-management.createBankAccount", args, {
    allowCookieWrites: true,
  });
}

export async function updateBankAccount(
  ...args: WebRpcArgs<"app/actions/finance/bank-account-management.updateBankAccount">
): Promise<WebRpcResult<"app/actions/finance/bank-account-management.updateBankAccount">> {
  return callBackendAction("app/actions/finance/bank-account-management.updateBankAccount", args, {
    allowCookieWrites: true,
  });
}

export async function setBankAccountActive(
  ...args: WebRpcArgs<"app/actions/finance/bank-account-management.setBankAccountActive">
): Promise<WebRpcResult<"app/actions/finance/bank-account-management.setBankAccountActive">> {
  return callBackendAction(
    "app/actions/finance/bank-account-management.setBankAccountActive",
    args,
    { allowCookieWrites: true },
  );
}
