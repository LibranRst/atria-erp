"use server";

import { callBackend } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/field-request-stock";

export async function applyExpenseStockHandling(
  ...args: WebRpcArgs<"app/actions/finance/field-request-stock.applyExpenseStockHandling">
): Promise<WebRpcResult<"app/actions/finance/field-request-stock.applyExpenseStockHandling">> {
  return callBackend("app/actions/finance/field-request-stock.applyExpenseStockHandling", args, {
    allowCookieWrites: true,
  });
}
