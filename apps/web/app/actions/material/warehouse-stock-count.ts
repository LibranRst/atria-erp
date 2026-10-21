"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/material/warehouse-stock-count";

export async function saveStockCount(
  ...args: WebRpcArgs<"app/actions/material/warehouse-stock-count.saveStockCount">
): Promise<WebRpcResult<"app/actions/material/warehouse-stock-count.saveStockCount">> {
  return callBackendAction("app/actions/material/warehouse-stock-count.saveStockCount", args, {
    allowCookieWrites: true,
  });
}

export async function submitStockCount(
  ...args: WebRpcArgs<"app/actions/material/warehouse-stock-count.submitStockCount">
): Promise<WebRpcResult<"app/actions/material/warehouse-stock-count.submitStockCount">> {
  return callBackendAction("app/actions/material/warehouse-stock-count.submitStockCount", args, {
    allowCookieWrites: true,
  });
}

export async function approveStockCount(
  ...args: WebRpcArgs<"app/actions/material/warehouse-stock-count.approveStockCount">
): Promise<WebRpcResult<"app/actions/material/warehouse-stock-count.approveStockCount">> {
  return callBackendAction("app/actions/material/warehouse-stock-count.approveStockCount", args, {
    allowCookieWrites: true,
  });
}

export async function rejectStockCount(
  ...args: WebRpcArgs<"app/actions/material/warehouse-stock-count.rejectStockCount">
): Promise<WebRpcResult<"app/actions/material/warehouse-stock-count.rejectStockCount">> {
  return callBackendAction("app/actions/material/warehouse-stock-count.rejectStockCount", args, {
    allowCookieWrites: true,
  });
}
