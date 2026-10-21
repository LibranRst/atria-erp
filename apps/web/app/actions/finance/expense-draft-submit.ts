"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/expense-draft-submit";

export async function submitExpenseDraft(
  ...args: WebRpcArgs<"app/actions/finance/expense-draft-submit.submitExpenseDraft">
): Promise<WebRpcResult<"app/actions/finance/expense-draft-submit.submitExpenseDraft">> {
  return callBackendAction("app/actions/finance/expense-draft-submit.submitExpenseDraft", args, {
    allowCookieWrites: true,
  });
}
