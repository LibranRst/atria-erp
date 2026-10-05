"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/finance/generate-invoice-schedule";

export async function generateClientInvoiceSchedule(
  ...args: WebRpcArgs<"app/actions/finance/generate-invoice-schedule.generateClientInvoiceSchedule">
): Promise<
  WebRpcResult<"app/actions/finance/generate-invoice-schedule.generateClientInvoiceSchedule">
> {
  return callBackendAction(
    "app/actions/finance/generate-invoice-schedule.generateClientInvoiceSchedule",
    args,
    { allowCookieWrites: true },
  );
}
