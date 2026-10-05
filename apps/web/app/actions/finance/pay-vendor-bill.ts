"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/pay-vendor-bill";

export async function payVendorBill(
  ...args: WebRpcArgs<"app/actions/finance/pay-vendor-bill.payVendorBill">
): Promise<WebRpcResult<"app/actions/finance/pay-vendor-bill.payVendorBill">> {
  return callBackendAction("app/actions/finance/pay-vendor-bill.payVendorBill", args, {
    allowCookieWrites: true,
  });
}
