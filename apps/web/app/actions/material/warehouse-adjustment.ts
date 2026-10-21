"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/material/warehouse-adjustment";

export async function emergencyAdjustStock(
  ...args: WebRpcArgs<"app/actions/material/warehouse-adjustment.emergencyAdjustStock">
): Promise<WebRpcResult<"app/actions/material/warehouse-adjustment.emergencyAdjustStock">> {
  return callBackendAction("app/actions/material/warehouse-adjustment.emergencyAdjustStock", args, {
    allowCookieWrites: true,
  });
}
