"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/material/warehouse-transfer";

export async function createStockTransfer(
  ...args: WebRpcArgs<"app/actions/material/warehouse-transfer.createStockTransfer">
): Promise<WebRpcResult<"app/actions/material/warehouse-transfer.createStockTransfer">> {
  return callBackendAction("app/actions/material/warehouse-transfer.createStockTransfer", args, {
    allowCookieWrites: true,
  });
}
