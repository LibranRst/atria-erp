"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/schedule-vendor-bill";

export async function scheduleVendorBillPayment(
  ...args: WebRpcArgs<"app/actions/finance/schedule-vendor-bill.scheduleVendorBillPayment">
): Promise<WebRpcResult<"app/actions/finance/schedule-vendor-bill.scheduleVendorBillPayment">> {
  return callBackendAction(
    "app/actions/finance/schedule-vendor-bill.scheduleVendorBillPayment",
    args,
    { allowCookieWrites: true },
  );
}
