"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/field-request-payment";

export async function payFieldRequest(
  ...args: WebRpcArgs<"app/actions/finance/field-request-payment.payFieldRequest">
): Promise<WebRpcResult<"app/actions/finance/field-request-payment.payFieldRequest">> {
  return callBackendAction("app/actions/finance/field-request-payment.payFieldRequest", args, {
    allowCookieWrites: true,
  });
}
