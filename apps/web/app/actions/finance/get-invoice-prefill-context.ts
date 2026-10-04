"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/get-invoice-prefill-context";

export async function getInvoicePrefillContext(
  ...args: WebRpcArgs<"app/actions/finance/get-invoice-prefill-context.getInvoicePrefillContext">
): Promise<
  WebRpcResult<"app/actions/finance/get-invoice-prefill-context.getInvoicePrefillContext">
> {
  return callBackendAction(
    "app/actions/finance/get-invoice-prefill-context.getInvoicePrefillContext",
    args,
    { allowCookieWrites: true },
  );
}
