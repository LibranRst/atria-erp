"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/record-client-payment";

export async function recordClientPayment(
  ...args: WebRpcArgs<"app/actions/finance/record-client-payment.recordClientPayment">
): Promise<WebRpcResult<"app/actions/finance/record-client-payment.recordClientPayment">> {
  return callBackendAction("app/actions/finance/record-client-payment.recordClientPayment", args, {
    allowCookieWrites: true,
  });
}
