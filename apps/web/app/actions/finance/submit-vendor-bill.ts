"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/submit-vendor-bill";

export async function submitVendorBill(
  ...args: WebRpcArgs<"app/actions/finance/submit-vendor-bill.submitVendorBill">
): Promise<WebRpcResult<"app/actions/finance/submit-vendor-bill.submitVendorBill">> {
  return callBackendAction("app/actions/finance/submit-vendor-bill.submitVendorBill", args, {
    allowCookieWrites: true,
  });
}

export async function getVendorBillFormData(
  ...args: WebRpcArgs<"app/actions/finance/submit-vendor-bill.getVendorBillFormData">
): Promise<WebRpcResult<"app/actions/finance/submit-vendor-bill.getVendorBillFormData">> {
  return callBackendAction("app/actions/finance/submit-vendor-bill.getVendorBillFormData", args, {
    allowCookieWrites: true,
  });
}
