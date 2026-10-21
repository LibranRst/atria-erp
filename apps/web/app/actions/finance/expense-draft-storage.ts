"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/expense-draft-storage";

export async function listExpenseDrafts(
  ...args: WebRpcArgs<"app/actions/finance/expense-draft-storage.listExpenseDrafts">
): Promise<WebRpcResult<"app/actions/finance/expense-draft-storage.listExpenseDrafts">> {
  return callBackendAction("app/actions/finance/expense-draft-storage.listExpenseDrafts", args, {
    allowCookieWrites: true,
  });
}

export async function getExpenseDraft(
  ...args: WebRpcArgs<"app/actions/finance/expense-draft-storage.getExpenseDraft">
): Promise<WebRpcResult<"app/actions/finance/expense-draft-storage.getExpenseDraft">> {
  return callBackendAction("app/actions/finance/expense-draft-storage.getExpenseDraft", args, {
    allowCookieWrites: true,
  });
}

export async function saveExpenseDraft(
  ...args: WebRpcArgs<"app/actions/finance/expense-draft-storage.saveExpenseDraft">
): Promise<WebRpcResult<"app/actions/finance/expense-draft-storage.saveExpenseDraft">> {
  return callBackendAction("app/actions/finance/expense-draft-storage.saveExpenseDraft", args, {
    allowCookieWrites: true,
  });
}

export async function discardExpenseDraft(
  ...args: WebRpcArgs<"app/actions/finance/expense-draft-storage.discardExpenseDraft">
): Promise<WebRpcResult<"app/actions/finance/expense-draft-storage.discardExpenseDraft">> {
  return callBackendAction("app/actions/finance/expense-draft-storage.discardExpenseDraft", args, {
    allowCookieWrites: true,
  });
}
