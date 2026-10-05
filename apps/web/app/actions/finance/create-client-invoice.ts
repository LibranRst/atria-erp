"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/create-client-invoice";

export async function createClientInvoice(
  ...args: WebRpcArgs<"app/actions/finance/create-client-invoice.createClientInvoice">
): Promise<WebRpcResult<"app/actions/finance/create-client-invoice.createClientInvoice">> {
  return callBackendAction("app/actions/finance/create-client-invoice.createClientInvoice", args, {
    allowCookieWrites: true,
  });
}
