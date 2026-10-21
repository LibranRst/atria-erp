"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/material/warehouse-receipt-reversal";

export async function requestGoodsReceiptReversal(
  ...args: WebRpcArgs<"app/actions/material/warehouse-receipt-reversal.requestGoodsReceiptReversal">
): Promise<
  WebRpcResult<"app/actions/material/warehouse-receipt-reversal.requestGoodsReceiptReversal">
> {
  return callBackendAction(
    "app/actions/material/warehouse-receipt-reversal.requestGoodsReceiptReversal",
    args,
    { allowCookieWrites: true },
  );
}

export async function approveGoodsReceiptReversal(
  ...args: WebRpcArgs<"app/actions/material/warehouse-receipt-reversal.approveGoodsReceiptReversal">
): Promise<
  WebRpcResult<"app/actions/material/warehouse-receipt-reversal.approveGoodsReceiptReversal">
> {
  return callBackendAction(
    "app/actions/material/warehouse-receipt-reversal.approveGoodsReceiptReversal",
    args,
    { allowCookieWrites: true },
  );
}

export async function rejectGoodsReceiptReversal(
  ...args: WebRpcArgs<"app/actions/material/warehouse-receipt-reversal.rejectGoodsReceiptReversal">
): Promise<
  WebRpcResult<"app/actions/material/warehouse-receipt-reversal.rejectGoodsReceiptReversal">
> {
  return callBackendAction(
    "app/actions/material/warehouse-receipt-reversal.rejectGoodsReceiptReversal",
    args,
    { allowCookieWrites: true },
  );
}
