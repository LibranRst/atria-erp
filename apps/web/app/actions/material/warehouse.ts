"use server";

import { callBackendAction } from "@/lib/api/backend";
import type { WebRpcArgs, WebRpcResult } from "@atria/api/contract";
export type * from "@atria/api/types/app/actions/material/warehouse";

export async function createInventoryLocation(
  ...args: WebRpcArgs<"app/actions/material/warehouse.createInventoryLocation">
): Promise<WebRpcResult<"app/actions/material/warehouse.createInventoryLocation">> {
  return callBackendAction("app/actions/material/warehouse.createInventoryLocation", args, {
    allowCookieWrites: true,
  });
}
