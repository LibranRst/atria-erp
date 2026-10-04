"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/ai/process-receipt";

export async function processReceipt(
  ...args: WebRpcArgs<"app/actions/ai/process-receipt.processReceipt">
): Promise<WebRpcResult<"app/actions/ai/process-receipt.processReceipt">> {
  return callBackendAction("app/actions/ai/process-receipt.processReceipt", args, {
    allowCookieWrites: true,
  });
}
