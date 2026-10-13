"use server";
import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export async function correctVendorBill(
  ...args: WebRpcArgs<"app/actions/finance/correct-vendor-bill.correctVendorBill">
): Promise<WebRpcResult<"app/actions/finance/correct-vendor-bill.correctVendorBill">> {
  return callBackendAction("app/actions/finance/correct-vendor-bill.correctVendorBill", args, {
    allowCookieWrites: true,
  });
}
