"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/material/goods-receipt";

export async function postGoodsReceipt(
  ...args: WebRpcArgs<"app/actions/material/goods-receipt.postGoodsReceipt">
): Promise<WebRpcResult<"app/actions/material/goods-receipt.postGoodsReceipt">> {
  return callBackendAction("app/actions/material/goods-receipt.postGoodsReceipt", args, {
    allowCookieWrites: true,
  });
}
